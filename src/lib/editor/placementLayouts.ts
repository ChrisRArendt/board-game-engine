import type { PlacementLayout } from '$lib/engine/types';
import type { Rect } from '$lib/engine/geometry';
import { ARRANGEMENT_GAP_PRESET } from '$lib/editor/arrangementGapPresets';

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
	if (layout === 'fan')
		return computeFanPositions(count, gap, baseX, baseY, sep, pw, ph);
	return computeGridPositions(count, gap, baseX, baseY, cols, sep, pw, ph);
}

/**
 * Fan: piece centers lie on a circular arc (pivot below the arc).
 * The arc is centered: lowest pieces at the left and right, highest at the middle (like a shallow ∩).
 * (baseX, baseY) is the top-left of the back piece (layer order); that piece sits on the left end of the arc.
 * `rotationDeg` is the tangent to the arc (cards tilt with the curve).
 */
export function fanArcLayoutWithRotation(
	count: number,
	offset: number,
	baseX: number,
	baseY: number,
	separate: boolean,
	pieceW: number,
	pieceH: number
): Array<{ x: number; y: number; rotationDeg: number }> {
	const out: Array<{ x: number; y: number; rotationDeg: number }> = [];
	if (count <= 0) return out;
	const pw = Math.max(1, pieceW);
	const ph = Math.max(1, pieceH);
	if (count === 1) {
		return [{ x: baseX, y: baseY, rotationDeg: 0 }];
	}

	const gap = Math.max(0, offset);
	/** Arc length between consecutive piece centers along the curve. */
	const arcLen = separate ? pw + gap : Math.max(8, offset * 0.55);

	/** Max total sweep (~50°) so the fan stays a gentle curve. */
	const maxTotalAngle = (50 * Math.PI) / 180;

	let R = Math.max(100, separate ? ph + gap * 2 : 80 + offset * 1.25);
	let totalAngle = ((count - 1) * arcLen) / R;
	if (totalAngle > maxTotalAngle) {
		R = ((count - 1) * arcLen) / maxTotalAngle;
		totalAngle = maxTotalAngle;
	}

	const half = (count - 1) / 2;
	const angleStep = totalAngle / (count - 1);

	// Circle center so theta = -totalAngle/2 places the back piece at (baseX, baseY); theta = 0 is the arc peak.
	const cx = baseX + pw / 2 + R * Math.sin(totalAngle / 2);
	const cy = baseY + ph / 2 + R * Math.cos(totalAngle / 2);

	for (let i = 0; i < count; i++) {
		const theta = (i - half) * angleStep;
		const ccx = cx + R * Math.sin(theta);
		const ccy = cy - R * Math.cos(theta);
		/** Tangent direction (derivative wrt theta); matches CSS angle on screen y-down. */
		const rotRad = Math.atan2(R * Math.sin(theta), R * Math.cos(theta));
		const rotationDeg = (rotRad * 180) / Math.PI;
		out.push({
			x: ccx - pw / 2,
			y: ccy - ph / 2,
			rotationDeg
		});
	}
	return out;
}

/** Fan layout top-left positions only (no rotation) — editor / placement. */
export function computeFanPositions(
	count: number,
	offset: number,
	baseX: number,
	baseY: number,
	separate: boolean,
	pieceW: number,
	pieceH: number
): { x: number; y: number }[] {
	return fanArcLayoutWithRotation(
		count,
		offset,
		baseX,
		baseY,
		separate,
		pieceW,
		pieceH
	).map(({ x, y }) => ({ x, y }));
}

/**
 * Fan positions centered in a deal zone — same math as context menu **Arrange → Fan → Overlap → Small**
 * (`computeFanPositions` with spacing overlap and `ARRANGEMENT_GAP_PRESET.small`). Rotation is not applied
 * (matches `applyPlacementArrangementToSelection`).
 */
export function computeFanDealPositionsInRect(
	rect: Rect,
	count: number,
	pieceW: number,
	pieceH: number
): Array<{ x: number; y: number }> {
	const pw = Math.max(1, pieceW);
	const ph = Math.max(1, pieceH);
	if (count <= 0) return [];
	if (count === 1) {
		return [{ x: rect.x + rect.w / 2 - pw / 2, y: rect.y + rect.h / 2 - ph / 2 }];
	}

	const raw = computeFanPositions(
		count,
		ARRANGEMENT_GAP_PRESET.small,
		0,
		0,
		false,
		pw,
		ph
	);
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of raw) {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x + pw);
		maxY = Math.max(maxY, p.y + ph);
	}
	const bboxCx = (minX + maxX) / 2;
	const bboxCy = (minY + maxY) / 2;
	const targetCx = rect.x + rect.w / 2;
	const targetCy = rect.y + rect.h / 2;
	const dx = targetCx - bboxCx;
	const dy = targetCy - bboxCy;
	return raw.map((p) => ({ x: p.x + dx, y: p.y + dy }));
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
