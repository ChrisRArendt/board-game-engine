import type { CardLayer } from './types';

/** Vertical alignment lines (x) and horizontal alignment lines (y) to draw while snapping. */
export type SnapGuides = { verticals: number[]; horizontals: number[] };

const EMPTY_GUIDES: SnapGuides = { verticals: [], horizontals: [] };

function dedupeSorted(nums: number[]): number[] {
	return [...new Set(nums.map((n) => Math.round(n * 1000) / 1000))].sort((a, b) => a - b);
}

/**
 * Build snap targets: card edges + midlines, plus edges/centers of visible layers (excluding one id).
 */
export function buildSnapTargets(
	canvasW: number,
	canvasH: number,
	layers: CardLayer[],
	excludeId: string | null
): { x: number[]; y: number[] } {
	const x: number[] = [0, canvasW / 2, canvasW];
	const y: number[] = [0, canvasH / 2, canvasH];
	for (const L of layers) {
		if (!L.visible || L.id === excludeId) continue;
		const { x: lx, y: ly, width: lw, height: lh } = L;
		x.push(lx, lx + lw / 2, lx + lw);
		y.push(ly, ly + lh / 2, ly + lh);
	}
	return { x: dedupeSorted(x), y: dedupeSorted(y) };
}

/** Smallest |delta| <= threshold aligning a point `p` to any target; returns delta and winning target for guides. */
function bestSnap1D(p: number, targets: number[], threshold: number): { delta: number; target: number | null } {
	if (threshold <= 0 || targets.length === 0) return { delta: 0, target: null };
	let best: { delta: number; target: number } | null = null;
	for (const t of targets) {
		const d = t - p;
		if (Math.abs(d) > threshold) continue;
		if (!best || Math.abs(d) < Math.abs(best.delta)) best = { delta: d, target: t };
	}
	return best ? { delta: best.delta, target: best.target } : { delta: 0, target: null };
}

/**
 * Snap a translated rect: try aligning left, center-x, or right to X targets; top, middle, or bottom to Y targets.
 */
export function snapTranslate(
	x: number,
	y: number,
	w: number,
	h: number,
	targetsX: number[],
	targetsY: number[],
	threshold: number
): { x: number; y: number; guides: SnapGuides } {
	if (threshold <= 0) return { x, y, guides: EMPTY_GUIDES };

	const cx = x + w / 2;
	const rx = x + w;
	const my = y + h / 2;
	const by = y + h;

	let bestX: { delta: number; target: number | null } | null = null;
	for (const t of targetsX) {
		for (const p of [x, cx, rx]) {
			const d = t - p;
			if (Math.abs(d) > threshold) continue;
			if (!bestX || Math.abs(d) < Math.abs(bestX.delta)) bestX = { delta: d, target: t };
		}
	}

	let bestY: { delta: number; target: number | null } | null = null;
	for (const t of targetsY) {
		for (const p of [y, my, by]) {
			const d = t - p;
			if (Math.abs(d) > threshold) continue;
			if (!bestY || Math.abs(d) < Math.abs(bestY.delta)) bestY = { delta: d, target: t };
		}
	}

	const dx = bestX?.delta ?? 0;
	const dy = bestY?.delta ?? 0;
	const guides: SnapGuides = { verticals: [], horizontals: [] };
	if (bestX?.target != null) guides.verticals.push(bestX.target);
	if (bestY?.target != null) guides.horizontals.push(bestY.target);

	return { x: x + dx, y: y + dy, guides };
}

function pushGuideV(g: SnapGuides, t: number | null) {
	if (t != null) g.verticals.push(t);
}
function pushGuideH(g: SnapGuides, t: number | null) {
	if (t != null) g.horizontals.push(t);
}

/**
 * Snap a resized rect given handle kind (same strings as ResizeHandles).
 * Uses `raw` from the handle math; preserves opposite edges from `raw` per handle (Figma-style).
 */
export function snapResizeRect(
	kind: string,
	raw: { x: number; y: number; w: number; h: number },
	minW: number,
	minH: number,
	targetsX: number[],
	targetsY: number[],
	threshold: number
): { x: number; y: number; w: number; h: number; guides: SnapGuides } {
	if (threshold <= 0) return { ...raw, guides: EMPTY_GUIDES };

	const k = kind;
	const guides: SnapGuides = { verticals: [], horizontals: [] };
	let nx = raw.x;
	let ny = raw.y;
	let nw = raw.w;
	let nh = raw.h;

	const right = raw.x + raw.w;
	const bottom = raw.y + raw.h;

	// Order matches ResizeHandles: e, w, s, n (see move() in ResizeHandles.svelte)
	if (k.includes('e')) {
		const { delta, target } = bestSnap1D(right, targetsX, threshold);
		if (delta !== 0) {
			nw = Math.max(minW, raw.w + delta);
			nx = raw.x;
			pushGuideV(guides, target);
		}
	}
	if (k.includes('w')) {
		const { delta, target } = bestSnap1D(raw.x, targetsX, threshold);
		if (delta !== 0) {
			nx = raw.x + delta;
			nw = Math.max(minW, right - nx);
			pushGuideV(guides, target);
		}
	}
	if (k.includes('s')) {
		const { delta, target } = bestSnap1D(bottom, targetsY, threshold);
		if (delta !== 0) {
			nh = Math.max(minH, raw.h + delta);
			ny = raw.y;
			pushGuideH(guides, target);
		}
	}
	if (k.includes('n')) {
		const { delta, target } = bestSnap1D(raw.y, targetsY, threshold);
		if (delta !== 0) {
			ny = raw.y + delta;
			nh = Math.max(minH, bottom - ny);
			pushGuideH(guides, target);
		}
	}

	return { x: nx, y: ny, w: nw, h: nh, guides };
}

/** Screen-constant feel: threshold in card space scales with zoom (divide screen px by zoom). */
export function snapThresholdCardPx(screenPx: number, zoom: number): number {
	const z = zoom > 0 ? zoom : 1;
	return screenPx / z;
}
