/**
 * Programmatic card rasterization (browser only) for bulk re-render and ZIP export.
 */
import { mount, tick, unmount } from 'svelte';
import CardPreview from '$lib/components/editor/CardPreview.svelte';
import type { Json } from '$lib/supabase/database.types';
import { splitFieldValuesPayload } from './fieldBindings';
import { rasterizeElementToPng } from './rasterize';
import { parseBackground, parseLayers } from './types';

export type TemplateRow = {
	canvas_width: number;
	canvas_height: number;
	border_radius: number;
	background: Json;
	layers: Json;
};

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

	const { values: fieldValues, styles: fieldStyles } = splitFieldValuesPayload(fieldValuesRaw);

	const app = mount(CardPreview, {
		target: wrap,
		props: {
			width: template.canvas_width,
			height: template.canvas_height,
			borderRadius: template.border_radius,
			background: parseBackground(template.background),
			layers: parseLayers(template.layers),
			fieldValues,
			fieldStyles,
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
