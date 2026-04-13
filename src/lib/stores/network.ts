import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';
import * as game from './game';
import type { StoredGameSnapshot } from './game';
import { isCustomGameKey } from '$lib/customGames';
import type { GameDataJson } from '$lib/engine/types';
import { clearRollerLog } from './rollerLog';
import { settings } from './settings';
import { users } from './users';
import { createSupabaseBrowserClient } from '$lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type LobbyChatMessage = {
	id: string;
	userId: string;
	name: string;
	avatarUrl?: string | null;
	text: string;
	ts: number;
};

/** Waiting-room chat (Realtime broadcast; cleared when leaving lobby). */
export const lobbyChatMessages = writable<LobbyChatMessage[]>([]);

export const connected = writable(false);
export const connectionLog = writable<string[]>([]);
/** Supabase auth user id while connected */
export const activeUserId = writable('');
/** @deprecated use activeUserId — kept for gradual migration */
export const activeSocketId = activeUserId;

/** Players marked “my turn” (can be multiple; synced via broadcast). */
export const turnHighlightUserIds = writable<string[]>([]);

/** Display order of player ids in the in-game list (matches lobby_members.sort_order). */
export const playerOrder = writable<string[]>([]);

/** Hex (or computed hsl) ring colors from `player_color` broadcasts; overrides stale presence metadata. */
export const playerColorOverrides = writable<Record<string, string>>({});

let gameChannel: RealtimeChannel | null = null;
let lobbyChannel: RealtimeChannel | null = null;
let supabase = createSupabaseBrowserClient();

/** Last `connectLobbyChannel` / `connectGameChannel` presence payload (for re-tracking color). */
let lastPresenceForTrack: {
	userId: string;
	displayName: string;
	avatarUrl?: string | null;
} | null = null;

function log(line: string) {
	connectionLog.update((l) => [line, ...l].slice(0, 80));
}

function hueFromUserId(userId: string): string {
	let h = 0;
	for (let i = 0; i < userId.length; i++) {
		h = (h + userId.charCodeAt(i) * (i + 1)) % 360;
	}
	return `hsla(${h}, 70%, 55%, 1)`;
}

function applyPlayerColorFromBroadcast(payload: Record<string, unknown>) {
	const p = payload as { userId?: string; color?: string | null };
	if (!p?.userId) return;
	const c =
		p.color && /^#[0-9A-Fa-f]{6}$/.test(p.color) ? p.color : hueFromUserId(p.userId);
	playerColorOverrides.update((m) => ({ ...m, [p.userId!]: c }));
}

/** Resolve ring color: custom hex wins; else hue from `userIdForFallback` (or `#888` if empty). */
export function resolveLocalPlayerColor(userIdForFallback: string): string {
	const custom = get(settings).playerColor?.trim();
	if (custom && /^#[0-9A-Fa-f]{6}$/.test(custom)) return custom;
	return userIdForFallback ? hueFromUserId(userIdForFallback) : '#888';
}

export function getLocalPlayerColor(): string {
	return resolveLocalPlayerColor(get(activeUserId));
}

/**
 * After changing Settings player color, push to Realtime presence so others see the new ring color.
 */
export function syncLocalPresenceColor(): void {
	if (!browser || !lastPresenceForTrack) return;
	const col = resolveLocalPlayerColor(lastPresenceForTrack.userId);
	const base = {
		user_id: lastPresenceForTrack.userId,
		name: lastPresenceForTrack.displayName,
		color: col,
		avatar_url: lastPresenceForTrack.avatarUrl ?? null
	};
	const customHex = get(settings).playerColor?.trim();
	const colorPayload =
		customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex)
			? customHex
			: null;
	if (gameChannel) {
		void gameChannel.track({ ...base, online: true });
		emit('player_color', { userId: lastPresenceForTrack.userId, color: colorPayload });
	}
	if (lobbyChannel) {
		void lobbyChannel.track({ ...base, ready: false });
		void emitLobby('player_color', { userId: lastPresenceForTrack.userId, color: colorPayload });
	}
}

/**
 * Click a portrait: add/remove that player from the shared “turn” set (others unchanged).
 */
