import type { CardLayer } from './types';
import { GOOGLE_FONT_FAMILIES, GOOGLE_FONT_FAMILY_SET } from './googleFontsCatalog';

const loadedFamilies = new Set<string>();

/** First font family from a CSS `font-family` stack (e.g. `'Inter', sans-serif` → Inter). */
export function extractPrimaryFontFamily(css: string): string | null {
	const head = css.split(',')[0]?.trim() ?? '';
	if (!head) return null;
	const q = head.match(/^["']([^"']+)["']$/);
	if (q) return q[1].trim();
	if (/^[\w\s-]+$/.test(head)) return head;
	return null;
}

/** Resolve user input → canonical catalog spelling, or null. */
export function canonicalGoogleFontName(name: string): string | null {
	const t = name.trim().toLowerCase();
	for (const f of GOOGLE_FONT_FAMILIES) {
		if (f.toLowerCase() === t) return f;
	}
	return null;
}

function linkId(canonical: string): string {
	return `gf-${canonical.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
}

/**
 * Injects a single Google Fonts stylesheet for `family` if it is in our catalog and not already loaded.
 */
export function ensureGoogleFontLoaded(familyName: string): void {
	if (typeof document === 'undefined') return;
	const canonical = canonicalGoogleFontName(familyName);
	if (!canonical) return;
	if (loadedFamilies.has(canonical)) return;
	const id = linkId(canonical);
	if (document.getElementById(id)) {
		loadedFamilies.add(canonical);
		return;
	}
	const param = encodeURIComponent(canonical).replace(/%20/g, '+');
	const href = `https://fonts.googleapis.com/css2?family=${param}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700&display=swap`;
	const link = document.createElement('link');
	link.id = id;
	link.rel = 'stylesheet';
	link.href = href;
	document.head.appendChild(link);
	loadedFamilies.add(canonical);
}

export function isGoogleFontStack(css: string): boolean {
	const primary = extractPrimaryFontFamily(css);
	if (!primary) return false;
	return GOOGLE_FONT_FAMILY_SET.has(primary.toLowerCase());
}

export function ensureGoogleFontsForLayers(layers: CardLayer[]): void {
	for (const L of layers) {
		if (L.type !== 'text') continue;
		const primary = extractPrimaryFontFamily(L.fontFamily);
		if (!primary) continue;
		if (GOOGLE_FONT_FAMILY_SET.has(primary.toLowerCase())) {
			ensureGoogleFontLoaded(primary);
		}
	}
}
