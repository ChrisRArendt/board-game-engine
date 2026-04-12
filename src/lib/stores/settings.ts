import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const KEYS = {
	zoomWithScroll: 'bge_settings_interface_zoomWithScroll',
	panScreenEdge: 'bge_settings_interface_panScreenEdge',
	address: 'bge_settings_connection_address',
	username: 'bge_settings_connection_username',
	socketId: 'bge_user_socketId'
} as const;

function loadBool(key: string, defaultVal: boolean): boolean {
	if (!browser) return defaultVal;
	return localStorage.getItem(key) === 'true';
}

function loadStr(key: string, defaultVal: string): string {
	if (!browser) return defaultVal;
	return localStorage.getItem(key) ?? defaultVal;
}

export const settings = writable({
	zoomWithScroll: loadBool(KEYS.zoomWithScroll, false),
	panScreenEdge: loadBool(KEYS.panScreenEdge, false),
	connectionAddress: loadStr(KEYS.address, 'localhost'),
	connectionUsername: loadStr(KEYS.username, 'Guest')
});

export function persistSettings(s: {
	zoomWithScroll?: boolean;
	panScreenEdge?: boolean;
	connectionAddress?: string;
	connectionUsername?: string;
}) {
	settings.update((cur) => {
		const next = { ...cur, ...s };
		if (browser) {
			if (s.zoomWithScroll !== undefined)
				localStorage.setItem(KEYS.zoomWithScroll, String(next.zoomWithScroll));
			if (s.panScreenEdge !== undefined)
				localStorage.setItem(KEYS.panScreenEdge, String(next.panScreenEdge));
			if (s.connectionAddress !== undefined)
				localStorage.setItem(KEYS.address, next.connectionAddress);
			if (s.connectionUsername !== undefined)
				localStorage.setItem(KEYS.username, next.connectionUsername);
		}
		return next;
	});
}

export function getStoredSocketId(): string | null {
	if (!browser) return null;
	return localStorage.getItem(KEYS.socketId);
}

export function setStoredSocketId(id: string) {
	if (browser) localStorage.setItem(KEYS.socketId, id);
}
