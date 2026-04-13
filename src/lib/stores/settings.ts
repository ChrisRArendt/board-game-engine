import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { THEME_STORAGE_KEY, type ThemePreference, isThemePreference } from '$lib/theme';

const KEYS = {
	zoomWithScroll: 'bge_settings_interface_zoomWithScroll',
	panScreenEdge: 'bge_settings_interface_panScreenEdge',
	playerColor: 'bge_settings_player_color',
	address: 'bge_settings_connection_address',
	username: 'bge_settings_connection_username',
	theme: THEME_STORAGE_KEY
} as const;

function loadBool(key: string, defaultVal: boolean): boolean {
	if (!browser) return defaultVal;
	return localStorage.getItem(key) === 'true';
}

function loadStr(key: string, defaultVal: string): string {
	if (!browser) return defaultVal;
	return localStorage.getItem(key) ?? defaultVal;
}

function loadThemePreference(): ThemePreference {
	const raw = loadStr(KEYS.theme, 'dark');
	return isThemePreference(raw) ? raw : 'dark';
}

export const settings = writable({
	zoomWithScroll: loadBool(KEYS.zoomWithScroll, false),
	panScreenEdge: loadBool(KEYS.panScreenEdge, false),
	/** Empty = use automatic hue from account id */
	playerColor: loadStr(KEYS.playerColor, ''),
	connectionAddress: loadStr(KEYS.address, 'localhost'),
	connectionUsername: loadStr(KEYS.username, 'Guest'),
	/** UI appearance: system follows OS light/dark */
	themePreference: loadThemePreference()
});

export function persistSettings(s: {
	zoomWithScroll?: boolean;
	panScreenEdge?: boolean;
	playerColor?: string;
	connectionAddress?: string;
	connectionUsername?: string;
	themePreference?: ThemePreference;
}) {
	settings.update((cur) => {
		const next = { ...cur, ...s };
		if (browser) {
			if (s.zoomWithScroll !== undefined)
				localStorage.setItem(KEYS.zoomWithScroll, String(next.zoomWithScroll));
			if (s.panScreenEdge !== undefined)
				localStorage.setItem(KEYS.panScreenEdge, String(next.panScreenEdge));
			if (s.playerColor !== undefined)
				localStorage.setItem(KEYS.playerColor, next.playerColor);
			if (s.connectionAddress !== undefined)
				localStorage.setItem(KEYS.address, next.connectionAddress);
			if (s.connectionUsername !== undefined)
				localStorage.setItem(KEYS.username, next.connectionUsername);
			if (s.themePreference !== undefined)
				localStorage.setItem(KEYS.theme, next.themePreference);
		}
		return next;
	});
}
