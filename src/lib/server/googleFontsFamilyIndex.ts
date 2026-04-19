import { GOOGLE_FONT_FAMILIES } from '$lib/editor/googleFontsCatalog';

/** Public metadata blob (large); we only read `familyMetadataList[].family`. */
const GOOGLE_FONTS_METADATA_URL = 'https://fonts.google.com/metadata/fonts';

/** In-memory cache so all users hit the same process-local index between deploys. */
const TTL_MS = 24 * 60 * 60 * 1000;

let cache: { families: string[]; fetchedAt: number } | null = null;

export async function getGoogleFontFamilyNames(): Promise<string[]> {
	if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
		return cache.families;
	}
	try {
		const res = await fetch(GOOGLE_FONTS_METADATA_URL, {
			headers: { 'User-Agent': 'board-game-engine/1.0' }
		});
		if (!res.ok) throw new Error(`metadata ${res.status}`);
		const data = (await res.json()) as { familyMetadataList?: { family: string }[] };
		const list = data.familyMetadataList;
		if (!Array.isArray(list) || list.length === 0) throw new Error('empty metadata');
		const families = [...new Set(list.map((x) => x.family))].sort((a, b) =>
			a.localeCompare(b, undefined, { sensitivity: 'base' })
		);
		cache = { families, fetchedAt: Date.now() };
		return families;
	} catch {
		const fallback = [...GOOGLE_FONT_FAMILIES];
		cache = { families: fallback, fetchedAt: Date.now() };
		return fallback;
	}
}
