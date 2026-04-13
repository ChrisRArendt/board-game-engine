import type { Json } from '$lib/supabase/database.types';
import type { CardLayer, FieldBinding, TextLayer } from './types';

/** Per-piece overrides for a bound field (stored under `field_values.fieldStyles`). */
export interface PieceFieldStyle {
	textColor?: string;
	backgroundColor?: string;
}

export function collectFieldBindings(layers: CardLayer[]): FieldBinding[] {
	const seen = new Set<string>();
	const out: FieldBinding[] = [];
	for (const L of layers) {
		if (!L.fieldBinding) continue;
		const fn = L.fieldBinding.fieldName;
		if (seen.has(fn)) continue;
		seen.add(fn);
		out.push(L.fieldBinding);
	}
	return out;
}

/**
 * Splits `card_instances.field_values` JSON into flat string values and optional per-field styles.
 * Legacy rows are flat `{ fieldName: string }` only.
 */
export function splitFieldValuesPayload(raw: unknown): {
	values: Record<string, string>;
	styles: Record<string, PieceFieldStyle>;
} {
	const values: Record<string, string> = {};
	const styles: Record<string, PieceFieldStyle> = {};
	if (typeof raw !== 'object' || raw === null) return { values, styles };
	const o = raw as Record<string, unknown>;
	for (const [k, v] of Object.entries(o)) {
		if (k === 'fieldStyles') {
			if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
				for (const [fk, sv] of Object.entries(v as Record<string, unknown>)) {
					if (typeof sv === 'object' && sv !== null) {
						const s = sv as Record<string, unknown>;
						styles[fk] = {
							textColor: typeof s.textColor === 'string' ? s.textColor : undefined,
							backgroundColor: typeof s.backgroundColor === 'string' ? s.backgroundColor : undefined
						};
					}
				}
			}
			continue;
		}
		values[k] = typeof v === 'string' ? v : String(v ?? '');
	}
	return { values, styles };
}

/** Parse stored JSON from `card_instances.field_values` into string values (excludes `fieldStyles`). */
export function parseStoredFieldValues(raw: unknown): Record<string, string> {
	return splitFieldValuesPayload(raw).values;
}

/** Build JSON for `card_instances.field_values` including optional `fieldStyles`. */
export function buildCardFieldValuesPayload(
	fieldValues: Record<string, string>,
	pieceStyles: Record<string, PieceFieldStyle>,
	bindings: FieldBinding[]
): Json {
	const o: Record<string, unknown> = { ...fieldValues };
	const fs: Record<string, PieceFieldStyle> = {};
	for (const b of bindings) {
		const ps = pieceStyles[b.fieldName];
		if (!ps) continue;
		const e: PieceFieldStyle = {};
		if (ps.textColor?.trim()) e.textColor = ps.textColor.trim();
		if (ps.backgroundColor?.trim()) e.backgroundColor = ps.backgroundColor.trim();
		if (e.textColor || e.backgroundColor) fs[b.fieldName] = e;
	}
	if (Object.keys(fs).length) o.fieldStyles = fs;
	return o as Json;
}

/**
 * Ensures every binding key exists so `bind:value` stays reliable.
 * Prefers stored values; otherwise defaultValue, then text layer `content` when default is empty.
 */
export function mergeFieldValuesForBindings(
	stored: Record<string, string>,
	bindings: FieldBinding[],
	layers: CardLayer[]
): Record<string, string> {
	const out: Record<string, string> = {};
	const layerByField = new Map<string, CardLayer>();
	for (const L of layers) {
		if (L.fieldBinding) layerByField.set(L.fieldBinding.fieldName, L);
	}
	for (const b of bindings) {
		const raw = stored[b.fieldName];
		const hasStored = raw !== undefined && raw !== '';
		if (hasStored) {
			out[b.fieldName] = raw;
			continue;
		}
		const layer = layerByField.get(b.fieldName);
		let fallback = b.defaultValue ?? '';
		if (!fallback && layer?.type === 'text') {
			fallback = (layer as TextLayer).content ?? '';
		}
		out[b.fieldName] = fallback;
	}
	for (const [k, v] of Object.entries(stored)) {
		if (!(k in out)) out[k] = v;
	}
	return out;
}
