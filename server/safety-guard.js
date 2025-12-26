/**
 * Safety Guard - Detects destructive actions that require user confirmation.
 */

// Patterns that indicate destructive/risky actions
const DESTRUCTIVE_PATTERNS = [
    // File operations
    /\b(delete|remove|trash|erase|empty)\b/i,
    /\b(permanently|forever)\b/i,

    // System operations
    /\b(quit all|shutdown|restart|reboot)\b/i,
    /\b(format|wipe|overwrite)\b/i,

    // Data operations
    /\b(clear all|reset|factory)\b/i,
    /\b(uninstall|remove app)\b/i,
];

// Patterns for high-risk actions (require explicit confirmation)
const HIGH_RISK_PATTERNS = [
    /\bempty trash\b/i,
    /\bformat disk\b/i,
    /\bfactory reset\b/i,
    /\bdelete all\b/i,
];

/**
 * Check if a command needs confirmation before execution.
 * @param {string} command - The command text
 * @returns {{needsConfirmation: boolean, riskLevel: string, prompt: string}}
 */
export function checkSafety(command) {
    const isHighRisk = HIGH_RISK_PATTERNS.some(p => p.test(command));
    const isDestructive = DESTRUCTIVE_PATTERNS.some(p => p.test(command));

    if (isHighRisk) {
        return {
            needsConfirmation: true,
            riskLevel: 'high',
            prompt: `⚠️ HIGH RISK: "${command}" cannot be undone. Are you sure?`,
            command
        };
    }

    if (isDestructive) {
        return {
            needsConfirmation: true,
            riskLevel: 'medium',
            prompt: `Confirm: "${command}"?`,
            command
        };
    }

    return {
        needsConfirmation: false,
        riskLevel: 'low',
        prompt: null,
        command
    };
}

// Store pending confirmations (in-memory, cleared on restart)
const pendingActions = new Map();

/**
 * Store an action pending confirmation.
 * @param {string} actionId - Unique ID for this action
 * @param {object} action - The action to store
 */
export function storePendingAction(actionId, action) {
    pendingActions.set(actionId, {
        ...action,
        timestamp: Date.now()
    });

    // Auto-expire after 60 seconds
    setTimeout(() => pendingActions.delete(actionId), 60000);
}

/**
 * Get and remove a pending action.
 * @param {string} actionId - The action ID
 * @returns {object|null} The action or null if not found/expired
 */
export function consumePendingAction(actionId) {
    const action = pendingActions.get(actionId);
    if (action) {
        pendingActions.delete(actionId);
        return action;
    }
    return null;
}

/**
 * Generate a unique action ID.
 */
export function generateActionId() {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
