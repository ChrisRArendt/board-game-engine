import type { PieceData, PieceInstance } from './types';
import { shuffle, zoomLevelToMult } from './geometry';

export function pieceFromData(data: PieceData, id: number, curGame: string, offset: { x: number; y: number }): PieceInstance {
	const coords = data.placement?.coords ?? { x: 0, y: 0 };
	return {
		id,
		bg: data.bg,
		classes: data.class ?? '',
		attributes: data.attributes ? [...data.attributes] : [],
		x: coords.x + offset.x,
		y: coords.y + offset.y,
		zIndex: id,
		flipped: false,
		initial_size: { ...data.initial_size },
		image_size: data.image_size ? { ...data.image_size } : undefined
	};
}

export function hasAttr(p: PieceInstance, attr: string): boolean {
	return p.attributes.includes(attr);
}

export function maxZIndex(pieces: PieceInstance[]): number {
	let m = 0;
	for (const p of pieces) m = Math.max(m, p.zIndex);
	return m;
}

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

	const dlist = [...dragging].sort((a, b) => a.y - b.y || a.x - b.x);

	const xlists: PieceInstance[][] = [];
	let xlistsi = 0;
	let cury = -999999;
	for (const p of dlist) {
		if (cury + 50 < p.y) {
			cury = p.y;
			xlists.push([]);
			xlistsi = xlists.length - 1;
		}
		xlists[xlistsi].push(p);
	}
	for (const xl of xlists) xl.sort((a, b) => a.x - b.x);

	let nextz = 0;
	for (const row of xlists) {
		for (const p of row) {
			updates.set(p.id, highz + ++nextz);
		}
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

export { zoomLevelToMult };
