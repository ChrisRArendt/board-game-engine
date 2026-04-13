import type { PieceInstance } from '$lib/engine/types';

export type BoardSnapGuides = { verticals: number[]; horizontals: number[] };

export const EMPTY_BOARD_GUIDES: BoardSnapGuides = { verticals: [], horizontals: [] };

function dedupe(nums: number[]): number[] {
	return [...new Set(nums.map((n) => Math.round(n * 1000) / 1000))].sort((a, b) => a - b);
}

function rectEdges(p: PieceInstance) {
	const w = p.initial_size.w;
	const h = p.initial_size.h;
	return {
		left: p.x,
		right: p.x + w,
		top: p.y,
		bottom: p.y + h,
		cx: p.x + w / 2,
		cy: p.y + h / 2
	};
}

/** Build snap targets: table edges/midlines + other pieces' edges/centers (excluding dragging ids). */
export function buildBoardSnapTargets(
	table: { w: number; h: number },
	pieces: PieceInstance[],
	excludeIds: Set<number>
): { x: number[]; y: number[] } {
	const x: number[] = [0, table.w / 2, table.w];
	const y: number[] = [0, table.h / 2, table.h];
	for (const p of pieces) {
		if (excludeIds.has(p.id)) continue;
		if (p.hidden) continue;
		const r = rectEdges(p);
		x.push(r.left, r.cx, r.right);
		y.push(r.top, r.cy, r.bottom);
	}
	return { x: dedupe(x), y: dedupe(y) };
}

export function snapBoardPiecePosition(
	piece: PieceInstance,
	candidateX: number,
	candidateY: number,
	targets: { x: number[]; y: number[] },
	threshold: number
): { x: number; y: number; guides: BoardSnapGuides } {
	const w = piece.initial_size.w;
	const h = piece.initial_size.h;
	const r = {
		left: candidateX,
		right: candidateX + w,
		top: candidateY,
		bottom: candidateY + h,
		cx: candidateX + w / 2,
		cy: candidateY + h / 2
	};

	let bestX = candidateX;
	let bestY = candidateY;
	const verticals: number[] = [];
	const horizontals: number[] = [];

	let bestDx = threshold + 1;
	for (const tx of targets.x) {
		for (const edge of [r.left, r.cx, r.right] as const) {
			const d = Math.abs(edge - tx);
			if (d < bestDx && d <= threshold) {
				bestDx = d;
				bestX = candidateX + (tx - edge);
			}
		}
	}

	let bestDy = threshold + 1;
	for (const ty of targets.y) {
		for (const edge of [r.top, r.cy, r.bottom] as const) {
			const d = Math.abs(edge - ty);
			if (d < bestDy && d <= threshold) {
				bestDy = d;
				bestY = candidateY + (ty - edge);
			}
		}
	}

	// Guides: show line when snapped
	const r2 = {
		left: bestX,
		right: bestX + w,
		top: bestY,
		bottom: bestY + h,
		cx: bestX + w / 2,
		cy: bestY + h / 2
	};
	const th = threshold;
	for (const tx of targets.x) {
		if (
			Math.abs(r2.left - tx) <= th ||
			Math.abs(r2.cx - tx) <= th ||
			Math.abs(r2.right - tx) <= th
		) {
			verticals.push(tx);
		}
	}
	for (const ty of targets.y) {
		if (
			Math.abs(r2.top - ty) <= th ||
			Math.abs(r2.cy - ty) <= th ||
			Math.abs(r2.bottom - ty) <= th
		) {
			horizontals.push(ty);
		}
	}

	return {
		x: bestX,
		y: bestY,
		guides: {
			verticals: [...new Set(verticals)],
			horizontals: [...new Set(horizontals)]
		}
	};
}

export function mergeGuides(a: BoardSnapGuides, b: BoardSnapGuides): BoardSnapGuides {
	return {
		verticals: [...new Set([...a.verticals, ...b.verticals])],
		horizontals: [...new Set([...a.horizontals, ...b.horizontals])]
	};
}

