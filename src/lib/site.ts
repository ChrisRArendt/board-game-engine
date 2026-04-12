/** Short brand suffix for `<title>` (e.g. `Lobby | BGE`). */
export const SITE_BRAND = 'BGE';

export function pageTitle(segment: string): string {
	const s = segment.trim();
	return s ? `${s} | ${SITE_BRAND}` : SITE_BRAND;
}
