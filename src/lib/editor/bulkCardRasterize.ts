/**
 * Programmatic card rasterization (browser only) for bulk re-render and ZIP export.
 */
import { mount, tick, unmount } from 'svelte';
import CardPreview from '$lib/components/editor/CardPreview.svelte';
import type { Json } from '$lib/supabase/database.types';
import { rasterizeElementToPng } from './rasterize';
import { parseBackground, parseLayers } from './types';

export type TemplateRow = {
	canvas_width: number;
	canvas_height: number;
	border_radius: number;
	background: Json;
	layers: Json;
};

function fieldValuesToStrings(raw: unknown): Record<string, string> {
	const out: Record<string, string> = {};
	if (typeof raw !== 'object' || raw === null) return out;
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		out[k] = typeof v === 'string' ? v : String(v ?? '');
	}
	return out;
}

export async function rasterizeCardInstanceToBlob(
	template: TemplateRow,
	fieldValuesRaw: unknown,
	mediaUrls: Record<string, string>,
	opts?: { scale?: number }
): Promise<Blob> {
	const wrap = document.createElement('div');
	wrap.style.position = 'fixed';
	wrap.style.left = '-9999px';
	wrap.style.top = '0';
	wrap.style.zIndex = '-1';
	document.body.appendChild(wrap);

	const fieldValues = fieldValuesToStrings(fieldValuesRaw);

	const app = mount(CardPreview, {
		target: wrap,
		props: {
			width: template.canvas_width,
			height: template.canvas_height,
			borderRadius: template.border_radius,
			background: parseBackground(template.background),
			layers: parseLayers(template.layers),
			fieldValues,
			mediaUrls,
			displayScale: 1
		}
	});

	await tick();
	await new Promise<void>((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve());
		});
	});

	try {
		return await rasterizeElementToPng(wrap, {
			scale: opts?.scale ?? 2,
			backgroundColor: '#ffffff'
		});
	} finally {
		unmount(app);
		if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
	}
}
