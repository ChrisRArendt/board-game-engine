import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';
import * as game from './game';
import { users } from './users';
import { createSupabaseBrowserClient } from '$lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const connected = writable(false);
export const connectionLog = writable<string[]>([]);
/** Supabase auth user id while connected */
export const activeUserId = writable('');
/** @deprecated use activeUserId — kept for gradual migration */
export const activeSocketId = activeUserId;

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

/** Broadcast on lobby channel (waiting room), e.g. game_start */
export function emitLobby(type: string, data: Record<string, unknown>) {
	if (!browser || !lobbyChannel) return false;
	void lobbyChannel.send({
		type: 'broadcast',
		event: type,
		payload: data
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
	users.set([]);
}

export function disconnectLobby() {
	if (lobbyChannel) {
		void supabase.removeChannel(lobbyChannel);
		lobbyChannel = null;
	}
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
		}[];
		const meta = presences?.[0];
		if (!meta?.user_id || meta.user_id === selfId) continue;
		list.push({
			id: meta.user_id,
			name: meta.name ?? 'Player',
			color: meta.color ?? hueFromUserId(meta.user_id),
			connected: true
		});
	}
	users.set(list);
}

/**
 * Waiting room: presence + game_start broadcast only.
 */
export async function connectLobbyChannel(
	lobbyId: string,
	presence: { userId: string; displayName: string }
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

	ch.on('broadcast', { event: 'game_start' }, () => {
		if (browser) {
			window.dispatchEvent(new CustomEvent('bge:game_start'));
		}
	});

	ch.on('presence', { event: 'sync' }, () => applyPresenceToUsers(ch, presence.userId));

	await new Promise<void>((resolve, reject) => {
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				await ch.track({
					user_id: presence.userId,
					name: presence.displayName,
					color: hueFromUserId(presence.userId),
					ready: false
				});
				log(`Lobby channel ${topic}`);
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
 */
export async function connectGameChannel(
	lobbyId: string,
	presence: { userId: string; displayName: string }
): Promise<void> {
	if (!browser) return;
	disconnectGame();
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

	ch.on('presence', { event: 'sync' }, () => applyPresenceToUsers(ch, presence.userId));

	await new Promise<void>((resolve, reject) => {
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				connected.set(true);
				log(`Game channel ${topic}`);
				await ch.track({
					user_id: presence.userId,
					name: presence.displayName,
					color: hueFromUserId(presence.userId),
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
