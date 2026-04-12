import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { io, type Socket } from 'socket.io-client';
import * as game from './game';
import { users } from './users';
import { getStoredSocketId, setStoredSocketId } from './settings';

export const connected = writable(false);
export const connectionLog = writable<string[]>([]);
export const activeSocketId = writable('');

let socket: Socket | null = null;

function log(line: string) {
	connectionLog.update((l) => [line, ...l].slice(0, 80));
}

export function emit(type: string, data: Record<string, unknown>) {
	if (!socket?.connected) return false;
	socket.emit(type, data);
	return true;
}

export function disconnect() {
	if (socket) {
		socket.removeAllListeners();
		socket.disconnect();
		socket = null;
	}
	connected.set(false);
	activeSocketId.set('');
}

/** Connect to multiplayer relay. Use `undefined` URL for same-origin (Vite dev + integrated Socket.IO). */
export function connect(serverUrl: string | undefined, displayName: string) {
	if (!browser) return;
	disconnect();

	const previousSocketId = getStoredSocketId();
	const opts = { path: '/socket.io/', transports: ['websocket', 'polling'] as string[] };

	socket = serverUrl ? io(serverUrl, opts) : io(opts);

	socket.on('connect', () => {
		const sid = socket?.id ?? '';
		connected.set(true);
		activeSocketId.set(sid);
		log(`Connected as ${sid}`);
		socket?.emit('user_init', {
			socketId: sid,
			previousSocketId: previousSocketId ?? undefined,
			name: displayName
		});
		setStoredSocketId(sid);
	});

	socket.on('disconnect', () => {
		connected.set(false);
		log('Disconnected');
	});

	socket.on('connect_error', (err) => {
		log(`Connect error: ${err.message}`);
		connected.set(false);
	});

	socket.on('piece_move', (data: { id: number; x: number; y: number }) => {
		game.remotePieceMove(data.id, data.x, data.y);
	});

	socket.on('piece_flip', (data: { id: number; isFlipped: boolean }) => {
		game.remotePieceFlip(data.id, data.isFlipped);
	});

	socket.on(
		'piece_shuffle',
		(data: { id: number; zindex: number; x: number; y: number }) => {
			game.remotePieceShuffle(data.id, data.zindex, data.x, data.y);
		}
	);

	socket.on('piece_zindexchange', (data: { id: number; zindex: number }) => {
		game.remotePieceZIndex(data.id, data.zindex);
	});

	socket.on('piece_select', (data: { id: number; color: string }) => {
		game.remotePieceSelect(data.id, data.color);
	});

	socket.on('piece_deselect', (data: { id: number }) => {
		game.remotePieceDeselect(data.id);
	});

	socket.on(
		'user_listing',
		(data: { socketId: string; color: string; name: string; connected: boolean }[]) => {
			users.set(data);
		}
	);

	socket.on('window_open', (data: { winid: string }) => {
		if (browser) {
			window.dispatchEvent(new CustomEvent('bge:window_open', { detail: data }));
		}
	});

	socket.on(
		'window_roller_roll',
		(data: { rollId: string; result: string | number; datestr: string }) => {
			if (browser) {
				window.dispatchEvent(new CustomEvent('bge:roller_roll', { detail: data }));
			}
		}
	);

	socket.on('textregion_change', (data: { winid: string; val: string }) => {
		game.setTextRegion(data.winid, data.val);
	});
}
