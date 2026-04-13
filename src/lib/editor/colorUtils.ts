/** Normalize user hex input to lowercase `#rrggbb` when possible. */
export function normalizeHex(v: string): string {
	const t = v.trim();
	if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
	if (/^#[0-9a-fA-F]{3}$/.test(t)) {
		const r = t[1],
			g = t[2],
			b = t[3];
		return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
	}
	return t.startsWith('#') ? t : `#${t}`;
}

/** `type="color"` requires `#rrggbb`. */
export function hexForColorInput(v: string): string {
	const n = normalizeHex(v);
	if (/^#[0-9a-f]{6}$/.test(n)) return n;
	return '#808080';
}