export function toggleTurnHighlight(playerId: string): void {
	if (!browser) return;
	let next: string[] = [];
	turnHighlightUserIds.update((arr) => {
		const s = new Set(arr);
		if (s.has(playerId)) s.delete(playerId);
		else s.add(playerId);
		next = Array.from(s).sort((a, b) => a.localeCompare(b));
		return next;
	});
	emit('turn_highlight', { userIds: next });
}

export function emit(type: string, data: Record<string, unknown>) {
	if (!browser || !gameChannel) return false;
	const payload = { ...data } as Record<string, unknown>;
	void gameChannel.send({
		type: 'broadcast',
		event: type,
		payload
	});
	return true;
}

/**
 * After refresh/rejoin, ask peers for the live board — DB snapshot can lag behind Realtime deltas.
 * The peer with the lowest user id among those present (excluding the requester) sends full state.
 */
export function requestStateSyncFromPeers(): void {
	if (!browser) return;
	const uid = get(activeUserId);
	if (!uid) return;
	emit('sync_state_request', { requesterId: uid });
}

/** Deterministic “who answers” so only one peer broadcasts `sync_state`. */
function isSyncResponder(requesterId: string, myId: string): boolean {
	const ids = [myId, ...get(users).map((u) => u.id)].sort((a, b) => a.localeCompare(b));
	const candidates = ids.filter((id) => id !== requesterId);
	return candidates.length > 0 && candidates[0] === myId;
}

/** Broadcast on lobby channel (waiting room), e.g. game_start. Await so messages flush before DB deletes / navigation. */
export async function emitLobby(type: string, data: Record<string, unknown>) {
	if (!browser || !lobbyChannel) return false;
	const status = await lobbyChannel.send({
		type: 'broadcast',
		event: type,
		payload: data
	});
	return status === 'ok';
}

/** In-lobby text chat (`broadcast: { self: false }` so we append locally for the sender). */
export function sendLobbyChat(
	text: string,
	meta: { userId: string; name: string; avatarUrl?: string | null }
): boolean {
	if (!browser || !lobbyChannel) return false;
	const t = text.trim();
	if (!t) return false;
	const ts = Date.now();
	const id = crypto.randomUUID();
	const payload = {
		userId: meta.userId,
		name: meta.name,
		avatarUrl: meta.avatarUrl ?? null,
		text: t.slice(0, 2000),
		ts
	};
	void lobbyChannel.send({
		type: 'broadcast',
		event: 'lobby_chat',
		payload: { ...payload, id }
	});
	lobbyChatMessages.update((m) => {
		if (m.some((x) => x.id === id)) return m;
		return [...m.slice(-199), { id, ...payload }];
	});
	return true;
}

export function disconnectGame() {
	if (gameChannel) {
		void supabase.removeChannel(gameChannel);
		gameChannel = null;
	}
	connected.set(false);
	activeUserId.set('');
	turnHighlightUserIds.set([]);
	playerOrder.set([]);
	users.set([]);
	playerColorOverrides.set({});
	clearRollerLog();
}

export function disconnectLobby() {
	if (lobbyChannel) {
		void supabase.removeChannel(lobbyChannel);
		lobbyChannel = null;
	}
	lobbyChatMessages.set([]);
	users.set([]);
}

export function disconnect() {
	disconnectGame();
	disconnectLobby();
}

function applyPresenceToUsers(ch: RealtimeChannel, selfId: string) {
	const state = ch.presenceState();
	const list: import('$lib/engine/types').UserEntry[] = [];
	for (const key of Object.keys(state)) {
		const presences = state[key] as {
			user_id?: string;
			name?: string;
			color?: string;
			avatar_url?: string | null;
		}[];
		const meta = presences?.[0];
		if (!meta?.user_id || meta.user_id === selfId) continue;
		list.push({
			id: meta.user_id,
			name: meta.name ?? 'Player',
			color: meta.color ?? hueFromUserId(meta.user_id),
			connected: true,
			avatarUrl: meta.avatar_url ?? null
		});
	}
	list.sort((a, b) => a.id.localeCompare(b.id));
	users.set(list);
	if (gameChannel) {
		mergePlayerOrderWithPresence(selfId, list.map((u) => u.id));
	}
}

