import type { PieceInstance } from '$lib/engine/types';

export type AlignKind =
	| 'left'
	| 'centerH'
	| 'right'
	| 'top'
	| 'centerV'
	| 'bottom';

export type DistributeKind = 'horizontal' | 'vertical';

export type MatchSizeKind = 'width' | 'height';

function bounds(p: PieceInstance) {
	return {
		left: p.x,
		top: p.y,
		right: p.x + p.initial_size.w,
		bottom: p.y + p.initial_size.h,
		cx: p.x + p.initial_size.w / 2,
		cy: p.y + p.initial_size.h / 2
	};
}

/** Returns map of piece id -> new x,y for alignment. */
export function alignPieces(
	pieces: PieceInstance[],
	selectedIds: Set<number>,
	kind: AlignKind
): Map<number, { x: number; y: number }> {
	const sel = pieces.filter((p) => selectedIds.has(p.id));
	const out = new Map<number, { x: number; y: number }>();
	if (sel.length < 2) return out;

	const ref = sel[0];
	const rb = bounds(ref);

	for (const p of sel) {
		if (p.id === ref.id) continue;
		const b = bounds(p);
		let nx = p.x;
		let ny = p.y;
		switch (kind) {
			case 'left':
				nx = rb.left;
				break;
			case 'centerH':
				nx = rb.cx - p.initial_size.w / 2;
				break;
			case 'right':
				nx = rb.right - p.initial_size.w;
				break;
			case 'top':
				ny = rb.top;
				break;
			case 'centerV':
				ny = rb.cy - p.initial_size.h / 2;
				break;
			case 'bottom':
				ny = rb.bottom - p.initial_size.h;
				break;
		}
		out.set(p.id, { x: nx, y: ny });
	}
	return out;
}

export function distributePieces(
	pieces: PieceInstance[],
	selectedIds: Set<number>,
	kind: DistributeKind
): Map<number, { x: number; y: number }> {
	const sel = pieces.filter((p) => selectedIds.has(p.id));
	const out = new Map<number, { x: number; y: number }>();
	if (sel.length < 3) return out;

	const sorted =
		kind === 'horizontal'
			? [...sel].sort((a, b) => a.x - b.x)
			: [...sel].sort((a, b) => a.y - b.y);

	const first = sorted[0];
	const last = sorted[sorted.length - 1];

	if (kind === 'horizontal') {
		const span = last.x + last.initial_size.w - first.x;
		const totalW = sorted.reduce((s, p) => s + p.initial_size.w, 0);
		const gap = (span - totalW) / (sorted.length - 1);
		let x = first.x;
		for (const p of sorted) {
			out.set(p.id, { x, y: p.y });
			x += p.initial_size.w + gap;
		}
	} else {
		const span = last.y + last.initial_size.h - first.y;
		const totalH = sorted.reduce((s, p) => s + p.initial_size.h, 0);
		const gap = (span - totalH) / (sorted.length - 1);
		let y = first.y;
		for (const p of sorted) {
			out.set(p.id, { x: p.x, y });
			y += p.initial_size.h + gap;
		}
	}
	return out;
}

export function matchSizes(
	pieces: PieceInstance[],
	selectedIds: Set<number>,
	kind: MatchSizeKind
): Map<number, { initial_size: { w: number; h: number } }> {
	const sel = pieces.filter((p) => selectedIds.has(p.id));
	const out = new Map<number, { initial_size: { w: number; h: number } }>();
	if (sel.length < 2) return out;

	const ref = sel[0];
	const tw = ref.initial_size.w;
	const th = ref.initial_size.h;

	for (const p of sel) {
		if (p.id === ref.id) continue;
		const w = kind === 'width' ? tw : p.initial_size.w;
		const h = kind === 'height' ? th : p.initial_size.h;
		out.set(p.id, { initial_size: { w: Math.max(4, w), h: Math.max(4, h) } });
	}
	return out;
}
