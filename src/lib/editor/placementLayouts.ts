import type { PlacementLayout } from '$lib/engine/types';

/** Overlap: step by `offset` only (dealer fan / tight grid). Separate: step by piece size + offset (tiles with gap). */
export type PlacementSpacingMode = 'overlap' | 'separate';

export interface PlacementLayoutOptions {
	layout: PlacementLayout;
	count: number;
	baseX: number;
	baseY: number;
	/** In overlap mode: step between origins. In separate mode: gap between piece edges. */
	offset: number;
	spacingMode?: PlacementSpacingMode;
	/** Piece size in table px; used when spacingMode is separate. */
	pieceW?: number;
	pieceH?: number;
	/** Columns for grid layout (default ~ceil(sqrt(count))). */
	cols?: number;
}

export function computePlacementPositions(opts: PlacementLayoutOptions): { x: number; y: number }[] {
	const { layout, count, baseX, baseY, offset, cols, spacingMode, pieceW, pieceH } = opts;
	if (count <= 0) return [];
	const sep = spacingMode === 'separate';
	const pw = Math.max(1, pieceW ?? offset);
	const ph = Math.max(1, pieceH ?? offset);
	const gap = Math.max(0, offset);

	if (layout === 'stack')
		return computeStackPositions(count, gap, baseX, baseY, sep, pw, ph);
	if (layout === 'honeycomb')
		return computeHoneycombPositions(count, gap, baseX, baseY, cols, sep, pw, ph);
	return computeGridPositions(count, gap, baseX, baseY, cols, sep, pw, ph);
}

/** Stacked: overlap = diagonal fan; separate = horizontal row with piece width + gap. */
export function computeStackPositions(
	count: number,
	offset: number,
	baseX: number,
	baseY: number,
	separate: boolean,
	pieceW: number,
	_pieceH: number
): { x: number; y: number }[] {
	const out: { x: number; y: number }[] = [];
	if (separate) {
		const step = pieceW + Math.max(0, offset);
		for (let i = 0; i < count; i++) {
			out.push({ x: baseX + i * step, y: baseY });
		}
		return out;
	}
	const step = Math.max(1, offset);
	for (let i = 0; i < count; i++) {
		out.push({ x: baseX + i * step * 0.35, y: baseY + i * step * 0.35 });
	}
	return out;
}

export function computeGridPositions(
	count: number,
	offset: number,
	baseX: number,
	baseY: number,
	colsHint: number | undefined,
	separate: boolean,
	pieceW: number,
	pieceH: number
): { x: number; y: number }[] {
	const cols = colsHint ?? Math.max(1, Math.ceil(Math.sqrt(count)));
	const stepX = separate ? pieceW + Math.max(0, offset) : Math.max(1, offset);
	const stepY = separate ? pieceH + Math.max(0, offset) : Math.max(1, offset);
	const out: { x: number; y: number }[] = [];
	for (let i = 0; i < count; i++) {
		const col = i % cols;
		const row = Math.floor(i / cols);
		out.push({ x: baseX + col * stepX, y: baseY + row * stepY });
	}
	return out;
}

/** Alternating hex-row pattern (odd rows shifted by half step). */
export function computeHoneycombPositions(
	count: number,
	offset: number,
	baseX: number,
	baseY: number,
	colsHint: number | undefined,
	separate: boolean,
	pieceW: number,
	pieceH: number
): { x: number; y: number }[] {
	const cols = colsHint ?? Math.max(1, Math.ceil(Math.sqrt(count)));
	if (separate) {
		const stepX = pieceW + Math.max(0, offset);
		const rowH = pieceH + Math.max(0, offset);
		const out: { x: number; y: number }[] = [];
		for (let i = 0; i < count; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const stagger = row % 2 === 1 ? stepX * 0.5 : 0;
			out.push({ x: baseX + col * stepX + stagger, y: baseY + row * rowH });
		}
		return out;
	}
	const step = Math.max(1, offset);
	const rowH = step * 0.866; // sqrt(3)/2 for hex row spacing
	const out: { x: number; y: number }[] = [];
	for (let i = 0; i < count; i++) {
		const col = i % cols;
		const row = Math.floor(i / cols);
		const stagger = row % 2 === 1 ? step * 0.5 : 0;
		out.push({ x: baseX + col * step + stagger, y: baseY + row * rowH });
	}
	return out;
}
