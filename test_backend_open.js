
import { openApp } from './server/macos.js';

console.log("Testing openApp('Calculator')...");
try {
    const result = await openApp('Calculator');
    console.log("Success! Output:", result);
} catch (error) {
    console.error("FAILED:", error);
}
