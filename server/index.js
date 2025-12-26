import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import { executeJXA, openApp, closeApp, setVolume, sendShortcut, typeKeystrokes, openPath, clickAt } from './macos.js';
import { clickOnText, findTextOnScreen, typeText as ocrTypeText } from './ocr-service.js';
import { getClickElementPrompt, parseVisionResponse, CONFIDENCE_THRESHOLD } from './vision-prompts.js';
import { checkSafety, storePendingAction, consumePendingAction, generateActionId } from './safety-guard.js';

// Load .env.local for server-side environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                process.env[key.trim()] = valueParts.join('=').trim();
            }
        }
    });
    console.log('[Server] Loaded .env.local, VITE_DEBUG=' + process.env.VITE_DEBUG);
}

const execPromise = util.promisify(exec);

const app = express();
const PORT = 3001;
const LOG_DIR = process.env.LOG_DIR || './logs';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

app.use(cors());
// Increase body size limit for screenshots (default is 100kb)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// API Status
app.get('/api/status', (req, res) => {
    res.json({ status: 'running', os: 'macOS' });
});

// Helper to get traceId from request
const getTraceId = (req) => {
    return req.headers['x-trace-id'] || req.body?.traceId || req.query?.traceId || 'no-trace';
};

// Timestamp helper for trace logs (HH:MM:SS.mmm)
const ts = () => {
    const now = new Date();
    return `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;
};

// Trace log helper with timestamp
const trace = (traceId, msg) => console.log(`[${ts()}][TRACE:${traceId}] ${msg}`);

// Execute Generic Command
app.post('/api/execute', async (req, res) => {
    const { action, params } = req.body;
    const traceId = getTraceId(req);
    console.log(`[TRACE:${traceId}] Command received: ${action}`, params);

    try {
        let result = '';
        switch (action) {
            case 'openApp':
                result = await openApp(params.appId);
                break;
            case 'closeApp':
                result = await closeApp(params.appId);
                break;
            case 'setVolume':
                result = await setVolume(params.level);
                break;
            case 'shortcut':
                // Send keyboard shortcut via AppleScript
                result = await sendShortcut(params.keys);
                break;
            case 'keystrokes':
                // Type keystrokes via AppleScript
                result = await typeKeystrokes(params.keys);
                break;
            case 'open_path':
                // Open file or folder
                result = await openPath(params.path);
                break;
            case 'click':
                // Click at coordinates
                result = await clickAt(params.x, params.y, params.button || 'left');
                break;
            case 'scroll':
                // Scroll using arrow key codes via AppleScript
                const scrollAmount = params.amount || 3;
                const direction = params.direction || 'down';
                const keyCode = direction === 'up' ? 126 : 125;  // Up=126, Down=125
                // Execute arrow key presses for scroll
                for (let i = 0; i < scrollAmount; i++) {
                    const scrollCmd = `osascript -e 'tell application "System Events" to key code ${keyCode}'`;
                    await execPromise(scrollCmd).catch(() => { });
                }
                result = `Scrolled ${direction} ${scrollAmount} times`;
                break;
            case 'eval':
                // CAUTION: Only acceptable for local MVP. 
                // Security risk if exposed to internet.
                result = await executeJXA(params.script);
                break;
            default:
                return res.status(400).json({ error: 'Unknown action' });
        }
        console.log(`[TRACE:${traceId}] Result:`, result);
        res.json({ success: true, result });
    } catch (error) {
        console.error(`[TRACE:${traceId}] Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Ollama API Proxy - Bypass CORS for browser requests
app.post('/api/ollama/chat', async (req, res) => {
    const traceId = getTraceId(req);
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1';
    const ollamaApiKey = process.env.OLLAMA_API_KEY || 'ollama';

    console.log(`[TRACE:${traceId}] Ollama proxy: ${ollamaBaseUrl}/chat/completions`);

    try {
        const response = await fetch(`${ollamaBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ollamaApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`[TRACE:${traceId}] Ollama API error:`, response.status, error);
            return res.status(response.status).json({ error: error });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error(`[TRACE:${traceId}] Ollama proxy error:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Ollama models endpoint
app.get('/api/ollama/models', async (req, res) => {
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1';
    const ollamaApiKey = process.env.OLLAMA_API_KEY || 'ollama';

    try {
        const response = await fetch(`${ollamaBaseUrl}/models`, {
            headers: {
                'Authorization': `Bearer ${ollamaApiKey}`,
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch models' });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Screenshot endpoint for vision-based commands
app.get('/api/screenshot', async (req, res) => {
    const traceId = getTraceId(req);
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    console.log(`[TRACE:${traceId}] Screenshot requested, VITE_DEBUG=${process.env.VITE_DEBUG}`);

    try {
        const timestamp = Date.now();
        const tmpFile = path.join(os.tmpdir(), `screenshot_${timestamp}.png`);
        const maskedFile = path.join(os.tmpdir(), `screenshot_${timestamp}_masked.png`);

        // Capture screenshot using macOS screencapture
        await execAsync(`screencapture -x ${tmpFile}`);

        // Get image dimensions
        const { stdout: sizeInfo } = await execAsync(`sips -g pixelWidth -g pixelHeight "${tmpFile}"`);
        const widthMatch = sizeInfo.match(/pixelWidth:\s*(\d+)/);
        const heightMatch = sizeInfo.match(/pixelHeight:\s*(\d+)/);
        const imgWidth = widthMatch ? parseInt(widthMatch[1]) : 1920;
        const imgHeight = heightMatch ? parseInt(heightMatch[1]) : 1080;

        // Always mask sensitive regions (menubar ~4%, dock ~8%, right menubar area)
        const menubarHeight = Math.ceil(imgHeight * 0.04);
        const dockHeight = Math.ceil(imgHeight * 0.08);
        const dockY = imgHeight - dockHeight;
        // Right side of menubar where most PII appears (clock, battery, WiFi name, etc.)
        const menubarRightX = Math.ceil(imgWidth * 0.5);

        // Use Python with PIL (already installed in backend) to add solid overlays
        // Write script to temp file to avoid shell escaping issues
        try {
            // First, copy original to masked file
            fs.copyFileSync(tmpFile, maskedFile);

            // Create Python script in temp file
            const scriptPath = path.join(os.tmpdir(), `mask_script_${timestamp}.py`);
            const pythonScript = `
import sys
from PIL import Image, ImageDraw
try:
    img = Image.open('${maskedFile}')
    draw = ImageDraw.Draw(img)
    
    # Mask top menubar with dark gray
    draw.rectangle([0, 0, ${imgWidth}, ${menubarHeight}], fill=(40, 40, 40))
    
    # Emphasize right side of menubar (where time, battery, WiFi name appear)
    draw.rectangle([${menubarRightX}, 0, ${imgWidth}, ${menubarHeight + 5}], fill=(30, 30, 30))
    
    # Mask bottom dock
    draw.rectangle([0, ${dockY}, ${imgWidth}, ${imgHeight}], fill=(40, 40, 40))
    
    img.save('${maskedFile}')
    print('OK')
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)
`;
            fs.writeFileSync(scriptPath, pythonScript);

            const { stdout, stderr } = await execAsync(`python3 "${scriptPath}"`);

            // Clean up script file
            fs.unlinkSync(scriptPath);

            if (stdout.includes('OK')) {
                console.log(`[TRACE:${traceId}] Applied solid masking to screenshot (menubar, dock)`);
            } else {
                throw new Error(stderr || stdout);
            }
        } catch (maskError) {
            console.log(`[TRACE:${traceId}] PIL masking failed: ${maskError.message}`);
            // Screenshot already copied as fallback
            console.log(`[TRACE:${traceId}] Fallback: screenshot copied without PIL masking`);
        }

        // Read masked image and convert to base64
        const imageData = fs.readFileSync(fs.existsSync(maskedFile) ? maskedFile : tmpFile);
        const base64 = imageData.toString('base64');

        // Debug: Save masked screenshot to logs
        if (process.env.VITE_DEBUG === 'true') {
            const debugDir = path.join(LOG_DIR, 'screenshots');
            if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir, { recursive: true });
            }
            // Use traceId in filename if available
            const filename = traceId !== 'no-trace'
                ? `${traceId}_${timestamp}_taken_masked.png`
                : `taken_${timestamp}_masked.png`;

            const debugFile = path.join(debugDir, filename);

            // Copy masked file and resize for debug log
            fs.copyFileSync(fs.existsSync(maskedFile) ? maskedFile : tmpFile, debugFile);

            // Resize for storage optimization
            try {
                await execAsync(`sips --resampleWidth 800 "${debugFile}"`);
                console.log(`[TRACE:${traceId}] Saved masked screenshot to ${debugFile}`);
            } catch (e) {
                console.log(`[TRACE:${traceId}] Saved screenshot to ${debugFile} (resize failed)`);
            }
        }

        // Clean up tmp files
        fs.unlinkSync(tmpFile);
        if (fs.existsSync(maskedFile)) fs.unlinkSync(maskedFile);

        res.json({
            success: true,
            image: base64,
            mimeType: 'image/png',
            masked: true
        });
    } catch (error) {
        console.error(`[TRACE:${traceId}] Screenshot error:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Click action endpoint
app.post('/api/click', async (req, res) => {
    const { x, y, button = 'left' } = req.body;
    const traceId = getTraceId(req);
    console.log(`[TRACE:${traceId}] Click received: (${x}, ${y}) button=${button}`);

    try {
        const result = await clickAt(x, y, button);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ====== OCR-BASED TEXT TARGETING (Phase 1) ======

// Click on visible text (fast, no VLM needed)
app.post('/api/click-text', async (req, res) => {
    const { query, button = 'left', doubleClick = false } = req.body;
    const traceId = getTraceId(req);
    console.log(`[TRACE:${traceId}] OCR click-text: "${query}"`);

    try {
        const result = await clickOnText(query, { button, doubleClick });
        if (result.success) {
            console.log(`[TRACE:${traceId}] OCR click success at (${result.coordinates?.x}, ${result.coordinates?.y})`);
            res.json(result);
        } else {
            console.log(`[TRACE:${traceId}] OCR click failed: ${result.error}`);
            res.status(404).json(result);
        }
    } catch (error) {
        console.error(`[TRACE:${traceId}] OCR click error:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Find text on screen (returns coordinates without clicking)
app.post('/api/find-text', async (req, res) => {
    const { query } = req.body;
    const traceId = getTraceId(req);
    console.log(`[TRACE:${traceId}] OCR find-text: "${query}"`);

    try {
        const regions = await findTextOnScreen(query);
        console.log(`[TRACE:${traceId}] OCR found ${regions.length} matches for "${query}"`);
        res.json({ success: true, query, matches: regions, count: regions.length });
    } catch (error) {
        console.error(`[TRACE:${traceId}] OCR find error:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Type at text label (click label then type)
app.post('/api/type-at-text', async (req, res) => {
    const { label, text } = req.body;
    const traceId = getTraceId(req);
    console.log(`[TRACE:${traceId}] OCR type-at-text: label="${label}", text="${text?.substring(0, 20)}..."`);

    try {
        const result = await ocrTypeText(text, label);
        if (result.success) {
            console.log(`[TRACE:${traceId}] OCR type success`);
            res.json(result);
        } else {
            console.log(`[TRACE:${traceId}] OCR type failed: ${result.error}`);
            res.status(404).json(result);
        }
    } catch (error) {
        console.error(`[TRACE:${traceId}] OCR type error:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ PHASE 2: Hybrid Routing with Cache ============

// In-memory UI cache (simple JS implementation for Node.js)
const uiCache = {
    entries: new Map(),  // (app|target) -> {x, y, timestamp}
    ttl: 300000,         // 5 minutes in ms
    hits: 0,
    misses: 0,

    get(app, target) {
        const key = `${app.toLowerCase()}|${target.toLowerCase()}`;
        const entry = this.entries.get(key);
        if (entry && Date.now() - entry.timestamp < this.ttl) {
            this.hits++;
            return { x: entry.x, y: entry.y };
        }
        if (entry) this.entries.delete(key);  // Expired
        this.misses++;
        return null;
    },

    set(app, target, x, y) {
        const key = `${app.toLowerCase()}|${target.toLowerCase()}`;
        this.entries.set(key, { x, y, timestamp: Date.now() });
    },

    stats() {
        const total = this.hits + this.misses;
        return {
            entries: this.entries.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? `${(this.hits / total * 100).toFixed(1)}%` : '0%'
        };
    },

    clear() {
        const count = this.entries.size;
        this.entries.clear();
        return count;
    }
};

// Hybrid click - routes to cache/OCR/VLM
app.post('/api/hybrid-click', async (req, res) => {
    const { command, app: appName = 'Unknown' } = req.body;
    const traceId = getTraceId(req);
    console.log(`[TRACE:${traceId}] Hybrid click: "${command}" in ${appName}`);

    try {
        // Extract click target from command
        const clickMatch = command.match(/^(?:click|tap|press|select)\s+(?:on\s+)?(?:the\s+)?(.+)$/i);
        if (!clickMatch) {
            console.log(`[TRACE:${traceId}] Not a click command, falling back to VLM`);
            res.json({ success: false, error: 'Not a click command', method: 'vlm_needed' });
            return;
        }

        const target = clickMatch[1].trim();
        const startTime = Date.now();

        // Level 1: Check cache
        const cached = uiCache.get(appName, target);
        if (cached) {
            const latency = Date.now() - startTime;
            console.log(`[TRACE:${traceId}] CACHE HIT: ${target} -> (${cached.x}, ${cached.y}) [${latency}ms]`);

            // Click at cached position
            await clickAt(cached.x, cached.y);

            res.json({
                success: true,
                target,
                x: cached.x,
                y: cached.y,
                method: 'cached',
                latencyMs: latency
            });
            return;
        }

        // Level 2: Try OCR
        console.log(`[TRACE:${traceId}] Cache miss, trying OCR for: ${target}`);
        const ocrResult = await clickOnText(target);
        const latency = Date.now() - startTime;

        if (ocrResult.success) {
            // Cache the result - coordinates are in ocrResult.coordinates
            const coords = ocrResult.coordinates || {};
            if (coords.x !== undefined && coords.y !== undefined) {
                uiCache.set(appName, target, coords.x, coords.y);
                console.log(`[TRACE:${traceId}] Cached: ${target} -> (${coords.x}, ${coords.y})`);
            }

            res.json({
                success: true,
                target,
                x: coords.x,
                y: coords.y,
                method: 'ocr',
                latencyMs: latency
            });
            return;
        }

        // Level 3: OCR failed, VLM would be needed
        console.log(`[TRACE:${traceId}] OCR failed, VLM needed [${latency}ms]`);
        res.json({
            success: false,
            target,
            error: 'OCR failed, VLM needed',
            method: 'vlm_needed',
            latencyMs: latency
        });

    } catch (error) {
        console.error(`[TRACE:${traceId}] Hybrid click error:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cache stats endpoint
app.get('/api/cache-stats', (req, res) => {
    res.json(uiCache.stats());
});

// Clear cache endpoint
app.post('/api/cache-clear', (req, res) => {
    const cleared = uiCache.clear();
    res.json({ success: true, cleared });
});

// ============ PHASE 4: Safety Confirmation System ============

// Check if an action needs confirmation
app.post('/api/safety-check', (req, res) => {
    const { command } = req.body;
    const traceId = getTraceId(req);

    const result = checkSafety(command);
    trace(traceId, `Safety check: "${command}" -> ${result.riskLevel}`);

    if (result.needsConfirmation) {
        const actionId = generateActionId();
        storePendingAction(actionId, { command, type: 'click' });
        res.json({
            ...result,
            actionId,
            expiresIn: 60  // seconds
        });
    } else {
        res.json(result);
    }
});

// Confirm or cancel a pending action
app.post('/api/confirm', async (req, res) => {
    const { actionId, confirmed } = req.body;
    const traceId = getTraceId(req);

    trace(traceId, `Confirm: actionId=${actionId}, confirmed=${confirmed}`);

    if (!actionId) {
        return res.status(400).json({ success: false, error: 'Missing actionId' });
    }

    const pendingAction = consumePendingAction(actionId);

    if (!pendingAction) {
        return res.status(404).json({
            success: false,
            error: 'Action not found or expired'
        });
    }

    if (!confirmed) {
        trace(traceId, `Action cancelled: ${pendingAction.command}`);
        return res.json({
            success: true,
            cancelled: true,
            message: 'Action cancelled'
        });
    }

    // Execute the confirmed action
    trace(traceId, `Action confirmed, executing: ${pendingAction.command}`);

    try {
        // For now, just return success - actual execution would call the appropriate action
        res.json({
            success: true,
            executed: true,
            command: pendingAction.command,
            message: `Confirmed and executed: ${pendingAction.command}`
        });
    } catch (error) {
        trace(traceId, `Confirmed action failed: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Debug: List all text detected on screen (for OCR testing)
app.get('/api/ocr-debug', async (req, res) => {
    const traceId = getTraceId(req);
    console.log(`[TRACE:${traceId}] OCR debug: listing all screen text`);

    try {
        // Get all text without filtering
        const regions = await findTextOnScreen('');
        res.json({ success: true, count: regions.length, texts: regions });
    } catch (error) {
        console.error(`[TRACE:${traceId}] OCR debug error:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Vision API endpoint for screenshot analysis (supports Ollama and Gemini)
app.post('/api/vision', async (req, res) => {
    const traceId = getTraceId(req);
    const llmProvider = process.env.LLM_PROVIDER || 'gemini';
    const { imageBase64, prompt, model = 'gemini-3-flash-preview' } = req.body;

    console.log(`[TRACE:${traceId}] Vision API: Processing with ${llmProvider}/${model}`);

    // Debug: Save sent screenshot to logs
    if (process.env.VITE_DEBUG === 'true' && imageBase64) {
        try {
            const timestamp = Date.now();
            const debugDir = path.join(LOG_DIR, 'screenshots');
            if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir, { recursive: true });
            }
            const buffer = Buffer.from(imageBase64, 'base64');

            const filename = traceId !== 'no-trace'
                ? `${traceId}_${timestamp}_vision_input.png`
                : `vision_input_${timestamp}.png`;

            const debugFile = path.join(debugDir, filename);
            fs.writeFileSync(debugFile, buffer);

            // Try to resize (async, don't block response too much)
            exec(`sips --resampleWidth 800 "${debugFile}"`, (err) => {
                if (!err) console.log(`[TRACE:${traceId}] Saved and resized vision input to ${debugFile}`);
            });

        } catch (err) {
            console.error(`[TRACE:${traceId}] Failed to save debug screenshot:`, err);
        }
    }

    try {
        let text = '';

        if (llmProvider === 'ollama') {
            // Use Ollama API with vision support
            const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1';
            const ollamaApiKey = process.env.OLLAMA_API_KEY || 'ollama';

            const response = await fetch(`${ollamaBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ollamaApiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            {
                                type: 'image_url',
                                image_url: { url: `data:image/png;base64,${imageBase64}` }
                            }
                        ]
                    }],
                    temperature: 0.1,
                    max_tokens: 1000  // Increased from 500 to prevent truncation
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[TRACE:${traceId}] Ollama Vision error:`, response.status, errorText);
                throw new Error(`Ollama Vision API error: ${response.status}`);
            }

            const data = await response.json();
            text = data.choices?.[0]?.message?.content || '';

        } else {
            // Use Gemini API
            const geminiApiKey = process.env.GEMINI_API_KEY;
            if (!geminiApiKey) {
                return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: 'image/png',
                                        data: imageBase64
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 500
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[TRACE:${traceId}] Gemini Vision error:`, response.status, errorText);
                throw new Error(`Gemini Vision API error: ${response.status}`);
            }

            const data = await response.json();
            text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        console.log(`[TRACE:${traceId}] Vision API response:`, text.substring(0, 200));
        res.json({ success: true, text });

    } catch (error) {
        console.error(`[TRACE:${traceId}] Vision API error:`, error);
        res.status(500).json({ error: error.message });
    }
});
// Vision-click with AUTO screenshot capture (server-side)
app.post('/api/vision-click-auto', async (req, res) => {
    const { target } = req.body;
    const traceId = getTraceId(req);

    if (!target) {
        return res.status(400).json({ found: false, error: 'Missing target' });
    }

    trace(traceId, `Vision-click-auto: "${target}" - capturing screenshot`);

    try {
        // Capture screenshot server-side
        const tmpFile = `/tmp/vision_${Date.now()}.png`;
        await new Promise((resolve, reject) => {
            exec(`screencapture -x "${tmpFile}"`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Resize to 800px width to reduce payload (5MB -> ~500KB)
        await new Promise((resolve, reject) => {
            exec(`sips --resampleWidth 800 "${tmpFile}"`, (err) => {
                if (err) console.warn(`[TRACE:${traceId}] Resize warning:`, err);
                resolve();  // Continue even if resize fails
            });
        });

        // Read and encode
        const imageBuffer = fs.readFileSync(tmpFile);
        const imageBase64 = imageBuffer.toString('base64');

        // Clean up
        fs.unlinkSync(tmpFile);

        trace(traceId, `Screenshot captured, size: ${imageBase64.length} chars`);

        // Forward to vision-click logic
        req.body.imageBase64 = imageBase64;

    } catch (err) {
        console.error(`[TRACE:${traceId}] Screenshot capture failed:`, err);
        return res.status(500).json({ found: false, error: 'Screenshot capture failed' });
    }

    // Continue with vision-click logic (call next handler)
    const { imageBase64 } = req.body;
    const llmProvider = process.env.LLM_PROVIDER || 'gemini';
    const model = process.env.LLM_MODEL || 'gemini-2.0-flash';

    trace(traceId, `Vision-click-auto: "${target}" via ${llmProvider}`);

    try {
        // Generate structured prompt
        const prompt = getClickElementPrompt(target);
        let text = '';

        if (llmProvider === 'ollama') {
            const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1';
            const ollamaApiKey = process.env.OLLAMA_API_KEY || 'ollama';

            const response = await fetch(`${ollamaBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ollamaApiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
                        ]
                    }],
                    temperature: 0.1,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`[TRACE:${traceId}] Ollama error:`, errText);
                throw new Error(`Ollama error: ${response.status}`);
            }
            const data = await response.json();
            text = data.choices?.[0]?.message?.content || '';

        } else {
            // Gemini
            const geminiApiKey = process.env.GEMINI_API_KEY;
            if (!geminiApiKey) {
                return res.status(500).json({ found: false, error: 'GEMINI_API_KEY not configured' });
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inline_data: { mime_type: 'image/png', data: imageBase64 } }
                            ]
                        }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
                    })
                }
            );

            if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
            const data = await response.json();
            text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        // Parse structured response
        const result = parseVisionResponse(text);
        trace(traceId, `Vision-click-auto result: ${JSON.stringify(result).substring(0, 200)}`);

        // Check confidence threshold before clicking
        if (result.found && result.confidence >= CONFIDENCE_THRESHOLD) {
            await clickAt(result.x, result.y);
            trace(traceId, `Vision-click-auto: Clicked at (${result.x}, ${result.y})`);
            result.clicked = true;
        } else if (result.found) {
            result.clicked = false;
            result.reason = `Confidence ${result.confidence} below threshold ${CONFIDENCE_THRESHOLD}`;
        }

        res.json(result);

    } catch (error) {
        trace(traceId, `Vision-click-auto error: ${error.message}`);
        res.status(500).json({ found: false, error: error.message });
    }
});

// Vision-powered click with structured JSON output (Phase 3)
app.post('/api/vision-click', async (req, res) => {
    const { target, imageBase64 } = req.body;
    const traceId = getTraceId(req);
    const llmProvider = process.env.LLM_PROVIDER || 'gemini';
    const model = process.env.LLM_MODEL || 'gemini-2.0-flash';

    console.log(`[TRACE:${traceId}] Vision-click: "${target}" via ${llmProvider}`);

    if (!target || !imageBase64) {
        return res.status(400).json({
            found: false,
            error: 'Missing target or imageBase64'
        });
    }

    try {
        // Generate structured prompt
        const prompt = getClickElementPrompt(target);
        let text = '';

        if (llmProvider === 'ollama') {
            const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1';
            const ollamaApiKey = process.env.OLLAMA_API_KEY || 'ollama';

            const response = await fetch(`${ollamaBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ollamaApiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
                        ]
                    }],
                    temperature: 0.1,
                    max_tokens: 1000
                })
            });

            if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
            const data = await response.json();
            text = data.choices?.[0]?.message?.content || '';

        } else {
            // Gemini
            const geminiApiKey = process.env.GEMINI_API_KEY;
            if (!geminiApiKey) {
                return res.status(500).json({ found: false, error: 'GEMINI_API_KEY not configured' });
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inline_data: { mime_type: 'image/png', data: imageBase64 } }
                            ]
                        }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
                    })
                }
            );

            if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
            const data = await response.json();
            text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        // Parse structured response
        const result = parseVisionResponse(text);
        console.log(`[TRACE:${traceId}] Vision-click result:`, JSON.stringify(result).substring(0, 200));

        // Check confidence threshold before clicking
        if (result.found && result.confidence >= CONFIDENCE_THRESHOLD) {
            await clickAt(result.x, result.y);
            console.log(`[TRACE:${traceId}] Vision-click: Clicked at (${result.x}, ${result.y}) with confidence ${result.confidence}`);
            result.clicked = true;
        } else if (result.found) {
            console.log(`[TRACE:${traceId}] Vision-click: Low confidence ${result.confidence}, threshold is ${CONFIDENCE_THRESHOLD}`);
            result.clicked = false;
            result.reason = `Confidence ${result.confidence} below threshold ${CONFIDENCE_THRESHOLD}`;
        }

        res.json(result);

    } catch (error) {
        console.error(`[TRACE:${traceId}] Vision-click error:`, error);
        res.status(500).json({ found: false, error: error.message });
    }
});

// ====== LOG API ENDPOINTS ======

// Log persistence endpoint (receives frontend errors)
app.post('/api/logs', (req, res) => {
    const { timestamp, level, message, data } = req.body;
    const logLine = `${timestamp} [${level.toUpperCase()}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;

    const logFile = path.join(LOG_DIR, 'frontend.log');
    fs.appendFileSync(logFile, logLine);

    res.json({ success: true });
});

// Console log capture endpoint (for VLA Agent error feedback)
const CONSOLE_LOG_FILE = path.join(LOG_DIR, 'console.jsonl');
let recentErrors = []; // In-memory cache for agent feedback

app.post('/api/logs/console', (req, res) => {
    const { logs } = req.body;
    if (!Array.isArray(logs)) {
        return res.status(400).json({ error: 'logs must be an array' });
    }

    try {
        // Write to file
        for (const log of logs) {
            fs.appendFileSync(CONSOLE_LOG_FILE, JSON.stringify(log) + '\n');

            // Cache errors for agent feedback
            if (log.level === 'error' || log.level === 'warn') {
                recentErrors.push(log);
                if (recentErrors.length > 50) recentErrors.shift();
            }
        }
        res.json({ success: true, received: logs.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent errors for agent self-correction
app.get('/api/logs/errors', (req, res) => {
    const count = parseInt(req.query.count) || 10;
    res.json({
        success: true,
        errors: recentErrors.slice(-count),
        total: recentErrors.length
    });
});

// Clear error cache (after agent successfully handles them)
app.post('/api/logs/errors/clear', (req, res) => {
    recentErrors = [];
    res.json({ success: true });
});


// Log analysis endpoint for maintenance
app.get('/api/logs/analyze', async (req, res) => {
    try {
        const logFiles = ['voiceos.log', 'voiceos_errors.log', 'frontend.log'];
        const errors = [];

        for (const file of logFiles) {
            const filePath = path.join(LOG_DIR, file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n').filter(l => l.includes('[ERROR]') || l.includes('[error]'));
                lines.forEach(line => {
                    errors.push({ source: file, message: line.trim() });
                });
            }
        }

        // Get unique errors (last 50)
        const uniqueErrors = [...new Set(errors.map(e => e.message))]
            .slice(-50)
            .map(msg => ({
                message: msg,
                count: errors.filter(e => e.message === msg).length
            }));

        res.json({
            success: true,
            totalErrors: errors.length,
            uniqueErrors: uniqueErrors.length,
            errors: uniqueErrors,
            suggestion: errors.length > 0
                ? 'Run LLM analysis with prompt: "Analyze these errors and suggest fixes"'
                : 'No errors found in logs'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Log file list
app.get('/api/logs/files', (req, res) => {
    try {
        const files = fs.readdirSync(LOG_DIR)
            .filter(f => f.endsWith('.log'))
            .map(f => ({
                name: f,
                size: fs.statSync(path.join(LOG_DIR, f)).size,
                modified: fs.statSync(path.join(LOG_DIR, f)).mtime
            }));
        res.json({ success: true, files });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ====== ANALYTICS API ENDPOINTS ======

const ANALYTICS_FILE = path.join(LOG_DIR, 'analytics.jsonl');

const MAX_LOG_SIZE = 1024 * 1024; // 1MB
const MAX_BACKUPS = 5;

// Helper: Rotate log files (e.g. log.jsonl -> log.jsonl.1)
function rotateLog(filePath) {
    if (!fs.existsSync(filePath)) return;

    try {
        const stats = fs.statSync(filePath);
        if (stats.size < MAX_LOG_SIZE) return;

        console.log(`Rotating log file: ${filePath}`);

        // Remove oldest backup
        const oldestBackup = `${filePath}.${MAX_BACKUPS}`;
        if (fs.existsSync(oldestBackup)) {
            fs.unlinkSync(oldestBackup);
        }

        // Shift backups (5->4, ..., 1->0)
        for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
            const current = `${filePath}.${i}`;
            const next = `${filePath}.${i + 1}`;
            if (fs.existsSync(current)) {
                fs.renameSync(current, next);
            }
        }

        // Rename current to .1
        fs.renameSync(filePath, `${filePath}.1`);
    } catch (e) {
        console.error('Log rotation error:', e);
    }
}

// Record analytics event
app.post('/api/analytics', (req, res) => {
    try {
        // Rotate if needed before writing
        rotateLog(ANALYTICS_FILE);

        const event = req.body;
        const line = JSON.stringify(event) + '\n';
        fs.appendFileSync(ANALYTICS_FILE, line);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Analytics summary
app.get('/api/analytics/summary', (req, res) => {
    try {
        if (!fs.existsSync(ANALYTICS_FILE)) {
            return res.json({ success: true, events: 0, summary: {} });
        }

        const content = fs.readFileSync(ANALYTICS_FILE, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l);
        const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

        const summary = {
            totalEvents: events.length,
            successCount: events.filter(e => e.success).length,
            failureCount: events.filter(e => !e.success).length,
            successRate: events.length ? (events.filter(e => e.success).length / events.length * 100).toFixed(1) + '%' : 'N/A',
            avgExecutionTime: events.length ? Math.round(events.reduce((s, e) => s + (e.executionTimeMs || 0), 0) / events.length) + 'ms' : 'N/A',
            topActions: Object.entries(events.reduce((acc, e) => {
                acc[e.parsedAction] = (acc[e.parsedAction] || 0) + 1;
                return acc;
            }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5),
            recentFailures: events.filter(e => !e.success).slice(-10).map(e => ({
                utterance: e.utterance,
                action: e.parsedAction,
                error: e.error
            }))
        };

        res.json({ success: true, summary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Self-improvement suggestions
app.get('/api/analytics/improvements', async (req, res) => {
    try {
        if (!fs.existsSync(ANALYTICS_FILE)) {
            return res.json({ success: true, suggestions: ['No data yet - use the app to collect analytics'] });
        }

        const content = fs.readFileSync(ANALYTICS_FILE, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l);
        const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

        const failures = events.filter(e => !e.success);
        const failurePatterns = {};

        failures.forEach(f => {
            const key = `${f.parsedAction}:${f.error || 'unknown'}`;
            if (!failurePatterns[key]) {
                failurePatterns[key] = { count: 0, examples: [] };
            }
            failurePatterns[key].count++;
            if (failurePatterns[key].examples.length < 3) {
                failurePatterns[key].examples.push(f.utterance);
            }
        });

        const suggestions = Object.entries(failurePatterns)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([pattern, data]) => ({
                pattern,
                count: data.count,
                examples: data.examples,
                suggestion: `Fix "${pattern.split(':')[0]}" action - fails ${data.count} times`
            }));

        res.json({
            success: true,
            totalFailures: failures.length,
            suggestions,
            llmPrompt: failures.length > 0
                ? `Analyze these VoiceOS failures and suggest improvements:\n${JSON.stringify(suggestions, null, 2)}`
                : 'No failures to analyze - system is working well!'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
