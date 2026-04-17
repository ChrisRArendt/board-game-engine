/**
 * Opt-in drag performance profiling for play / board.
 *
 * Enable HUD + move samples: `?perfDrag=1` or `localStorage.setItem('bge:perfDrag', '1')`.
 * Broader operation timings (flip, shuffle, …): `?perfOps=1` or `bge:perfOps` — see `boardPerf.ts`.
 *
 * Measures synchronous time inside `moveDragTo` (game.update + z-index emits).
 * Does not include layout/paint — use Chrome Performance panel for that.
 */
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import {
	initBoardPerfFromEnv,
	isBoardPerfRecordingEnabled,
	isDragHudEnabled,
	isPerfIngestEnabled
} from '$lib/debug/boardPerf';

const STORAGE_KEY = 'bge:perfDrag';
const MAX_SAMPLES = 200;

export const dragPerfHud = writable<DragPerfHudState | null>(null);

export type DragPerfHudState = {
	lastMs: number;
	avgMs: number;
	maxMs: number;
	minMs: number;
	samples: number;
	boardPieces: number;
	selectedMoving: number;
	editorSnap: boolean;
};

let samples: number[] = [];
let longTaskObserver: PerformanceObserver | null = null;

/** Call once from play layout onMount (browser). Also initializes `boardPerf` flags. */
export function initDragPerfFromEnv() {
	if (!browser) return;
	try {
		const sp = new URLSearchParams(window.location.search);
		if (sp.get('perfDrag') === '1') {
			localStorage.setItem(STORAGE_KEY, '1');
		}
	} catch {
		/* ignore */
	}
	initBoardPerfFromEnv();
	if (!isBoardPerfRecordingEnabled()) {
		dragPerfHud.set(null);
		return;
	}
	if (isPerfIngestEnabled()) {
		startLongTaskObserver();
	}
}

function startLongTaskObserver() {
	if (typeof PerformanceObserver === 'undefined') return;
	try {
		longTaskObserver = new PerformanceObserver((list) => {
			for (const e of list.getEntries()) {
				if (e.duration >= 50) {
					console.warn(
						`[dragPerf] Long task: ${e.duration.toFixed(0)}ms`,
						e.name || '(anonymous)'
					);
				}
			}
		});
		longTaskObserver.observe({ type: 'longtask', buffered: true } as PerformanceObserverInit);
	} catch {
		/* Safari / older: longtask not supported */
	}
}

/** True while drag timing samples are recorded (perfDrag and/or perfOps). */
export function isDragPerfEnabled(): boolean {
	return isBoardPerfRecordingEnabled();
}

/** After beginMoveDrag when moveDrag was actually set. */
export function dragPerfOnDragBegin() {
	if (!isBoardPerfRecordingEnabled()) return;
	samples = [];
	if (isDragHudEnabled()) {
		dragPerfHud.set({
			lastMs: 0,
			avgMs: 0,
			maxMs: 0,
			minMs: 0,
			samples: 0,
			boardPieces: 0,
			selectedMoving: 0,
			editorSnap: false
		});
	}
}

type RecordCtx = {
	pieceCount: number;
	selectedMoving: number;
	editorSnap: boolean;
};

export function dragPerfRecordMove(durationMs: number, ctx: RecordCtx) {
	if (!isBoardPerfRecordingEnabled()) return;
	samples.push(durationMs);
	if (samples.length > MAX_SAMPLES) samples.shift();

	const sum = samples.reduce((a, b) => a + b, 0);
	const avg = sum / samples.length;
	const max = Math.max(...samples);
	const min = Math.min(...samples);

	if (isDragHudEnabled()) {
		dragPerfHud.set({
			lastMs: durationMs,
			avgMs: Math.round(avg * 100) / 100,
			maxMs: Math.round(max * 100) / 100,
			minMs: Math.round(min * 100) / 100,
			samples: samples.length,
			boardPieces: ctx.pieceCount,
			selectedMoving: ctx.selectedMoving,
			editorSnap: ctx.editorSnap
		});
	}
}

export function dragPerfOnDragEnd() {
	if (!isBoardPerfRecordingEnabled()) return;
	if (samples.length === 0) {
		if (isDragHudEnabled()) dragPerfHud.set(null);
		return;
	}
	const sorted = [...samples].sort((a, b) => a - b);
	const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)];
	const sum = sorted.reduce((a, b) => a + b, 0);
	const summary = {
		samples: samples.length,
		avg: Math.round((sum / samples.length) * 100) / 100,
		min: sorted[0],
		max: sorted[sorted.length - 1],
		p95,
		hint: 'High avg with few pieces → check Svelte/render. Many pieces → O(n) map over all pieces each move. Editor snap → buildBoardSnapTargets every move.'
	};
	console.info('[dragPerf] Session summary (moveDragTo sync time, ms)', summary);
}

export function destroyDragPerf() {
	if (longTaskObserver) {
		longTaskObserver.disconnect();
		longTaskObserver = null;
	}
}
