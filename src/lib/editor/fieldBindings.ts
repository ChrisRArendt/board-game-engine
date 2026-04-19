import type { Json } from '$lib/supabase/database.types';
import type { CardLayer, FieldBinding, ShapeLayer, TextLayer } from './types';

/** Per-piece overrides for a bound field (stored under `field_values.fieldStyles`). */
export interface PieceFieldStyle {
	textColor?: string;
	backgroundColor?: string;
	/** Override template text `fontSize` (px). */
	fontSize?: number;
}

/** Unique field bindings from one or more layer lists (e.g. front + back). */
export function collectFieldBindings(...layerGroups: CardLayer[][]): FieldBinding[] {
	const seen = new Set<string>();
	const out: FieldBinding[] = [];
	for (const layers of layerGroups) {
		for (const L of layers) {
			if (!L.fieldBinding) continue;
			if (L.type === 'shape') {
				const S = L as ShapeLayer;
				if (
					S.fill.type === 'gradient' &&
					S.gradientColorBindings &&
					S.gradientColorBindings.length > 0 &&
					S.gradientColorBindings.length === S.fill.stops.length
				) {
					const stops = S.fill.stops;
					const gcb = S.gradientColorBindings;
					const groupId = `shape-${L.id}-gradient`;
					const groupTitle = L.fieldBinding.fieldLabel.trim() || 'Shape colors';
					const n = gcb.length;
					for (let i = 0; i < gcb.length; i++) {
						const fn = gcb[i].fieldName;
						if (seen.has(fn)) continue;
						seen.add(fn);
						out.push({
							fieldName: fn,
							fieldLabel: gcb[i].fieldLabel,
							fieldType: 'color',
							defaultValue: stops[i]?.color,
							shapeGradientGroup: {
								groupId,
								stopIndex: i,
								stopCount: n,
								groupTitle
							}
						});
					}
					continue;
				}
			}
			const fn = L.fieldBinding.fieldName;
			if (seen.has(fn)) continue;
			seen.add(fn);
			out.push(L.fieldBinding);
		}
	}
	return out;
}

export type PieceBindingSection =
	| {
			kind: 'shapeGradient';
			groupId: string;
			groupTitle: string;
			bindings: FieldBinding[];
	  }
	| { kind: 'single'; binding: FieldBinding };

/** Collapse shape gradient stop bindings into one piece-editor block (title + row of color pickers). */
export function groupBindingsForPieceEditor(bindings: FieldBinding[]): PieceBindingSection[] {
	const done = new Set<string>();
	const out: PieceBindingSection[] = [];
	for (const b of bindings) {
		const sg = b.shapeGradientGroup;
		if (sg) {
			if (done.has(sg.groupId)) continue;
			done.add(sg.groupId);
			const members = bindings
				.filter((x) => x.shapeGradientGroup?.groupId === sg.groupId)
				.sort((a, c) => a.shapeGradientGroup!.stopIndex - c.shapeGradientGroup!.stopIndex);
			out.push({
				kind: 'shapeGradient',
				groupId: sg.groupId,
				groupTitle: sg.groupTitle,
				bindings: members
			});
		} else {
			out.push({ kind: 'single', binding: b });
		}
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
						const fsz = s.fontSize;
						let fontSize: number | undefined;
						if (typeof fsz === 'number' && Number.isFinite(fsz) && fsz > 0) {
							fontSize = fsz;
						} else if (typeof fsz === 'string' && fsz.trim() !== '') {
							const n = parseFloat(fsz);
							if (Number.isFinite(n) && n > 0) fontSize = n;
						}
						styles[fk] = {
							textColor: typeof s.textColor === 'string' ? s.textColor : undefined,
							backgroundColor: typeof s.backgroundColor === 'string' ? s.backgroundColor : undefined,
							fontSize
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
		if (ps.fontSize != null && Number.isFinite(ps.fontSize) && ps.fontSize > 0) {
			e.fontSize = ps.fontSize;
		}
		if (e.textColor || e.backgroundColor || e.fontSize != null) fs[b.fieldName] = e;
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
		if (!L.fieldBinding) continue;
		if (L.type === 'shape') {
			const S = L as ShapeLayer;
			if (S.fill.type === 'gradient' && S.gradientColorBindings?.length) {
				for (const g of S.gradientColorBindings) {
					if (!layerByField.has(g.fieldName)) layerByField.set(g.fieldName, L);
				}
				continue;
			}
		}
		if (!layerByField.has(L.fieldBinding.fieldName)) {
			layerByField.set(L.fieldBinding.fieldName, L);
		}
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
