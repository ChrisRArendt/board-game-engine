/**
 * Opt-in timing for board operations (flip, shuffle, spread, deal, arrange, …).
 *
 * Enable: `?perfOps=1` once (persists), or `localStorage.setItem('bge:perfOps', '1')`.
 * Disable: `localStorage.removeItem('bge:perfOps')` and reload.
 *
 * Drag move HUD + samples still use `bge:perfDrag` / `?perfDrag=1`.
 * When enabled, timings are logged to the console (`console.debug`).
 */
import { browser } from '$app/environment';

const KEY_OPS = 'bge:perfOps';
const KEY_DRAG = 'bge:perfDrag';

let hudDragEnabled = false;
/** True if operation timings should be recorded (console). */
let ingestEnabled = false;

export function initBoardPerfFromEnv(): void {
	if (!browser) return;
	try {
		const sp = new URLSearchParams(window.location.search);
		if (sp.get('perfOps') === '1') {
			localStorage.setItem(KEY_OPS, '1');
		}
		if (sp.get('perfDrag') === '1') {
			localStorage.setItem(KEY_DRAG, '1');
		}
	} catch {
		/* ignore */
	}
	hudDragEnabled = localStorage.getItem(KEY_DRAG) === '1';
	ingestEnabled = hudDragEnabled || localStorage.getItem(KEY_OPS) === '1';
}

export function isDragHudEnabled(): boolean {
	return hudDragEnabled;
}

export function isPerfIngestEnabled(): boolean {
	return ingestEnabled;
}

/** True while drag move samples should be recorded (for HUD and/or session ingest). */
export function isBoardPerfRecordingEnabled(): boolean {
	return hudDragEnabled || ingestEnabled;
}

export function ingestBoardOp(
	operation: string,
	durationMs: number,
	data?: Record<string, unknown>
): void {
	if (!browser || !ingestEnabled) return;
	console.debug('[bge perf]', operation, `${Math.round(durationMs * 100) / 100}ms`, data ?? {});
}

export function trackSyncOp(
	operation: string,
	getContext: () => Record<string, unknown>,
	fn: () => void
): void {
	if (!isPerfIngestEnabled()) {
		fn();
		return;
	}
	const t0 = performance.now();
	try {
		fn();
	} finally {
		ingestBoardOp(operation, performance.now() - t0, getContext());
	}
}

export async function trackAsyncOp<T>(
	operation: string,
	getContext: () => Record<string, unknown>,
	fn: () => Promise<T>
): Promise<T> {
	if (!isPerfIngestEnabled()) {
		return fn();
	}
	const t0 = performance.now();
	try {
		return await fn();
	} finally {
		ingestBoardOp(operation, performance.now() - t0, {
			...getContext(),
			async: true
		});
	}
}
