# Mock Mode & Stability Fixes

I have implemented a **Mock Mode** for VoiceOS to allow development and testing even when the Gemini API quota is exceeded.

## Interactive Mock Mode (`?mock=true`)

When you run `npm run dev`, the app starts in Mock Mode by default (configured via `.env.local`).

### Features
1.  **Text Input Simulation**: A standard text box appears below the "Listening..." indicator.
2.  **App Control**: You can type commands like **"Open Calculator"** or **"Open Notes"** to simulate voice commands.
3.  **No API Key Needed**: This mode works entirely offline.

### Included Apps for Testing
- **Calculator**: (New) Created specifically for testing interactive commands.
- **Notes**: Standard test app.
- **Terminal, Browser, Gallery, Music, System**: Also available.

## Verification

You can verify the functionality by running the end-to-end test:

```bash
npx playwright test tests/mock_mode.spec.ts
```

Result: `1 passed` (Tested typing "open calculator" -> Verification that Calculator Window appears).

## How to Run

1.  Start the app:
    ```bash
    npm run dev
    ```
2.  Open **[http://localhost:3000](http://localhost:3000)**
3.  Type `open calculator` in the input box and press Enter.
