/**
 * Limits for uploaded game media (browser WebP pipeline in `encodeImageToWebpInBrowser.ts`).
 *
 * `MAX_RESULT_EDGE_PX` caps the longer side so pathological images do not blow tab memory.
 * It is **not** a small “screen only” cap — at 300 DPI, 8192px is about 27.3 inches.
 */
export const MAX_RESULT_EDGE_PX = 8192;

/** WebP quality for stored uploads (lossy but strong for print artwork), 1–100 scale. */
export const UPLOAD_WEBP_QUALITY = 90;

/** Reject inputs larger than this before decode (bytes); full file is held in memory once. */
export const MAX_UPLOAD_BYTES = 45 * 1024 * 1024;
