import type { PieceData, PieceInstance } from './types';
import { shuffle } from './geometry';

export function pieceFromData(data: PieceData, id: number, curGame: string, offset: { x: number; y: number }): PieceInstance {
	const coords = data.placement?.coords ?? { x: 0, y: 0 };
	const rot =
		typeof data.rotation === 'number' && Number.isFinite(data.rotation) ? data.rotation : undefined;
	const hidden = data.editor_hidden === true;
	const locked = data.editor_locked === true;
	let attributes = data.attributes ? [...data.attributes] : [];
	const bgPath = data.bg ?? '';
	if (!attributes.includes('flip') && bgPath.startsWith('cards/')) {
		attributes = [...attributes, 'flip'];
	}
	return {
		id,
		bg: data.bg,
		...(data.bg_color ? { bg_color: data.bg_color } : {}),
		classes: data.class ?? '',
		attributes,
		x: coords.x + offset.x,
		y: coords.y + offset.y,
		zIndex: id,
		flipped: false,
		initial_size: { ...data.initial_size },
		image_size: data.image_size ? { ...data.image_size } : undefined,
		...(rot !== undefined ? { rotation: rot } : {}),
		...(hidden ? { hidden: true } : {}),
		...(locked ? { locked: true } : {})
	};
}

export function hasAttr(p: PieceInstance, attr: string): boolean {
	return p.attributes.includes(attr);
}

/** Front/back flip: explicit `flip` attribute, or custom-game card PNG under `cards/`. */
export function pieceSupportsFlip(p: PieceInstance): boolean {
	if (hasAttr(p, 'flip')) return true;
	return (p.bg ?? '').startsWith('cards/');
}

export function maxZIndex(pieces: PieceInstance[]): number {
	let m = 0;
	for (const p of pieces) m = Math.max(m, p.zIndex);
	return m;
}

/**
 * Raise selected pieces above everything else while preserving their **relative** z-order.
 * (Spatial sorting breaks fanned / arced hands where y varies along the spread.)
 */
export function bringDraggingToFront(
	dragging: PieceInstance[],
	all: PieceInstance[]
): Map<number, number> {
	const updates = new Map<number, number>();
	if (dragging.length === 0) return updates;

	const notSel = all.filter((p) => !dragging.some((d) => d.id === p.id));
	let highestNsZ = 0;
	for (const p of notSel) highestNsZ = Math.max(highestNsZ, p.zIndex);

	let somethingLower = false;
	for (const p of dragging) {
		if (highestNsZ > p.zIndex) somethingLower = true;
	}

	let highz = 0;
	if (somethingLower) {
		for (const p of all) highz = Math.max(highz, p.zIndex);
	} else {
		highz = highestNsZ;
	}

	const ordered = [...dragging].sort((a, b) => a.zIndex - b.zIndex || a.id - b.id);

	let nextz = 0;
	for (const p of ordered) {
		updates.set(p.id, highz + ++nextz);
	}
	return updates;
}

export function shuffleSelectedPieces(pieces: PieceInstance[], selectedIds: Set<number>): Map<number, { z: number; x: number; y: number }> {
	const sel = pieces.filter((p) => selectedIds.has(p.id) && hasAttr(p, 'shuffle'));
	const updates = new Map<number, { z: number; x: number; y: number }>();
	if (sel.length === 0) return updates;

	const pack = sel.map((p) => ({ z: p.zIndex, x: p.x, y: p.y }));
	const shuffled = shuffle(pack);
	for (let i = 0; i < sel.length; i++) {
		updates.set(sel[i].id, {
			z: shuffled[i].z,
			x: shuffled[i].x,
			y: shuffled[i].y
		});
	}
	return updates;
}

