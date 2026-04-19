import { browser } from '$app/environment';

const key = (gameId: string) => `bge-print-pdf-qty:${gameId}`;

function clampQty(n: number): number {
	if (!Number.isFinite(n)) return 1;
	const f = Math.floor(n);
	return Math.max(1, Math.min(999, f));
}

/** Per–card-instance quantities for the print-ready PDF dialog (local only). */
export function loadPrintPdfQuantities(gameId: string): Record<string, number> {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(key(gameId));
		if (!raw) return {};
		const o = JSON.parse(raw) as unknown;
		if (typeof o !== 'object' || o === null || Array.isArray(o)) return {};
		const out: Record<string, number> = {};
		for (const [id, v] of Object.entries(o as Record<string, unknown>)) {
			const n = typeof v === 'number' ? v : parseInt(String(v), 10);
			if (Number.isFinite(n)) out[id] = clampQty(n);
		}
		return out;
	} catch {
		return {};
	}
}

/**
 * Merges `partial` into stored quantities and keeps only `validCardIds`.
 * Call after the user edits a quantity so the next dialog open restores it.
 */
export function savePrintPdfQuantities(
	gameId: string,
	partial: Record<string, number>,
	validCardIds: Set<string>
): void {
	if (!browser) return;
	const prev = loadPrintPdfQuantities(gameId);
	const merged: Record<string, number> = { ...prev };
	for (const [id, q] of Object.entries(partial)) {
		if (!validCardIds.has(id)) continue;
		merged[id] = clampQty(q);
	}
	const out: Record<string, number> = {};
	for (const id of validCardIds) {
		const q = merged[id];
		if (q != null) out[id] = q;
	}
	try {
		localStorage.setItem(key(gameId), JSON.stringify(out));
	} catch {
		/* quota / private mode */
	}
}
