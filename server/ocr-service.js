/**
 * OCR Service - Text-based UI targeting for VoiceOS
 * 
 * Uses the backend Python venv with pytesseract/Vision for OCR.
 * All dependencies are in backend/requirements.txt for reproducibility.
 * 
 * Phase 1 of Enhanced Backend implementation.
 * 
 * Dependencies:
 * - Python: pytesseract, Pillow, pyobjc-framework-Vision (in requirements.txt)
 * - System: tesseract (brew install tesseract)
 */

import { exec, spawn } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to backend venv Python (where dependencies are installed)
const VENV_PYTHON = path.join(__dirname, '..', 'backend', 'venv', 'bin', 'python3');

/**
 * Run Python script using backend venv
 */
async function runPython(script) {
    return new Promise((resolve, reject) => {
        const proc = spawn(VENV_PYTHON, ['-c', script], {
            cwd: path.join(__dirname, '..', 'backend')
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data; });
        proc.stderr.on('data', (data) => { stderr += data; });

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr || `Python exited with code ${code}`));
            } else {
                resolve(stdout.trim());
            }
        });

        proc.on('error', (err) => reject(err));
    });
}

/**
 * Click on text visible on screen using OCR.
 * @param {string} query - Text to find and click
 * @param {object} options - Click options
 * @returns {Promise<{success: boolean, clicked?: string, region?: object, error?: string}>}
 */
