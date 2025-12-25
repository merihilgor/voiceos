/**
 * MaskingService - Client-side PII detection and masking
 * 
 * Always-on masking for sensitive data before sending to remote LLMs.
 * Protects: emails, phone numbers, credit cards, IDs, IPs, URLs with credentials
 */

// Debug mode
const DEBUG = import.meta.env.VITE_DEBUG === 'true';

// PII patterns with descriptive tokens - GDPR and PCI-DSS compliant
const PII_PATTERNS: Array<{ pattern: RegExp; token: string; name: string }> = [
    // Email addresses (GDPR: personal identifier)
    {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
        token: '[EMAIL]',
        name: 'email'
    },
    // Credit card numbers (PCI-DSS: primary account number)
    {
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        token: '[CARD]',
        name: 'credit_card'
    },
    // CVV/CVC codes (PCI-DSS: card verification)
    {
        pattern: /\b(?:cvv|cvc|cvv2|cvc2)[\s:]*\d{3,4}\b/gi,
        token: '[CVV]',
        name: 'cvv'
    },
    // Card expiry dates (PCI-DSS)
    {
        pattern: /\b(?:0[1-9]|1[0-2])[\s\/\-]?(?:2[0-9]|[3-9][0-9])\b/g,
        token: '[EXPIRY]',
        name: 'card_expiry'
    },
    // Turkish ID (TC Kimlik - 11 digits starting with non-zero)
    {
        pattern: /\b[1-9]\d{10}\b/g,
        token: '[TC_ID]',
        name: 'turkish_id'
    },
    // Phone numbers (GDPR: personal contact)
    {
        pattern: /\b(?:\+?[1-9]\d{0,2}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{2}[-.\s]?\d{2}\b/g,
        token: '[PHONE]',
        name: 'phone'
    },
    // Alternative phone format
    {
        pattern: /\b\+?\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
        token: '[PHONE]',
        name: 'phone_alt'
    },
    // IP addresses (GDPR: online identifier)
    {
        pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
        token: '[IP]',
        name: 'ipv4'
    },
    // URLs with embedded credentials (security risk)
    {
        pattern: /\b(?:https?|ftp):\/\/[^\s:]+:[^\s@]+@[^\s]+\b/gi,
        token: '[URL_WITH_CREDS]',
        name: 'url_with_credentials'
    },
    // Social Security Number (GDPR: national ID)
    {
        pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
        token: '[SSN]',
        name: 'ssn'
    },
    // IBAN (GDPR: financial identifier)
    {
        pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b/gi,
        token: '[IBAN]',
        name: 'iban'
    },
    // Date of birth patterns (GDPR: personal data)
    {
        pattern: /\b(?:0?[1-9]|[12][0-9]|3[01])[-\/.](?:0?[1-9]|1[0-2])[-\/.](?:19|20)\d{2}\b/g,
        token: '[DOB]',
        name: 'date_of_birth'
    },
    // ISO format date of birth
    {
        pattern: /\b(?:19|20)\d{2}[-\/.](?:0?[1-9]|1[0-2])[-\/.](?:0?[1-9]|[12][0-9]|3[01])\b/g,
        token: '[DOB]',
        name: 'date_of_birth_iso'
    },
    // Passport numbers (GDPR: government ID)
    {
        pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
        token: '[PASSPORT]',
        name: 'passport'
    }
];

export interface MaskingResult {
    original: string;
    masked: string;
    detections: Array<{
        type: string;
        original: string;
        position: number;
    }>;
    hasPII: boolean;
}

export class MaskingService {
    private static instance: MaskingService;

    private constructor() {
        if (DEBUG) {
            console.log('[MaskingService] Initialized with', PII_PATTERNS.length, 'patterns');
        }
    }

    static getInstance(): MaskingService {
        if (!MaskingService.instance) {
            MaskingService.instance = new MaskingService();
        }
        return MaskingService.instance;
    }

    /**
     * Mask PII in text content.
     * @param text - Original text to mask
     * @returns MaskingResult with original, masked text, and detection details
     */
    maskText(text: string): MaskingResult {
        if (!text || typeof text !== 'string') {
            return {
                original: text || '',
                masked: text || '',
                detections: [],
                hasPII: false
            };
        }

        let masked = text;
        const detections: MaskingResult['detections'] = [];

        for (const { pattern, token, name } of PII_PATTERNS) {
            // Reset regex state for global patterns
            pattern.lastIndex = 0;

            let match;
            while ((match = pattern.exec(text)) !== null) {
                detections.push({
                    type: name,
                    original: match[0],
                    position: match.index
                });
            }

            // Replace all matches
            pattern.lastIndex = 0;
            masked = masked.replace(pattern, token);
        }

        if (DEBUG && detections.length > 0) {
            console.log('[MaskingService] Detected PII:', detections.map(d => d.type));
        }

        return {
            original: text,
            masked,
            detections,
            hasPII: detections.length > 0
        };
    }

    /**
     * Mask PII in an object (recursively masks string values).
     * Useful for masking analytics payloads.
     */
    maskObject<T extends Record<string, any>>(obj: T): T {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        const masked = { ...obj } as T;

        for (const key of Object.keys(masked)) {
            const value = masked[key as keyof T];

            if (typeof value === 'string') {
                (masked as any)[key] = this.maskText(value).masked;
            } else if (typeof value === 'object' && value !== null) {
                (masked as any)[key] = this.maskObject(value);
            }
        }

        return masked;
    }

    /**
     * Check if text contains any PII without masking.
     */
    containsPII(text: string): boolean {
        if (!text) return false;

        for (const { pattern } of PII_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(text)) {
                return true;
            }
        }
        return false;
    }
}

// Export singleton instance
export const maskingService = MaskingService.getInstance();
export default maskingService;
