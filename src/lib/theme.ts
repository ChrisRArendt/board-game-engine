import { browser } from '$app/environment';

/** Must match `KEYS.theme` in `settings.ts` and the inline script in `app.html`. */
export const THEME_STORAGE_KEY = 'bge_settings_theme';

export type ThemePreference = 'system' | 'light' | 'dark';

export function isThemePreference(s: string | null | undefined): s is ThemePreference {
	return s === 'system' || s === 'light' || s === 'dark';
}

export function resolveEffectiveTheme(pref: ThemePreference): 'light' | 'dark' {
	if (pref === 'light') return 'light';
	if (pref === 'dark') return 'dark';
	if (!browser || typeof window === 'undefined') return 'dark';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Apply resolved light/dark to `<html>` (dataset + color-scheme). */
export function applyThemePreference(pref: ThemePreference): void {
	if (!browser || typeof document === 'undefined') return;
	const effective = resolveEffectiveTheme(pref);
	document.documentElement.dataset.theme = effective;
	document.documentElement.style.setProperty('color-scheme', effective);
}

/**
 * When preference is `system`, re-apply when OS color scheme changes.
 * Returns a dispose function.
 */
export function subscribeSystemThemeChange(onEffectiveChange: () => void): () => void {
	if (!browser || typeof window === 'undefined') return () => {};
	const mq = window.matchMedia('(prefers-color-scheme: dark)');
	const handler = () => onEffectiveChange();
	mq.addEventListener('change', handler);
	return () => mq.removeEventListener('change', handler);
}

/** Browser UI tint (align with `--theme-color-meta` in `app.css`). */
export function themeColorForMeta(pref: ThemePreference): string {
	return resolveEffectiveTheme(pref) === 'dark' ? '#0f172a' : '#1e293b';
}