/**
 * Keep authoritative lobby order from SSR; append mid-session joiners only.
 * Do not shrink `cur` when presence sync is partial (first tick often sees only self) — that used to
 * replace the agreed order with UUID-sorted ids and desync every client.
 */
function mergePlayerOrderWithPresence(selfId: string, otherIds: string[]) {
	playerOrder.update((cur) => {
		if (cur.length === 0) {
			return [...new Set([selfId, ...otherIds])].sort((a, b) => a.localeCompare(b));
		}
		const existing = new Set(cur);
		const newcomers = [selfId, ...otherIds].filter((id) => !existing.has(id));
		if (newcomers.length === 0) return cur;
		return [...cur, ...newcomers.sort((a, b) => a.localeCompare(b))];
	});
}

/**
 * Waiting room: presence + game_start broadcast only.
 */
export async function connectLobbyChannel(
	lobbyId: string,
	presence: { userId: string; displayName: string; avatarUrl?: string | null }
): Promise<void> {
	if (!browser) return;
	disconnectLobby();
	supabase = createSupabaseBrowserClient();

	const topic = `lobby:${lobbyId}`;
	const ch = supabase.channel(topic, {
		config: {
			broadcast: { self: false },
			presence: { key: presence.userId }
		}
	});

	ch.on('broadcast', { event: 'game_start' }, ({ payload }) => {
		if (browser) {
			const p = payload as { userIds?: string[] } | null | undefined;
			window.dispatchEvent(
				new CustomEvent('bge:game_start', { detail: { userIds: p?.userIds } })
			);
		}
	});

	ch.on('broadcast', { event: 'lobby_deleted' }, () => {
		if (browser) {
			window.dispatchEvent(new CustomEvent('bge:lobby_deleted'));
		}
	});

	ch.on('broadcast', { event: 'lobby_finished' }, () => {
		if (browser) {
			window.dispatchEvent(new CustomEvent('bge:lobby_finished'));
		}
	});

	ch.on('broadcast', { event: 'lobby_order' }, ({ payload }) => {
		const p = payload as { userIds?: string[] };
		if (browser && Array.isArray(p.userIds)) {
			window.dispatchEvent(
				new CustomEvent('bge:lobby_order', { detail: { userIds: p.userIds } })
			);
		}
	});

	ch.on('broadcast', { event: 'lobby_chat' }, ({ payload }) => {
		const p = payload as {
			id?: string;
			userId?: string;
			name?: string;
			avatarUrl?: string | null;
			text?: string;
			ts?: number;
		};
		if (!p?.text || typeof p.text !== 'string') return;
		const msgId = typeof p.id === 'string' && p.id.length > 0 ? p.id : crypto.randomUUID();
		const msg: LobbyChatMessage = {
			id: msgId,
			userId: p.userId ?? 'unknown',
			name: p.name ?? 'Player',
			avatarUrl: p.avatarUrl ?? null,
			text: p.text.slice(0, 2000),
			ts: typeof p.ts === 'number' ? p.ts : Date.now()
		};
		lobbyChatMessages.update((m) => {
			if (m.some((x) => x.id === msgId)) return m;
			return [...m.slice(-199), msg];
		});
	});

	ch.on('broadcast', { event: 'player_color' }, ({ payload }) => {
		applyPlayerColorFromBroadcast(payload as Record<string, unknown>);
	});

	ch.on('presence', { event: 'sync' }, () => applyPresenceToUsers(ch, presence.userId));

	await new Promise<void>((resolve, reject) => {
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				lastPresenceForTrack = {
					userId: presence.userId,
					displayName: presence.displayName,
					avatarUrl: presence.avatarUrl ?? null
				};
				await ch.track({
					user_id: presence.userId,
					name: presence.displayName,
					color: resolveLocalPlayerColor(presence.userId),
					avatar_url: presence.avatarUrl ?? null,
					ready: false
				});
				log('Connected to lobby');
				lobbyChannel = ch;
				resolve();
			} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
				reject(new Error(`Lobby channel: ${status}`));
			}
		});
	});
}

