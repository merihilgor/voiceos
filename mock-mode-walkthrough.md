# Mock Mode & Stability Fixes

I have implemented a **Mock Mode** for VoiceOS to allow development and testing even when the Gemini API quota is exceeded. I also fixed a critical bug where application windows were not rendering.

## Changes

### 1. Mock Mode (`?mock=true`)
- **New Service**: `src/services/MockGeminiService.ts` simulates the Gemini Live API.
- **Behavior**:
    - Connects immediately without an API key.
    - Simulates a "Listening" state.
    - After 2 seconds, speaks a greeting.
    - After 8 seconds, automatically opens the **Notes** app (for testing).
- **Usage**: Add `?mock=true` to your URL (e.g., `http://localhost:3000/?mock=true`), or set `VITE_MOCK_MODE=true` in `.env.local`.

### 2. UI Fixes
- **Restored Window Rendering**: The desktop layer was missing from `App.tsx`. I added the mapping logic to render `WindowFrame` components, so opening apps now correctly shows the window.
- **Local App Execution**: Modified `App.tsx` to handle `openApp` commands locally in the UI state, ensuring responsiveness even without a backend connection.

### 3. Automated Testing
- **New Test**: `tests/mock_mode.spec.ts` verifies the full loop:
    1. Loads app in Mock Mode.
    2. Grants microphone permissions.
    3. Connects successfully.
    4. Waits for the simulated "Open Notes" command.
    5. Verifies the "Notes" window appears.

## Verification

The Mock Mode flow was verified using Playwright:

```bash
npx playwright test tests/mock_mode.spec.ts
```

Result: `1 passed`

## How to Run

1.  Start the app:
    ```bash
    npm run dev
    ```
2.  Open in browser:
    *   **Default**: If `VITE_MOCK_MODE=true` is set, it opens in Mock Mode.
    *   **Manual**: Add `?mock=true` to force it: **[http://localhost:3000/?mock=true](http://localhost:3000/?mock=true)**