export async function clickOnText(query, options = {}) {
    try {
        console.log(`[OCR] Searching for text: "${query}"`);

        const region = await findTextRegion(query);

        if (!region) {
            return {
                success: false,
                error: `Text "${query}" not found on screen`
            };
        }

        // Calculate center of the region
        const centerX = region.x + Math.floor(region.width / 2);
        const centerY = region.y + Math.floor(region.height / 2);

        // Click using Quartz
        const clickScript = `
import Quartz
x, y = ${centerX}, ${centerY}
event_down = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, (x, y), Quartz.kCGMouseButtonLeft)
event_up = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, (x, y), Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, event_down)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, event_up)
print("OK")
`;
        await runPython(clickScript);

        console.log(`[OCR] Clicked on "${query}" at (${centerX}, ${centerY})`);

        return {
            success: true,
            clicked: query,
            region: region,
            coordinates: { x: centerX, y: centerY }
        };
    } catch (error) {
        console.error(`[OCR] Click error:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Find all occurrences of text on screen.
 * @param {string} query - Text to search for
 * @returns {Promise<Array<{x: number, y: number, width: number, height: number}>>}
 */
export async function findTextOnScreen(query) {
    try {
        const regions = await findAllTextRegions(query);
        return regions;
    } catch (error) {
        console.error(`[OCR] Find text error:`, error.message);
        return [];
    }
}

/**
 * Type text at current cursor position or after clicking on a label.
 * @param {string} text - Text to type
 * @param {string} [label] - Optional label to click first
 * @returns {Promise<{success: boolean, typed?: string, error?: string}>}
 */
export async function typeText(text, label = null) {
    try {
        if (label) {
            const clickResult = await clickOnText(label);
            if (!clickResult.success) {
                return {
                    success: false,
                    error: `Could not find label "${label}" to click before typing`
                };
            }
            await new Promise(r => setTimeout(r, 150));
        }

        // Type using AppleScript
        const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const script = `tell application "System Events" to keystroke "${escaped}"`;
        await execPromise(`osascript -e '${script}'`);

        return { success: true, typed: text };
    } catch (error) {
        console.error(`[OCR] Type error:`, error.message);
        return { success: false, error: error.message };
    }
}

// ============ Helper Functions ============

async function findTextRegion(query) {
    const regions = await findAllTextRegions(query);
    return regions.length > 0 ? regions[0] : null;
}

/**
 * Find all text regions using macOS Vision framework (via PyObjC).
 * Falls back to pytesseract if Vision is unavailable.
 */
async function findAllTextRegions(query) {
    const pythonScript = `
import subprocess
import tempfile
import os
import json

def find_with_vision(tmp_path, query_lower, search_menu_bar=False):
    """Use macOS Vision framework for OCR."""
    import Quartz
    from Foundation import NSURL
    import Vision
    from PIL import Image
    
    # Load and optionally crop to menu bar region
    img = Image.open(tmp_path)
    img_width, img_height = img.size
    
    if search_menu_bar:
        # Crop to top 50 pixels (menu bar) and upscale 2x for better OCR
        menu_height = 50
        img = img.crop((0, 0, img_width, menu_height))
        img = img.resize((img_width * 2, menu_height * 2), Image.Resampling.LANCZOS)
        # Save cropped version
        img.save(tmp_path)
        img_width, img_height = img.size
    
    image_url = NSURL.fileURLWithPath_(tmp_path)
    source = Quartz.CGImageSourceCreateWithURL(image_url, None)
    if not source:
        return []
    
    cg_image = Quartz.CGImageSourceCreateImageAtIndex(source, 0, None)
    if not cg_image:
        return []
    
    actual_width = Quartz.CGImageGetWidth(cg_image)
    actual_height = Quartz.CGImageGetHeight(cg_image)
    
    results = []
    
    def completion_handler(request, error):
        if error:
            return
        observations = request.results()
        if not observations:
            return
        
        for observation in observations:
            candidates = observation.topCandidates_(1)
            if not candidates:
                continue
            
            text = candidates[0].string()
            confidence = candidates[0].confidence()
            
            if query_lower in text.lower():
                bbox = observation.boundingBox()
                x = int(bbox.origin.x * actual_width)
                y = int((1 - bbox.origin.y - bbox.size.height) * actual_height)
                w = int(bbox.size.width * actual_width)
                h = int(bbox.size.height * actual_height)
                
                # Adjust coordinates back if menu bar was cropped/scaled
                if search_menu_bar:
                    x = x // 2
                    y = y // 2
                    w = w // 2
                    h = h // 2
                
                results.append({"x": x, "y": y, "width": w, "height": h, "text": text, "confidence": confidence})
    
    request = Vision.VNRecognizeTextRequest.alloc().initWithCompletionHandler_(completion_handler)
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(True)
    
    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    handler.performRequests_error_([request], None)
    
    return results

def find_with_tesseract(tmp_path, query_lower):
    """Fallback to pytesseract for OCR."""
    from PIL import Image
    import pytesseract
    
    img = Image.open(tmp_path)
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    
    results = []
    for i, text in enumerate(data['text']):
        if text and query_lower in text.lower():
            x = data['left'][i]
            y = data['top'][i]
            w = data['width'][i]
            h = data['height'][i]
            conf = data['conf'][i]
            if conf > 0:
                results.append({"x": x, "y": y, "width": w, "height": h, "text": text, "confidence": conf})
    
    return results

# Main
try:
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        tmp_path = f.name
    
    subprocess.run(['screencapture', '-x', tmp_path], check=True, capture_output=True)
    
    query_lower = """${query.toLowerCase().replace(/"/g, '\\"')}"""
    
    # Common menu bar items - try menu bar region first for these
    menu_items = ['file', 'edit', 'view', 'window', 'help', 'go', 'format', 'insert', 'tools']
    is_menu_query = query_lower in menu_items
    
    results = []
    
    # Try Vision
    try:
        if is_menu_query:
            # Try menu bar region first (upscaled for small text)
            results = find_with_vision(tmp_path, query_lower, search_menu_bar=True)
        
        if not results:
            # Search full screen
            # Need to re-capture since menu bar search modifies the file
            if is_menu_query:
                subprocess.run(['screencapture', '-x', tmp_path], check=True, capture_output=True)
            results = find_with_vision(tmp_path, query_lower, search_menu_bar=False)
    except ImportError:
        # Fall back to tesseract
        results = find_with_tesseract(tmp_path, query_lower)
    
    os.remove(tmp_path)
    print(json.dumps(results))
    
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

    try {
        const stdout = await runPython(pythonScript);
        const result = JSON.parse(stdout);

        if (result.error) {
            console.error('[OCR] Python error:', result.error);
            return [];
        }

        return Array.isArray(result) ? result : [];

    } catch (error) {
        console.error('[OCR] Python execution error:', error.message);
        return [];
    }
}

export default {
    clickOnText,
    findTextOnScreen,
    typeText
};
