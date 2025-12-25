import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import { executeJXA, openApp, closeApp, setVolume, sendShortcut, typeKeystrokes, openPath, clickAt } from './macos.js';

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
