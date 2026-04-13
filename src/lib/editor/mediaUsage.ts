import type { Json } from '$lib/supabase/database.types';
import { collectFieldBindings } from './fieldBindings';
import { parseBackground, parseLayers } from './types';

/** Media IDs referenced by template image layers and by card field_values for image bindings. */
export function collectUsedMediaIds(
	templates: { id: string; layers: Json; background?: Json }[],
	cards: { template_id: string; field_values: Json }[]
): Set<string> {
	const used = new Set<string>();
	const tmplById = new Map(templates.map((t) => [t.id, t]));

	for (const t of templates) {
		const bg = parseBackground(t.background ?? {});
		if (bg.type === 'image' && bg.mediaId) used.add(bg.mediaId);
		const layers = parseLayers(t.layers);
		for (const L of layers) {
			if (L.type === 'image' && L.mediaId) used.add(L.mediaId);
		}
		const rawBackBg = (t as { back_background?: Json }).back_background;
		if (rawBackBg != null) {
			const bbg = parseBackground(rawBackBg);
			if (bbg.type === 'image' && bbg.mediaId) used.add(bbg.mediaId);
		}
		const rawBackLayers = (t as { back_layers?: Json }).back_layers;
		if (rawBackLayers != null) {
			for (const L of parseLayers(rawBackLayers)) {
				if (L.type === 'image' && L.mediaId) used.add(L.mediaId);
			}
		}
	}

	for (const c of cards) {
		const t = tmplById.get(c.template_id);
		if (!t) continue;
		const bindings = collectFieldBindings(
			parseLayers(t.layers),
			parseLayers((t as { back_layers?: Json }).back_layers ?? [])
		);
		const fv = c.field_values as Record<string, unknown>;
		for (const b of bindings) {
			if (b.fieldType !== 'image') continue;
			const v = fv[b.fieldName];
			if (typeof v === 'string' && v.trim().length > 0) used.add(v.trim());
		}
	}

	return used;
}
