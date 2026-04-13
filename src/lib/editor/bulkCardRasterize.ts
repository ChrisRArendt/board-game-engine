/**
 * Programmatic card rasterization (browser only) for bulk re-render and ZIP export.
 */
import { mount, tick, unmount } from 'svelte';
import CardPreview from '$lib/components/editor/CardPreview.svelte';
import type { Json } from '$lib/supabase/database.types';
import { splitFieldValuesPayload } from './fieldBindings';
import { rasterizeElementToPng } from './rasterize';
import { ensureGoogleFontsForLayers } from './googleFontsLoader';
import { parseBackground, parseLayers } from './types';

export type TemplateRow = {
	canvas_width: number;
	canvas_height: number;
	border_radius: number;
	background: Json;
	layers: Json;
	/** Inset frame; omitted treated as 0 / #000000 */
	frame_border_width?: number;
	frame_border_color?: string;
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

	const parsedLayers = parseLayers(template.layers);
	ensureGoogleFontsForLayers(parsedLayers);

	const app = mount(CardPreview, {
		target: wrap,
		props: {
			width: template.canvas_width,
			height: template.canvas_height,
			borderRadius: template.border_radius,
			frameBorderWidth: template.frame_border_width ?? 0,
			frameBorderColor: template.frame_border_color ?? '#000000',
			background: parseBackground(template.background),
			layers: parsedLayers,
			fieldValues,
			fieldStyles,
			mediaUrls,
			displayScale: 1,
			flattenLayout: true
		}
	});

	await tick();
	if (typeof document !== 'undefined' && document.fonts?.ready) {
		await document.fonts.ready;
	}
	await new Promise<void>((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve());
		});
	});

	try {
		return await rasterizeElementToPng(wrap, {
			scale: opts?.scale ?? 2,
			backgroundColor: null
		});
	} finally {
		unmount(app);
		if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
	}
}
