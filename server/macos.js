import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Execute raw JXA (JavaScript for Automation)
export async function executeJXA(script) {
    try {
        // Escape single quotes for shell safety if needed, 
        // but typically we pass the script via -e
        // For complex scripts, writing to a temp file is safer, but -e works for simple commands.
        // NOTE: osascript -l JavaScript -e "..."

        // We'll use specific implementations for known safe commands to avoid arbitrary code execution risks 
        // in this MVP phase, or careful validation.

        const command = `osascript -l JavaScript -e '${script}'`;
        const { stdout, stderr } = await execPromise(command);

        if (stderr) console.error('JXA Stderr:', stderr);
        return stdout.trim();
    } catch (error) {
        console.error('JXA Error:', error);
        throw error;
    }
}

// Helper to open an app by name
export async function openApp(appName) {
    const script = `Application('${appName}').activate()`;
    return executeJXA(script);
}

// Helper to close an app by name
export async function closeApp(appName) {
    const script = `Application('${appName}').quit()`;
    return executeJXA(script);
}

// Helper to set volume output (0-100)
export async function setVolume(level) {
    const script = `Application('System Events').soundVolume = ${level}`;
    return executeJXA(script);
}

// Helper: General AppleScript execution if needed (legacy)
export async function executeAppleScript(script) {
    const command = `osascript -e '${script}'`;
    const { stdout } = await execPromise(command);
    return stdout.trim();
}
