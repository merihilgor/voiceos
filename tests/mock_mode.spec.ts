
import { test, expect } from '@playwright/test';

test.describe('Mock Mode', () => {
    test('should connect using mock service and respond to text commands', async ({ page, context }) => {
        // Log console messages
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));

        // Grant permission for microphone
        await context.grantPermissions(['microphone'], { origin: 'http://localhost:3000' });

        // 1. Load app with mock query param
        await page.goto('/?mock=true');

        // 2. Check for "Listening..." text which indicates isVoiceActive=true
        const statusText = page.getByText(/Listening.../);
        await expect(statusText).toBeVisible({ timeout: 10000 });

        // 3. Interact with Mock Input
        // Wait for input to appear (it might need a moment to render)
        const input = page.getByPlaceholder('Type a simulated command...');
        await expect(input).toBeVisible();

        // Type "open calculator"
        await input.fill('open calculator');
        await input.press('Enter');

        // 4. Verify Calculator Opens
        try {
            const calcWindow = page.getByTestId('window-calculator');
            await expect(calcWindow).toBeVisible({ timeout: 10000 });
        } catch (e) {
            console.log("TEST FAILURE - DUMPING HTML:");
            console.log(await page.content());
            throw e;
        }
    });
});
