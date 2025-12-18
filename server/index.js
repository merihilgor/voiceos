import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { executeJXA, openApp, closeApp, setVolume } from './macos.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

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

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
