import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { executeJXA, openApp, closeApp, setVolume, sendShortcut, typeKeystrokes, openPath, clickAt } from './macos.js';

const app = express();
const PORT = 3001;

app.use(cors());
// Increase body size limit for screenshots (default is 100kb)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// API Status
app.get('/api/status', (req, res) => {
    res.json({ status: 'running', os: 'macOS' });
});

// Execute Generic Command
app.post('/api/execute', async (req, res) => {
    const { action, params } = req.body;
    console.log(`Command received: ${action}`, params);

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
            case 'eval':
                // CAUTION: Only acceptable for local MVP. 
                // Security risk if exposed to internet.
                result = await executeJXA(params.script);
                break;
            default:
                return res.status(400).json({ error: 'Unknown action' });
        }
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ollama API Proxy - Bypass CORS for browser requests
app.post('/api/ollama/chat', async (req, res) => {
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1';
    const ollamaApiKey = process.env.OLLAMA_API_KEY || 'ollama';

    console.log(`Ollama proxy: ${ollamaBaseUrl}/chat/completions`);

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
            console.error('Ollama API error:', response.status, error);
            return res.status(response.status).json({ error: error });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Ollama proxy error:', error.message);
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
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    try {
        const tmpFile = path.join(os.tmpdir(), `screenshot_${Date.now()}.png`);

        // Capture screenshot using macOS screencapture
        await execAsync(`screencapture -x ${tmpFile}`);

        // Read and convert to base64
        const imageData = fs.readFileSync(tmpFile);
        const base64 = imageData.toString('base64');

        // Clean up
        fs.unlinkSync(tmpFile);

        res.json({
            success: true,
            image: base64,
            mimeType: 'image/png'
        });
    } catch (error) {
        console.error('Screenshot error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Click action endpoint
app.post('/api/click', async (req, res) => {
    const { x, y, button = 'left' } = req.body;
    console.log(`Click received: (${x}, ${y}) button=${button}`);

    try {
        const result = await clickAt(x, y, button);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Vision API endpoint for screenshot analysis (supports Ollama and Gemini)
app.post('/api/vision', async (req, res) => {
    const llmProvider = process.env.LLM_PROVIDER || 'gemini';
    const { imageBase64, prompt, model = 'gemini-3-flash-preview' } = req.body;

    console.log(`Vision API: Processing with ${llmProvider}/${model}`);

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
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Ollama Vision error:', response.status, errorText);
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
                console.error('Gemini Vision error:', response.status, errorText);
                throw new Error(`Gemini Vision API error: ${response.status}`);
            }

            const data = await response.json();
            text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        console.log('Vision API response:', text.substring(0, 200));
        res.json({ success: true, text });

    } catch (error) {
        console.error('Vision API error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