/**
 * In-game sync: all piece/window events.
 * @param opts.memberOrderIds — from `lobby_members` / `fetchLobbyMembersOrdered` (must be set *after*
 *   `disconnectGame()` clears stores, or everyone’s list reverts to UUID sort).
 */
export async function connectGameChannel(
	lobbyId: string,
	presence: { userId: string; displayName: string; avatarUrl?: string | null },
	opts?: { memberOrderIds?: string[] }
): Promise<void> {
	if (!browser) return;
	disconnectGame();
	const order = opts?.memberOrderIds;
	if (order && order.length > 0) {
		playerOrder.set(order);
	}
	supabase = createSupabaseBrowserClient();
	activeUserId.set(presence.userId);

	const topic = `game:${lobbyId}`;
	const ch = supabase.channel(topic, {
		config: {
			broadcast: { self: false },
			presence: { key: presence.userId }
		}
	});

	ch.on('broadcast', { event: 'piece_move' }, ({ payload }) => {
		const p = payload as { id: number; x: number; y: number };
		game.remotePieceMove(p.id, p.x, p.y);
	});

	ch.on('broadcast', { event: 'piece_moves_batch' }, ({ payload }) => {
		const p = payload as { moves?: Array<{ id: number; x: number; y: number }> };
		if (!Array.isArray(p?.moves) || p.moves.length === 0) return;
		game.remotePieceMovesBatch(p.moves);
	});

	ch.on('broadcast', { event: 'piece_flip' }, ({ payload }) => {
		const p = payload as { id: number; isFlipped: boolean };
		game.remotePieceFlip(p.id, p.isFlipped);
	});

	ch.on('broadcast', { event: 'piece_shuffle' }, ({ payload }) => {
		const p = payload as { id: number; zindex: number; x: number; y: number };
		game.remotePieceShuffle(p.id, p.zindex, p.x, p.y);
	});

	ch.on('broadcast', { event: 'piece_zindexchange' }, ({ payload }) => {
		const p = payload as { id: number; zindex: number };
		game.remotePieceZIndex(p.id, p.zindex);
	});

	ch.on('broadcast', { event: 'piece_select' }, ({ payload }) => {
		const p = payload as { id: number; color: string };
		game.remotePieceSelect(p.id, p.color);
	});

	ch.on('broadcast', { event: 'piece_deselect' }, ({ payload }) => {
		const p = payload as { id: number };
		game.remotePieceDeselect(p.id);
	});

	ch.on('broadcast', { event: 'piece_destroy' }, ({ payload }) => {
		const p = payload as { id: number };
		if (typeof p.id === 'number') game.remotePieceDestroy(p.id);
	});

	ch.on('broadcast', { event: 'window_open' }, ({ payload }) => {
		const p = payload as { winid: string };
		if (browser) {
			window.dispatchEvent(new CustomEvent('bge:window_open', { detail: p }));
		}
	});

	ch.on(
		'broadcast',
		{ event: 'window_roller_roll' },
		({ payload }) => {
			const p = payload as {
				kind?: string;
				rollId?: string;
				datestr: string;
				name?: string;
				result?: string | number;
				results?: (string | number)[];
				total?: number | null;
				dice?: { tab: string; value: string | number }[];
				segments?: { tab: string; results: (string | number)[]; total: number | null }[];
				grandTotal?: number | null;
				faceCounts?: Record<string, number>;
			};
			if (browser) {
				window.dispatchEvent(new CustomEvent('bge:roller_roll', { detail: p }));
			}
		}
	);

	ch.on('broadcast', { event: 'widget_value_change' }, ({ payload }) => {
		const p = payload as { widgetId: number; value: string | number | boolean };
		if (typeof p.widgetId !== 'number') return;
		game.setWidgetValue(p.widgetId, p.value);
	});

	ch.on('broadcast', { event: 'player_slot_score' }, ({ payload }) => {
		const p = payload as { slotIndex?: number; value?: number };
		if (typeof p.slotIndex !== 'number' || typeof p.value !== 'number') return;
		game.applyPlayerSlotScore(p.slotIndex, p.value);
	});

	ch.on('broadcast', { event: 'turn_highlight' }, ({ payload }) => {
		const p = payload as { userIds?: string[] };
		if (Array.isArray(p.userIds)) {
			turnHighlightUserIds.set([...p.userIds].sort((a, b) => a.localeCompare(b)));
		}
	});

	ch.on('broadcast', { event: 'player_order' }, ({ payload }) => {
		const p = payload as { userIds?: string[] };
		if (Array.isArray(p.userIds) && p.userIds.length > 0) {
			playerOrder.set(p.userIds);
		}
	});

	ch.on('broadcast', { event: 'player_color' }, ({ payload }) => {
		applyPlayerColorFromBroadcast(payload as Record<string, unknown>);
	});

	ch.on('broadcast', { event: 'game_end' }, () => {
		if (browser) {
			window.dispatchEvent(new CustomEvent('bge:game_end'));
		}
	});

	ch.on('broadcast', { event: 'history_open' }, ({ payload }) => {
		const p = payload as { index?: number };
		if (browser) {
			window.dispatchEvent(
				new CustomEvent('bge:history_open', {
					detail: { index: typeof p?.index === 'number' ? p.index : 0 }
				})
			);
		}
	});

	ch.on('broadcast', { event: 'history_scrub' }, ({ payload }) => {
		const p = payload as { index?: number };
		if (browser && typeof p?.index === 'number') {
			window.dispatchEvent(new CustomEvent('bge:history_scrub', { detail: { index: p.index } }));
		}
	});

	ch.on('broadcast', { event: 'history_close' }, () => {
		if (browser) {
			window.dispatchEvent(new CustomEvent('bge:history_close'));
		}
	});

	ch.on('broadcast', { event: 'history_restore' }, ({ payload }) => {
		const p = payload as { historyId?: number };
		if (browser && typeof p?.historyId === 'number') {
			window.dispatchEvent(
				new CustomEvent('bge:history_restore', { detail: { historyId: p.historyId } })
			);
		}
	});

	ch.on('broadcast', { event: 'sync_state_request' }, ({ payload }) => {
		const p = payload as { requesterId?: string };
		if (typeof p.requesterId !== 'string') return;
		const myId = get(activeUserId);
		if (!myId || p.requesterId === myId) return;
		if (!get(game.game).loaded) return;
		if (!isSyncResponder(p.requesterId, myId)) return;
		const snapshot = game.serializeGameState();
		emit('sync_state', {
			forUserId: p.requesterId,
			snapshot: snapshot as unknown as Record<string, unknown>
		});
	});

	ch.on('broadcast', { event: 'sync_state' }, ({ payload }) => {
		const p = payload as { forUserId?: string; snapshot?: unknown };
		const myId = get(activeUserId);
		if (!myId || p.forUserId !== myId) return;
		if (!game.isStoredGameSnapshot(p.snapshot)) return;
		const snap = p.snapshot as StoredGameSnapshot;
		game.applyStoredGameSnapshot(snap);
		/** Legacy snapshots from older clients lack layout fields; stock games can hydrate from static JSON. */
		if (game.snapshotNeedsLayoutHydration(snap)) {
			const curGame = get(game.game).curGame;
			if (!isCustomGameKey(curGame)) {
				void fetch(`/data/${curGame}/pieces.json`)
					.then((r) => r.json())
					.then((j) =>
						game.mergeGameLayoutFromGameData(j as GameDataJson, { assetBaseUrl: null })
					)
					.catch(() => {});
			}
		}
	});

	ch.on('presence', { event: 'sync' }, () => applyPresenceToUsers(ch, presence.userId));

	await new Promise<void>((resolve, reject) => {
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				connected.set(true);
				log('Connected to game');
				lastPresenceForTrack = {
					userId: presence.userId,
					displayName: presence.displayName,
					avatarUrl: presence.avatarUrl ?? null
				};
				await ch.track({
					user_id: presence.userId,
					name: presence.displayName,
					color: resolveLocalPlayerColor(presence.userId),
					avatar_url: presence.avatarUrl ?? null,
					online: true
				});
				gameChannel = ch;
				resolve();
			} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
				reject(new Error(`Game channel: ${status}`));
			}
		});
	});
}