export function arrangeFanned(pieces: PieceInstance[], selectedIds: Set<number>): Map<number, { x: number; y: number }> {
	const sel = pieces.filter((p) => selectedIds.has(p.id));
	const updates = new Map<number, { x: number; y: number }>();
	if (sel.length === 0) return updates;

	let avgx = 0,
		avgy = 0;
	for (const p of sel) {
		avgx += p.x;
		avgy += p.y;
	}
	avgx /= sel.length;
	avgy /= sel.length;

	const spacing = { x: 25, y: 0 };
	const sorted = [...sel].sort((a, b) => a.zIndex - b.zIndex);

	const start = {
		top: avgy - (spacing.y * (sorted.length - 1)) / 2,
		left: avgx - (spacing.x * (sorted.length - 1)) / 2
	};

	for (let i = 0; i < sorted.length; i++) {
		updates.set(sorted[i].id, {
			x: start.left + spacing.x * i,
			y: start.top + spacing.y * i
		});
	}
	return updates;
}

const DEFAULT_SPREAD_GAP = 32;

/**
 * Spread selected movable pieces along a line through their centroid, preserving z-order.
 * `gap` is the distance between consecutive piece **centers** along the unit direction.
 */
export function spreadPiecesLinear(
	pieces: PieceInstance[],
	selectedIds: Set<number>,
	gap: number,
	dir: { x: number; y: number }
): Map<number, { x: number; y: number }> {
	const sel = pieces.filter((p) => selectedIds.has(p.id) && hasAttr(p, 'move'));
	const updates = new Map<number, { x: number; y: number }>();
	if (sel.length < 2) return updates;

	let len = Math.hypot(dir.x, dir.y);
	if (len < 1e-9) len = 1;
	const ux = dir.x / len;
	const uy = dir.y / len;

	const sorted = [...sel].sort((a, b) => a.zIndex - b.zIndex);
	let cx = 0;
	let cy = 0;
	for (const p of sorted) {
		cx += p.x + p.initial_size.w / 2;
		cy += p.y + p.initial_size.h / 2;
	}
	cx /= sorted.length;
	cy /= sorted.length;

	const n = sorted.length;
	const mid = (n - 1) / 2;
	for (let i = 0; i < n; i++) {
		const p = sorted[i];
		const ox = cx + (i - mid) * gap * ux - p.initial_size.w / 2;
		const oy = cy + (i - mid) * gap * uy - p.initial_size.h / 2;
		updates.set(p.id, { x: ox, y: oy });
	}
	return updates;
}

export function spreadHorizontal(
	pieces: PieceInstance[],
	selectedIds: Set<number>,
	gap = DEFAULT_SPREAD_GAP
): Map<number, { x: number; y: number }> {
	return spreadPiecesLinear(pieces, selectedIds, gap, { x: 1, y: 0 });
}

export function spreadVertical(
	pieces: PieceInstance[],
	selectedIds: Set<number>,
	gap = DEFAULT_SPREAD_GAP
): Map<number, { x: number; y: number }> {
	return spreadPiecesLinear(pieces, selectedIds, gap, { x: 0, y: 1 });
}

/** Direction angle in degrees: 0 = right, 90 = down (screen coordinates). */
export function spreadCustom(
	pieces: PieceInstance[],
	selectedIds: Set<number>,
	gap: number,
	angleDeg: number
): Map<number, { x: number; y: number }> {
	const rad = (angleDeg * Math.PI) / 180;
	return spreadPiecesLinear(pieces, selectedIds, gap, { x: Math.cos(rad), y: Math.sin(rad) });
}

export function arrangeStacked(pieces: PieceInstance[], selectedIds: Set<number>): Map<number, { x: number; y: number }> {
	const sel = pieces.filter((p) => selectedIds.has(p.id));
	const updates = new Map<number, { x: number; y: number }>();
	if (sel.length === 0) return updates;

	let avgx = 0,
		avgy = 0;
	for (const p of sel) {
		avgx += p.x;
		avgy += p.y;
	}
	avgx /= sel.length;
	avgy /= sel.length;

	for (const p of sel) {
		updates.set(p.id, { x: avgx, y: avgy });
	}
	return updates;
}

