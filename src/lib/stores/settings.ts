import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { THEME_STORAGE_KEY, type ThemePreference, isThemePreference } from '$lib/theme';

const KEYS = {
	/** When true, scroll wheel pans; when false (default), scroll wheel zooms. */
	scrollWheelPans: 'bge_settings_interface_scrollWheelPans',
	/** @deprecated migrated into scrollWheelPans — kept for one-time migration */
	_zoomWithScrollLegacy: 'bge_settings_interface_zoomWithScroll',
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

/**
 * Default: scroll wheel zooms. Legacy `zoomWithScroll` meant the opposite (true = zoom).
 */
function loadScrollWheelPans(): boolean {
	if (!browser) return false;
	const v = localStorage.getItem(KEYS.scrollWheelPans);
	if (v !== null) return v === 'true';
	const legacy = localStorage.getItem(KEYS._zoomWithScrollLegacy);
	if (legacy !== null) {
		const migrated = legacy !== 'true';
		localStorage.setItem(KEYS.scrollWheelPans, String(migrated));
		return migrated;
	}
	return false;
}

export const settings = writable({
	scrollWheelPans: loadScrollWheelPans(),
	panScreenEdge: loadBool(KEYS.panScreenEdge, false),
	/** Empty = use automatic hue from account id */
	playerColor: loadStr(KEYS.playerColor, ''),
	connectionAddress: loadStr(KEYS.address, 'localhost'),
	connectionUsername: loadStr(KEYS.username, 'Guest'),
	/** UI appearance: system follows OS light/dark */
	themePreference: loadThemePreference()
});

export function persistSettings(s: {
	scrollWheelPans?: boolean;
	panScreenEdge?: boolean;
	playerColor?: string;
	connectionAddress?: string;
	connectionUsername?: string;
	themePreference?: ThemePreference;
}) {
	settings.update((cur) => {
		const next = { ...cur, ...s };
		if (browser) {
			if (s.scrollWheelPans !== undefined)
				localStorage.setItem(KEYS.scrollWheelPans, String(next.scrollWheelPans));
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
