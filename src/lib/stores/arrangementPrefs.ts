import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { PlacementLayout } from '$lib/engine/types';
import type { PlacementSpacingMode } from '$lib/editor/placementLayouts';

const STORAGE_KEY = 'bge_arrangement_prefs';

const LAYOUTS = new Set<PlacementLayout>(['stack', 'grid', 'honeycomb', 'fan', 'pile']);
const SPACINGS = new Set<PlacementSpacingMode>(['overlap', 'separate']);

/** 16 directions for assist / linear spread; matches {@link spreadCustom} in engine (deg). */
export const SPREAD_ANGLE_STEP_DEG = 22.5;
export const SPREAD_DIRECTION_COUNT = 16;

export interface ArrangementPrefs {
	layout: PlacementLayout;
	spacingMode: PlacementSpacingMode;
	cols: number;
	offset: number;
	/** When applying arrangement, show card front (true) or back (false) for flip-capable pieces. */
	arrangeFaceUp: boolean;
	/**
	 * Linear spread direction for assist bar + context “Spread direction” dial.
	 * Same convention as `spreadCustom`: 0 = east (right), 90 = south (down), 270 = north (up).
	 */
	spreadAngleDeg: number;
}

const defaults: ArrangementPrefs = {
	layout: 'grid',
	spacingMode: 'overlap',
	cols: 3,
	offset: 32,
	arrangeFaceUp: true,
	spreadAngleDeg: 0
};

/** Snap to nearest of 16 angles in [0, 337.5]. */
export function snapSpreadAngleDeg(n: number): number {
	if (!Number.isFinite(n)) return 0;
	const k = Math.round(n / SPREAD_ANGLE_STEP_DEG);
	const idx = ((k % SPREAD_DIRECTION_COUNT) + SPREAD_DIRECTION_COUNT) % SPREAD_DIRECTION_COUNT;
	return idx * SPREAD_ANGLE_STEP_DEG;
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

function sanitize(p: Partial<ArrangementPrefs>): ArrangementPrefs {
	const layout =
		p.layout != null && LAYOUTS.has(p.layout) ? p.layout : defaults.layout;
	const spacingMode =
		p.spacingMode != null && SPACINGS.has(p.spacingMode) ? p.spacingMode : defaults.spacingMode;
	const cols = clamp(Math.floor(Number(p.cols ?? defaults.cols)) || defaults.cols, 1, 99);
	let offset = Number(p.offset ?? defaults.offset);
	if (Number.isNaN(offset)) offset = defaults.offset;
	if (spacingMode === 'overlap') offset = clamp(Math.floor(offset) || 1, 1, 500);
	else offset = clamp(Math.round(offset), 0, 500);
	const arrangeFaceUp =
		typeof p.arrangeFaceUp === 'boolean' ? p.arrangeFaceUp : defaults.arrangeFaceUp;
	const spreadAngleDeg =
		p.spreadAngleDeg !== undefined ? snapSpreadAngleDeg(Number(p.spreadAngleDeg)) : defaults.spreadAngleDeg;
	return { layout, spacingMode, cols, offset, arrangeFaceUp, spreadAngleDeg };
}

function load(): ArrangementPrefs {
	if (!browser) return { ...defaults };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...defaults };
		const parsed = JSON.parse(raw) as Partial<ArrangementPrefs>;
		return sanitize({ ...defaults, ...parsed });
	} catch {
		return { ...defaults };
	}
}

export const arrangementPrefs = writable<ArrangementPrefs>(load());

function persist(p: ArrangementPrefs) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
	} catch {
		/* ignore quota */
	}
}

/** Update persisted arrangement options (layout, spacing, columns, offset). */
export function patchArrangementPrefs(patch: Partial<ArrangementPrefs>) {
	arrangementPrefs.update((cur) => {
		const next = sanitize({ ...cur, ...patch });
		persist(next);
		return next;
	});
}
