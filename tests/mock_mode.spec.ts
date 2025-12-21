
import { test, expect } from '@playwright/test';

test.describe('Mock Mode', () => {
    test('should connect using mock service and simulate interactions', async ({ page, context }) => {
        // Log console messages
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));

        // Grant permission for microphone
        await context.grantPermissions(['microphone'], { origin: 'http://localhost:3000' });

        // 1. Load app with mock query param
        await page.goto('/?mock=true');

        // 2. Grant permissions (MockGeminiService shouldn't fail even if real mic is blocked in headless, 
        //    but App.tsx requests it. Playwright can mock permission or we can rely on default behavior 
        //    which might fail on gum if not handled.
        //    However, App.tsx gum happens before service init. 
        //    Let's rely on Playwright context permission granting if needed, but for now just try.)

        // 3. Check for "VoiceOS: Connected" log or UI state change
        // Since we don't have a visible "Connected" text in UI (it's in console), 
        // we check if the "Listening..." text appears which indicates isVoiceActive=true.
        const statusText = page.getByText(/Listening.../);
        await expect(statusText).toBeVisible({ timeout: 10000 });

        // 4. Wait for the mock service to simulate "Thinking" or response
        // in MockGeminiService, we have a timeout of 2000ms for a greeting.
        // We can check console logs if needed, or see if the orb changes state.

        // 5. Wait for the simulated 'openApp' tool call (8 seconds)
        // This opens the 'notes' app.
        // We should check if the "Notes" window appears.
        // The mock service waits 8 seconds + some startup delat so let's give it 30s.
        try {
            const notesWindow = page.getByTestId('window-notes');
            await expect(notesWindow).toBeVisible({ timeout: 30000 });
        } catch (e) {
            console.log("TEST FAILURE - DUMPING HTML:");
            console.log(await page.content());
            throw e;
        }
    });
});
