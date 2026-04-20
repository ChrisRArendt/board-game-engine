import { browser } from '$app/environment';
import { writable } from 'svelte/store';

/** Latest JSON blob — inspect in Application → Session Storage or use Copy in the HUD */
export const PLAY_PROFILE_STORAGE_KEY = 'bge_play_profile_last';

let t0 = 0;
let last = 0;

type Mark = { phase: string; deltaMs: number; totalMs: number };
let marks: Mark[] = [];

function profilingEnabled(): boolean {
	if (!browser) return false;
	try {
		if (sessionStorage.getItem('bge_play_load_profile') === '1') return true;
	} catch {
		/* ignore */
	}
	try {
		return new URLSearchParams(window.location.search).has('bge_profile');
	} catch {
		return false;
	}
}

/** Lines shown in the on-screen HUD (and mirrored to console). */
export const playLoadProfileLines = writable<string[]>([]);

function persistSnapshot(): void {
	if (!browser) return;
	try {
		sessionStorage.setItem(
			PLAY_PROFILE_STORAGE_KEY,
			JSON.stringify({
				capturedAt: Date.now(),
				href: window.location.href,
				userAgent: navigator.userAgent,
				marks: [...marks]
			})
		);
	} catch {
		/* quota / private mode */
	}
}

/** True when `?bge_profile=1` or sessionStorage `bge_play_load_profile=1`. */
export function isPlayLoadProfilingEnabled(): boolean {
	return profilingEnabled();
}

/** Last persisted JSON string (for clipboard / debugging). */
export function getLastPlayLoadProfileJson(): string | null {
	if (!browser) return null;
	try {
		return sessionStorage.getItem(PLAY_PROFILE_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function playLoadProfileReset(): void {
	marks = [];
	playLoadProfileLines.set([]);
}

/** Call once at start of play mount async init. */
export function playLoadProfileStart(): void {
	if (!profilingEnabled()) return;
	marks = [];
	t0 = performance.now();
	last = t0;
	playLoadProfileLines.set([`0ms start (t=0)`]);
	persistSnapshot();
	console.info('[bge-play] load profile start');
}

/** Log time since previous mark (and total since start). */
export function playLoadMark(phase: string): void {
	if (!profilingEnabled()) return;
	const now = performance.now();
	const deltaMs = now - last;
	const totalMs = now - t0;
	last = now;
	marks.push({ phase, deltaMs, totalMs });
	const line = `${phase} +${deltaMs.toFixed(1)}ms (Σ ${totalMs.toFixed(1)}ms)`;
	playLoadProfileLines.update((a) => [...a, line]);
	console.info(`[bge-play] ${phase} +${deltaMs.toFixed(1)}ms (total ${totalMs.toFixed(1)}ms)`);
	persistSnapshot();
}
