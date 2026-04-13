import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { PlacementLayout } from '$lib/engine/types';
import type { PlacementSpacingMode } from '$lib/editor/placementLayouts';

const STORAGE_KEY = 'bge_arrangement_prefs';

const LAYOUTS = new Set<PlacementLayout>(['stack', 'grid', 'honeycomb', 'fan']);
const SPACINGS = new Set<PlacementSpacingMode>(['overlap', 'separate']);

export interface ArrangementPrefs {
	layout: PlacementLayout;
	spacingMode: PlacementSpacingMode;
	cols: number;
	offset: number;
	/** When applying arrangement, show card front (true) or back (false) for flip-capable pieces. */
	arrangeFaceUp: boolean;
}

const defaults: ArrangementPrefs = {
	layout: 'grid',
	spacingMode: 'overlap',
	cols: 3,
	offset: 32,
	arrangeFaceUp: true
};

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
	return { layout, spacingMode, cols, offset, arrangeFaceUp };
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
