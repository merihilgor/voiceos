/**
 * Vision Prompts - Specialized prompts for VLM-based UI interaction.
 * Used when OCR fails and visual understanding is needed.
 */

/**
 * Prompt for finding and clicking a specific UI element.
 * Returns structured JSON with coordinates.
 */
export function getClickElementPrompt(target) {
  return `Find "${target}" on this macOS screenshot. Return ONLY this JSON:
{"found":true,"x":123,"y":456,"confidence":0.9}
or
{"found":false}
No explanation, just JSON.`;
}

/**
 * Prompt for listing all clickable elements on screen.
 * Useful for debugging and UI exploration.
 */
export function getDescribeUIPrompt() {
  return `Analyze this macOS screenshot and list all clickable UI elements.

Return a JSON array of elements:
[
  {"text": "File", "x": 50, "y": 12, "type": "menu", "confidence": 0.95},
  {"text": "Save", "x": 200, "y": 100, "type": "button", "confidence": 0.9}
]

Include:
- Menu bar items (File, Edit, View, etc.)
- Buttons with text
- Links
- Icons with labels
- Clickable list items

CRITICAL: Return ONLY the JSON array. No explanation.`;
}

/**
 * Prompt for understanding current screen context.
 */
export function getContextPrompt() {
  return `Analyze this macOS screenshot and describe the current context.

Return JSON:
{
  "app": "Finder",
  "window_title": "Downloads",
  "state": "normal",
  "visible_actions": ["New Folder", "Open", "Delete"],
  "focused_element": "file list"
}

CRITICAL: Return ONLY the JSON object.`;
}

/**
 * Parse VLM response, handling markdown wrapping and errors.
 */
export function parseVisionResponse(text) {
  if (!text) return { found: false, error: 'Empty response' };

  // Remove markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[Vision] Failed to parse JSON:', cleaned.substring(0, 200));
    return { found: false, error: 'Invalid JSON response', raw: cleaned };
  }
}

/**
 * Confidence threshold for auto-clicking.
 */
export const CONFIDENCE_THRESHOLD = 0.8;
