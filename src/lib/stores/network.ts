import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';
import * as game from './game';
import { clearRollerLog } from './rollerLog';
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

let gameChannel: RealtimeChannel | null = null;
let lobbyChannel: RealtimeChannel | null = null;
let supabase = createSupabaseBrowserClient();

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

export function getLocalPlayerColor(): string {
	const uid = get(activeUserId);
	return uid ? hueFromUserId(uid) : '#888';
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

	ch.on('presence', { event: 'sync' }, () => applyPresenceToUsers(ch, presence.userId));

	await new Promise<void>((resolve, reject) => {
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				await ch.track({
					user_id: presence.userId,
					name: presence.displayName,
					color: hueFromUserId(presence.userId),
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
			const p = payload as { rollId: string; result: string | number; datestr: string };
			if (browser) {
				window.dispatchEvent(new CustomEvent('bge:roller_roll', { detail: p }));
			}
		}
	);

	ch.on('broadcast', { event: 'textregion_change' }, ({ payload }) => {
		const p = payload as { winid: string; val: string };
		game.setTextRegion(p.winid, p.val);
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

	ch.on('broadcast', { event: 'game_end' }, () => {
		if (browser) {
			window.dispatchEvent(new CustomEvent('bge:game_end'));
		}
	});

	ch.on('presence', { event: 'sync' }, () => applyPresenceToUsers(ch, presence.userId));

	await new Promise<void>((resolve, reject) => {
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				connected.set(true);
				log('Connected to game');
				await ch.track({
					user_id: presence.userId,
					name: presence.displayName,
					color: hueFromUserId(presence.userId),
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
