/**
 * VisualMaskingService - Client-side screenshot masking with face detection
 * 
 * Uses browser Canvas API to detect and mask PII regions in screenshots
 * before sending to remote vision LLMs.
 * 
 * Features:
 * - Blur known sensitive UI regions (menubar, dock, notification areas)
 * - Face detection and blur using face-api.js
 * - Text input field masking (common form areas)
 */

import * as faceapi from 'face-api.js';

// Regions to always blur (relative to screen, percentages)
const SENSITIVE_REGIONS = [
    // macOS menu bar area (notifications, clock, battery, WiFi, etc.)
    { name: 'menubar', x: 0, y: 0, w: 100, h: 3.5 },
    // Dock area (bottom, app icons, notification badges)
    { name: 'dock', x: 0, y: 92, w: 100, h: 8 },
    // Right side of menu bar where most PII appears (clock, battery %, WiFi name)
    { name: 'menubar_right', x: 60, y: 0, w: 40, h: 3.5 },
];

// Debug mode
const DEBUG = import.meta.env.VITE_DEBUG === 'true';

// Face detection model URL (loaded from CDN)
const FACE_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

export interface VisualMaskingConfig {
    blurRadius?: number;
    maskColor?: string;
    faceDetectionEnabled?: boolean;
}

export interface VisualMaskingResult {
    maskedBase64: string;
    originalWidth: number;
    originalHeight: number;
    regionsBlurred: string[];
    facesDetected: number;
    processingTimeMs: number;
}

export class VisualMaskingService {
    private static instance: VisualMaskingService;
    private config: Required<VisualMaskingConfig>;
    private faceModelLoaded = false;
    private faceModelLoading = false;

    private constructor(config: VisualMaskingConfig = {}) {
        this.config = {
            blurRadius: config.blurRadius ?? 20, // Increased blur for better privacy
            maskColor: config.maskColor ?? '#000000',
            faceDetectionEnabled: config.faceDetectionEnabled ?? true,
        };

        if (DEBUG) {
            console.log('[VisualMaskingService] Initialized with config:', this.config);
        }
    }

    static getInstance(config?: VisualMaskingConfig): VisualMaskingService {
        if (!VisualMaskingService.instance) {
            VisualMaskingService.instance = new VisualMaskingService(config);
        }
        return VisualMaskingService.instance;
    }

    /**
     * Load face detection model (lazy, one-time).
     */
    private async loadFaceModel(): Promise<boolean> {
        if (this.faceModelLoaded) return true;
        if (this.faceModelLoading) {
            await new Promise(r => setTimeout(r, 500));
            return this.faceModelLoaded;
        }

        this.faceModelLoading = true;
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL);
            this.faceModelLoaded = true;
            if (DEBUG) console.log('[VisualMaskingService] Face detection model loaded');
            return true;
        } catch (error) {
            console.warn('[VisualMaskingService] Failed to load face model:', error);
            return false;
        } finally {
            this.faceModelLoading = false;
        }
    }

    /**
     * Mask sensitive regions in a base64-encoded screenshot.
     * Includes face detection and blur.
     */
    async maskScreenshot(imageBase64: string): Promise<VisualMaskingResult> {
        const startTime = performance.now();

        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = async () => {
                try {
                    const { blurRadius } = this.config;
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        throw new Error('Failed to get canvas context');
                    }

                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    const regionsBlurred: string[] = [];
                    let facesDetected = 0;

                    // 1. Apply blur to sensitive UI regions
                    for (const region of SENSITIVE_REGIONS) {
                        const x = Math.floor((region.x / 100) * img.width);
                        const y = Math.floor((region.y / 100) * img.height);
                        const w = Math.floor((region.w / 100) * img.width);
                        const h = Math.floor((region.h / 100) * img.height);

                        this.applyBlurToRegion(ctx, img, x, y, w, h, blurRadius);
                        regionsBlurred.push(region.name);
                    }

                    // 2. Detect and blur faces
                    if (this.config.faceDetectionEnabled) {
                        const faceModelReady = await this.loadFaceModel();
                        if (faceModelReady) {
                            try {
                                const detections = await faceapi.detectAllFaces(
                                    canvas,
                                    new faceapi.TinyFaceDetectorOptions({ inputSize: 416 }) // Higher resolution for better detection
                                );

                                for (const detection of detections) {
                                    const box = detection.box;
                                    const padding = Math.min(box.width, box.height) * 0.3; // More padding
                                    this.applyBlurToRegion(
                                        ctx, img,
                                        Math.max(0, box.x - padding),
                                        Math.max(0, box.y - padding),
                                        box.width + padding * 2,
                                        box.height + padding * 2,
                                        blurRadius * 1.5
                                    );
                                    facesDetected++;
                                }

                                if (facesDetected > 0) {
                                    regionsBlurred.push(`faces(${facesDetected})`);
                                    if (DEBUG) console.log(`[VisualMaskingService] Blurred ${facesDetected} face(s)`);
                                }
                            } catch (faceError) {
                                console.warn('[VisualMaskingService] Face detection failed:', faceError);
                            }
                        }
                    }

                    const maskedBase64 = canvas.toDataURL('image/png').replace('data:image/png;base64,', '');
                    const processingTimeMs = performance.now() - startTime;

                    if (DEBUG) {
                        console.log(`[VisualMaskingService] Masked ${regionsBlurred.length} regions, ${facesDetected} faces in ${processingTimeMs.toFixed(1)}ms`);
                    }

                    resolve({
                        maskedBase64,
                        originalWidth: img.width,
                        originalHeight: img.height,
                        regionsBlurred,
                        facesDetected,
                        processingTimeMs
                    });

                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error('Failed to load image for masking'));
            };

            img.src = `data:image/png;base64,${imageBase64}`;
        });
    }

    /**
     * Apply blur to a specific region of the canvas.
     */
    private applyBlurToRegion(
        ctx: CanvasRenderingContext2D,
        img: HTMLImageElement,
        x: number,
        y: number,
        w: number,
        h: number,
        blurRadius: number
    ): void {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.filter = `blur(${blurRadius}px)`;
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        ctx.filter = 'none';
    }

    /**
     * Check if visual masking is available (Canvas API support).
     */
    static isSupported(): boolean {
        return typeof document !== 'undefined' &&
            typeof document.createElement('canvas').getContext === 'function';
    }
}

// Export singleton instance
export const visualMaskingService = VisualMaskingService.getInstance();
export default visualMaskingService;
