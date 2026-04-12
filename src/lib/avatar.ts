/** Stable HSL background for fallback when no photo. */
export function avatarFallbackHue(seed: string): number {
	let h = 0;
	for (let i = 0; i < seed.length; i++) {
		h = (h + seed.charCodeAt(i) * (i + 1)) % 360;
	}
	return h;
}

export function initialsFromDisplayName(name: string): string {
	const t = name.trim();
	if (!t) return '?';
	const parts = t.split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}
	return t.slice(0, 2).toUpperCase();
}
