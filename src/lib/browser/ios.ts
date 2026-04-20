import { browser } from '$app/environment';

/**
 * iPhone / iPad / iPadOS Safari (touch). Used to avoid patterns that reliably crash or hang
 * Mobile WebKit (mic/WebRTC on load, simultaneous heavy main-thread work).
 *
 * Piece image decode throttling: {@link scheduleAppleTouchPieceImageWarmup} in `iosPieceImageWarmup.ts`.
 */
export function isAppleTouchWebKit(): boolean {
	if (!browser || typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent || '';
	if (/iPhone|iPod/i.test(ua)) return true;
	if (/iPad/i.test(ua)) return true;
	/** iPadOS 13+ may report as MacIntel + touch */
	if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
	return false;
}

/**
 * Resuming voice after refresh calls `getUserMedia` without a tap — skip on Apple touch WebKit.
 */
export function allowVoiceAutoReconnectAfterRefresh(): boolean {
	return !isAppleTouchWebKit();
}

export async function yieldToNextFrame(): Promise<void> {
	if (!browser) return;
	await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/** Let Mobile WebKit paint before stacking more main-thread work (reduces tab kills under memory pressure). */
export async function appleStagingBarrier(): Promise<void> {
	if (!isAppleTouchWebKit()) return;
	await yieldToNextFrame();
	await yieldToNextFrame();
}
