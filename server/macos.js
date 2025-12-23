import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Execute raw JXA (JavaScript for Automation)
export async function executeJXA(script) {
    try {
        // Escape single quotes for shell: ' -> '\''  (end quote, escaped quote, start quote)
        const escapedScript = script.replace(/'/g, "'\\''")
        const command = `osascript -l JavaScript -e '${escapedScript}'`;
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
    // Legacy: const script = `Application('${appName}').activate()`;
    // return executeJXA(script);

    // Safer/Simpler implementation (does not require JXA/AppleEvents permission, just LaunchServices)
    const command = `open -a "${appName}"`;
    const { stdout } = await execPromise(command);
    return stdout;
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

// Helper: Send keyboard shortcut (cmd+key, shift+cmd+key, etc.)
export async function sendShortcut(keys) {
    // Parse shortcut like "cmd+shift+g"
    const parts = keys.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    let modifierStr = '';
    if (modifiers.includes('cmd') || modifiers.includes('command')) modifierStr += 'command down, ';
    if (modifiers.includes('shift')) modifierStr += 'shift down, ';
    if (modifiers.includes('alt') || modifiers.includes('option')) modifierStr += 'option down, ';
    if (modifiers.includes('ctrl') || modifiers.includes('control')) modifierStr += 'control down, ';
    modifierStr = modifierStr.replace(/, $/, '');

    let script;
    if (modifierStr) {
        script = `tell application "System Events" to keystroke "${key}" using {${modifierStr}}`;
    } else {
        script = `tell application "System Events" to keystroke "${key}"`;
    }

    console.log(`Sending shortcut: ${keys} -> ${script}`);
    const command = `osascript -e '${script}'`;
    const { stdout } = await execPromise(command);
    return stdout.trim() || `Shortcut ${keys} executed`;
}

// Helper: Type keystrokes (text)
export async function typeKeystrokes(keys) {
    // Handle enter/return
    const hasEnter = keys.includes('\\n') || keys.includes('\n');
    let text = keys.replace(/\\n/g, '').replace(/\n/g, '');

    if (text) {
        // Escape special characters for AppleScript
        const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const script = `tell application "System Events" to keystroke "${escaped}"`;
        const command = `osascript -e '${script}'`;
        await execPromise(command);
    }

    if (hasEnter) {
        // Press Enter/Return key
        const script = `tell application "System Events" to key code 36`;
        const command = `osascript -e '${script}'`;
        await execPromise(command);
    }

    return `Typed: ${keys}`;
}

// Helper: Open file or folder by path
export async function openPath(path) {
    // Expand ~ to home directory
    const expandedPath = path.replace(/^~/, process.env.HOME || '');
    console.log(`Opening path: ${path} -> ${expandedPath}`);

    const command = `open "${expandedPath}"`;
    const { stdout } = await execPromise(command);
    return stdout.trim() || `Opened: ${path}`;
}

// Helper: Click at screen coordinates
export async function clickAt(x, y, button = 'left') {
    // Use cliclick for reliable mouse clicking (brew install cliclick)
    // Fallback to AppleScript if not available

    try {
        // Try cliclick first (more reliable)
        const clickType = button === 'right' ? 'rc' : 'c';
        const command = `cliclick ${clickType}:${x},${y}`;
        const { stdout } = await execPromise(command);
        return stdout.trim() || `Clicked at (${x}, ${y})`;
    } catch (error) {
        // Fallback to AppleScript
        console.log('cliclick not available, using AppleScript fallback');

        const script = `
            tell application "System Events"
                set mousePos to {${x}, ${y}}
                do shell script "python3 -c \\"import Quartz; Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, (${x}, ${y}), Quartz.kCGMouseButtonLeft)); Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, (${x}, ${y}), Quartz.kCGMouseButtonLeft))\\""
            end tell
        `;

        const osascriptCmd = `osascript -e '${script.replace(/'/g, "'\\''")}'`;
        try {
            await execPromise(osascriptCmd);
            return `Clicked at (${x}, ${y}) via AppleScript`;
        } catch (asError) {
            // Last resort: use Python directly
            const pythonCmd = `python3 -c "import Quartz; Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, (${x}, ${y}), Quartz.kCGMouseButtonLeft)); Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, (${x}, ${y}), Quartz.kCGMouseButtonLeft))"`;
            await execPromise(pythonCmd);
            return `Clicked at (${x}, ${y}) via Python`;
        }
    }
}
