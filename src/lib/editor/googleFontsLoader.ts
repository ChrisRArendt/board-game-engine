import type { CardLayer } from './types';
import { GOOGLE_FONT_FAMILIES } from './googleFontsCatalog';

const loadedFamilies = new Set<string>();

/** Min delay between injecting new Google Font stylesheets (preview list / scroll). */
const PREVIEW_LOAD_MIN_INTERVAL_MS = 80;

let previewVisiblePriority = new Map<string, number>();
let previewPumpTimer: ReturnType<typeof setTimeout> | null = null;

const staticLcToCanonical = new Map(GOOGLE_FONT_FAMILIES.map((f) => [f.toLowerCase(), f]));

/** Populated when `/api/google-fonts` loads; full catalog from Google metadata. */
let apiLcToCanonical = new Map<string, string>();

/** Known Google families (static + API) for `isGoogleFontStack` / layer preloads — not pass-through names. */
let mergedKnownLc = new Set(staticLcToCanonical.keys());

/**
 * Register the full family list from the server (see `/api/google-fonts`).
 * Safe to call multiple times with the same list.
 */
export function registerGoogleFontFamiliesFromApi(families: string[]): void {
	apiLcToCanonical = new Map(families.map((f) => [f.toLowerCase(), f]));
	mergedKnownLc = new Set([...staticLcToCanonical.keys(), ...apiLcToCanonical.keys()]);
}

/** First font family from a CSS `font-family` stack (e.g. `'Inter', sans-serif` → Inter). */
export function extractPrimaryFontFamily(css: string): string | null {
	const head = css.split(',')[0]?.trim() ?? '';
	if (!head) return null;
	const q = head.match(/^["']([^"']+)["']$/);
	if (q) return q[1].trim();
	if (/^[\w\s-]+$/.test(head)) return head;
	return null;
}

/**
 * Resolve a name to the string we use in Google’s CSS URL (canonical casing when known).
 * Unknown-but-safe names pass through so pasted stacks work before the index loads.
 */
export function canonicalGoogleFontName(name: string): string | null {
	const t = name.trim();
	if (!t) return null;
	const lc = t.toLowerCase();
	const fromApi = apiLcToCanonical.get(lc);
	if (fromApi) return fromApi;
	const fromStatic = staticLcToCanonical.get(lc);
	if (fromStatic) return fromStatic;
	if (t.length >= 2 && t.length <= 120 && !/[<>{}]/.test(t)) return t;
	return null;
}

function linkId(canonical: string): string {
	return `gf-${canonical.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
}

/**
 * Injects a single Google Fonts stylesheet for `family` if resolvable and not already loaded.
 * @returns true if a new stylesheet was injected
 */
export function ensureGoogleFontLoaded(familyName: string): boolean {
	if (typeof document === 'undefined') return false;
	const canonical = canonicalGoogleFontName(familyName);
	if (!canonical) return false;
	if (loadedFamilies.has(canonical)) return false;
	const id = linkId(canonical);
	if (document.getElementById(id)) {
		loadedFamilies.add(canonical);
		return false;
	}
	const param = encodeURIComponent(canonical).replace(/%20/g, '+');
	const href = `https://fonts.googleapis.com/css2?family=${param}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700&display=swap`;
	const link = document.createElement('link');
	link.id = id;
	link.rel = 'stylesheet';
	link.href = href;
	document.head.appendChild(link);
	loadedFamilies.add(canonical);
	return true;
}

/**
 * Updates which catalog families should load for in-list previews (viewport-first by intersection ratio).
 * Call from an IntersectionObserver when visible rows change; stale families are omitted from `visible`.
 */
export function syncGoogleFontPreviewQueue(visible: ReadonlyMap<string, number>): void {
	if (typeof document === 'undefined') return;
	if (previewPumpTimer !== null) {
		clearTimeout(previewPumpTimer);
		previewPumpTimer = null;
	}
	previewVisiblePriority = new Map(visible);
	pumpGoogleFontPreviewQueue();
}

function pumpGoogleFontPreviewQueue(): void {
	const sorted = [...previewVisiblePriority.entries()].sort((a, b) => b[1] - a[1]);
	for (const [fam] of sorted) {
		if (!previewVisiblePriority.has(fam)) continue;
		const didInject = ensureGoogleFontLoaded(fam);
		if (didInject) {
			previewPumpTimer = setTimeout(() => {
				previewPumpTimer = null;
				pumpGoogleFontPreviewQueue();
			}, PREVIEW_LOAD_MIN_INTERVAL_MS);
			return;
		}
	}
}

export function isGoogleFontStack(css: string): boolean {
	const primary = extractPrimaryFontFamily(css);
	if (!primary) return false;
	return mergedKnownLc.has(primary.toLowerCase());
}

export function ensureGoogleFontsForLayers(layers: CardLayer[]): void {
	for (const L of layers) {
		if (L.type !== 'text') continue;
		const primary = extractPrimaryFontFamily(L.fontFamily);
		if (!primary) continue;
		if (canonicalGoogleFontName(primary)) ensureGoogleFontLoaded(primary);
	}
}
