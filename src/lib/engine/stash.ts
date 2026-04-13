import type { PieceInstance, UserEntry } from '$lib/engine/types';

/** Must match `Board.svelte` stash layout (`.stash` footprint). */
export const STASH_W = 700;
export const STASH_H = 600;

export type StashRosterEntry = { id: string; name: string; color: string };

/** Player stash top-left — same formula as `Board.svelte` `stashPos`. */
export function stashPos(i: number): { x: number; y: number } {
	return {
		x: 50 + (i % 6) * 720,
		y: 2300 + Math.floor(i / 6) * 800
	};
}

export function stashRectForIndex(i: number): { x: number; y: number; w: number; h: number } {
	const p = stashPos(i);
	return { x: p.x, y: p.y, w: STASH_W, h: STASH_H };
}

function pieceCenter(p: PieceInstance): { x: number; y: number } {
	return {
		x: p.x + p.initial_size.w / 2,
		y: p.y + p.initial_size.h / 2
	};
}

function pointInRect(
	px: number,
	py: number,
	rect: { x: number; y: number; w: number; h: number }
): boolean {
	return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

/** Which player's private zone contains the piece center, if any. */
export function ownerStashUserIdForPiece(
	piece: PieceInstance,
	roster: StashRosterEntry[]
): string | null {
	const c = pieceCenter(piece);
	for (let i = 0; i < roster.length; i++) {
		const r = stashRectForIndex(i);
		if (pointInRect(c.x, c.y, r)) return roster[i].id;
	}
	return null;
}

/**
 * Other players must not see card faces in someone else's private zone.
 * Replay mode shows full state (moderator / review).
 */
export function isPieceFaceHiddenFromPeers(
	piece: PieceInstance,
	roster: StashRosterEntry[],
	selfUserId: string,
	replayMode: boolean
): boolean {
	if (replayMode) return false;
	const owner = ownerStashUserIdForPiece(piece, roster);
	return owner !== null && owner !== selfUserId;
}

/**
 * Only the owner may select / drag a piece while it sits in that player's private zone.
 * Replay shows full moderator view (same as face visibility).
 */
export function canSelectPieceForViewer(
	piece: PieceInstance,
	roster: StashRosterEntry[],
	selfUserId: string,
	replayMode: boolean
): boolean {
	if (replayMode) return true;
	const owner = ownerStashUserIdForPiece(piece, roster);
	if (owner === null) return true;
	return owner === selfUserId;
}

/** Same ordering as the in-game stash labels (used for zone geometry). */
export function buildStashRoster(opts: {
	selfUserId: string;
	selfDisplayName: string;
	selfColor: string;
	users: UserEntry[];
	playerOrder: string[];
	playerColorOverrides: Record<string, string>;
}): StashRosterEntry[] {
	const me: StashRosterEntry = {
		id: opts.selfUserId,
		name: opts.selfDisplayName,
		color: opts.selfColor
	};
	const others: StashRosterEntry[] = opts.users.map((u) => ({
		id: u.id,
		name: u.name,
		color: opts.playerColorOverrides[u.id] ?? u.color
	}));
	const roster = [...others, me];
	const order = opts.playerOrder;
	if (!order.length) return [...roster].sort((a, b) => a.id.localeCompare(b.id));
	const byId = new Map(roster.map((r) => [r.id, r]));
	const present = new Set(roster.map((r) => r.id));
	const out: StashRosterEntry[] = [];
	for (const id of order) {
		if (!present.has(id)) continue;
		const r = byId.get(id);
		if (r) out.push(r);
	}
	for (const r of roster) {
		if (!order.includes(r.id)) out.push(r);
	}
	return out;
}
