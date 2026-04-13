import type { Rect } from '$lib/engine/geometry';
import type { PieceInstance, PlayerSlotZones, UserEntry } from '$lib/engine/types';

/** Must match `Board.svelte` stash layout (`.stash` footprint). */
export const STASH_W = 700;
export const STASH_H = 600;

/** Max configurable player zone slots (expand in one place). */
export const PLAYER_SLOT_MAX = 8;

/**
 * RTS-style player slot colors (editor zone preview, labels): red → blue → teal → purple → gold → orange → green → pink.
 * Order matches common WC/SC-style player color lists.
 */
export const PLAYER_SLOT_COLORS: readonly string[] = [
	'#e53e3e',
	'#3182ce',
	'#319795',
	'#805ad5',
	'#d69e2e',
	'#dd6b20',
	'#38a169',
	'#d53f8c'
];

export function playerSlotColor(slotIndex: number): string {
	return PLAYER_SLOT_COLORS[slotIndex % PLAYER_SLOT_COLORS.length] ?? '#94a3b8';
}

export type StashRosterEntry = { id: string; name: string; color: string };

/** Player stash top-left — same formula as `Board.svelte` `stashPos`. */
export function stashPos(i: number): { x: number; y: number } {
	return {
		x: 50 + (i % 6) * 720,
		y: 2300 + Math.floor(i / 6) * 800
	};
}

export function stashRectForIndex(i: number): Rect {
	const p = stashPos(i);
	return { x: p.x, y: p.y, w: STASH_W, h: STASH_H };
}

function isValidRect(r: unknown): r is Rect {
	if (!r || typeof r !== 'object') return false;
	const o = r as Record<string, unknown>;
	if (![o.x, o.y, o.w, o.h].every((n) => typeof n === 'number' && Number.isFinite(n as number))) {
		return false;
	}
	return (o.w as number) > 0 && (o.h as number) > 0;
}

/** Parse `game_data.player_slots`; invalid entries skipped. */
export function parsePlayerSlotsFromJson(raw: unknown): PlayerSlotZones[] | null {
	if (!Array.isArray(raw) || raw.length === 0) return null;
	const out: PlayerSlotZones[] = [];
	for (let i = 0; i < Math.min(raw.length, PLAYER_SLOT_MAX); i++) {
		const row = raw[i];
		if (!row || typeof row !== 'object') continue;
		const o = row as Record<string, unknown>;
		if (!isValidRect(o.safe) || !isValidRect(o.deal)) continue;
		const safe = o.safe as Rect;
		const deal = o.deal as Rect;
		out.push({
			safe: { x: safe.x, y: safe.y, w: safe.w, h: safe.h },
			deal: { x: deal.x, y: deal.y, w: deal.w, h: deal.h }
		});
	}
	return out.length > 0 ? out : null;
}

/** Default 8 slots from legacy stash positions (safe = deal = stash rect). */
export function defaultPlayerSlotsFromLegacyGrid(): PlayerSlotZones[] {
	const slots: PlayerSlotZones[] = [];
	for (let i = 0; i < PLAYER_SLOT_MAX; i++) {
		const r = stashRectForIndex(i);
		slots.push({ safe: { ...r }, deal: { ...r } });
	}
	return slots;
}

/** Private hand rect for roster index `i`. */
export function safeRectForRosterIndex(i: number, playerSlots: PlayerSlotZones[] | null): Rect {
	if (playerSlots && playerSlots.length > 0 && i < playerSlots.length) {
		return { ...playerSlots[i].safe };
	}
	return stashRectForIndex(i);
}

/** Deal target rect for roster index `i`. */
export function dealRectForRosterIndex(i: number, playerSlots: PlayerSlotZones[] | null): Rect {
	if (playerSlots && playerSlots.length > 0 && i < playerSlots.length) {
		return { ...playerSlots[i].deal };
	}
	return stashRectForIndex(i);
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
	roster: StashRosterEntry[],
	playerSlots: PlayerSlotZones[] | null = null
): string | null {
	const c = pieceCenter(piece);
	for (let i = 0; i < roster.length; i++) {
		const r = safeRectForRosterIndex(i, playerSlots);
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
	replayMode: boolean,
	playerSlots: PlayerSlotZones[] | null = null
): boolean {
	if (replayMode) return false;
	const owner = ownerStashUserIdForPiece(piece, roster, playerSlots);
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
	replayMode: boolean,
	playerSlots: PlayerSlotZones[] | null = null
): boolean {
	if (replayMode) return true;
	const owner = ownerStashUserIdForPiece(piece, roster, playerSlots);
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
