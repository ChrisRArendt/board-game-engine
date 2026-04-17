import { browser } from '$app/environment';
import type { PieceInstance } from './types';
import { hasAttr } from './pieces';

/** Pixels — pieces with the same stack position share (x, y) within this tolerance. */
export const PILE_POSITION_EPS_PX = 0.5;

/**
 * Selectable pieces whose on-screen bounds contain `clientX` / `clientY` (stacking order:
 * bottom → top by z-index). Uses `[data-piece-id]` rects so rotation matches what you see.
 */
export function selectablePiecesHitAtClient(
	clientX: number,
	clientY: number,
	pieces: PieceInstance[],
	canSelectPiece: (p: PieceInstance) => boolean
): PieceInstance[] {
	if (!browser || typeof document === 'undefined') return [];
	const byId = new Map(pieces.map((p) => [p.id, p]));
	const hitIds: number[] = [];
	for (const el of document.querySelectorAll<HTMLElement>('[data-piece-id]')) {
		const r = el.getBoundingClientRect();
		if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;
		const raw = el.dataset.pieceId;
		const id = raw ? parseInt(raw, 10) : NaN;
		if (Number.isNaN(id)) continue;
		hitIds.push(id);
	}
	hitIds.sort((a, b) => {
		const pa = byId.get(a);
		const pb = byId.get(b);
		if (!pa || !pb) return a - b;
		return pa.zIndex - pb.zIndex || pa.id - pb.id;
	});
	const out: PieceInstance[] = [];
	const seen = new Set<number>();
	for (const id of hitIds) {
		if (seen.has(id)) continue;
		seen.add(id);
		const p = byId.get(id);
		if (!p || !hasAttr(p, 'select') || p.hidden || !canSelectPiece(p)) continue;
		out.push(p);
	}
	return out;
}
