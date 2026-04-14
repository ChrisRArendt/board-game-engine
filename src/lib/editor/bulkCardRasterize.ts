/**
 * Programmatic card rasterization (browser only) for bulk re-render and ZIP export.
 */
import { mount, tick, unmount } from 'svelte';
import CardPreview from '$lib/components/editor/CardPreview.svelte';
import type { Json } from '$lib/supabase/database.types';
import { splitFieldValuesPayload } from './fieldBindings';
import { rasterizeElementToPng } from './rasterize';
import { ensureGoogleFontsForLayers } from './googleFontsLoader';
import {
	parseBackground,
	parseLayers,
	defaultBackBackground,
	parseOptionalBackgroundOrNull,
	parseOptionalLayersOrNull,
	templateHasBack
} from './types';
import type { CardBackground, CardLayer } from './types';

export type TemplateRow = {
	canvas_width: number;
	canvas_height: number;
	border_radius: number;
	background: Json;
	layers: Json;
	/** Inset frame; omitted treated as 0 / #000000 */
	frame_border_width?: number;
	frame_border_color?: string;
	/** null = auto inner clip radius */
	frame_inner_radius?: number | null;
	back_background?: Json | null;
	back_layers?: Json | null;
};

export function templateRowHasBack(t: TemplateRow): boolean {
	return templateHasBack(t.back_background, t.back_layers);
}

function faceBackgroundAndLayers(
	template: TemplateRow,
	face: 'front' | 'back'
): { background: CardBackground; layers: CardLayer[] } {
	if (face === 'front') {
		return {
			background: parseBackground(template.background),
			layers: parseLayers(template.layers)
		};
	}
	const bb = parseOptionalBackgroundOrNull(template.back_background);
	const bl = parseOptionalLayersOrNull(template.back_layers);
	return {
		background: bb ?? defaultBackBackground(),
		layers: bl ?? []
	};
}

async function rasterizeCardFaceToBlob(
	template: TemplateRow,
	fieldValuesRaw: unknown,
	mediaUrls: Record<string, string>,
	face: 'front' | 'back',
	opts?: { scale?: number }
): Promise<Blob> {
	const wrap = document.createElement('div');
	wrap.style.position = 'fixed';
	wrap.style.left = '-9999px';
	wrap.style.top = '0';
	wrap.style.zIndex = '-1';
	document.body.appendChild(wrap);

	const { values: fieldValues, styles: fieldStyles } = splitFieldValuesPayload(fieldValuesRaw);
	const { background, layers } = faceBackgroundAndLayers(template, face);
	ensureGoogleFontsForLayers(layers);

	const app = mount(CardPreview, {
		target: wrap,
		props: {
			width: template.canvas_width,
			height: template.canvas_height,
			borderRadius: template.border_radius,
			frameBorderWidth: template.frame_border_width ?? 0,
			frameBorderColor: template.frame_border_color ?? '#000000',
			frameInnerRadius: template.frame_inner_radius ?? null,
			background,
			layers,
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

export async function rasterizeCardInstanceToBlob(
	template: TemplateRow,
	fieldValuesRaw: unknown,
	mediaUrls: Record<string, string>,
	opts?: { scale?: number; face?: 'front' | 'back' }
): Promise<Blob> {
	return rasterizeCardFaceToBlob(
		template,
		fieldValuesRaw,
		mediaUrls,
		opts?.face ?? 'front',
		opts
	);
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Image load failed'));
		};
		img.src = url;
	});
}

/**
 * @deprecated Sprite approach replaced by separate front/back PNGs; see `rasterizeCardFrontAndBack`.
 * Horizontal sprite: left half = back, right half = front.
 */
export async function composeFrontBackSprite(frontBlob: Blob, backBlob: Blob): Promise<Blob> {
	const [imgF, imgB] = await Promise.all([blobToImage(frontBlob), blobToImage(backBlob)]);
	const w = imgF.naturalWidth;
	const h = imgF.naturalHeight;
	const canvas = document.createElement('canvas');
	canvas.width = w * 2;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2d context unavailable');
	ctx.drawImage(imgB, 0, 0, w, h);
	ctx.drawImage(imgF, w, 0, w, h);
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
			'image/png',
			1
		);
	});
}

/**
 * Render front (and optionally back) as **separate** blobs.
 * Callers should upload front as `cards/{id}.png` and back as `cards/{id}-back.png`.
 */
export async function rasterizeCardFrontAndBack(
	template: TemplateRow,
	fieldValuesRaw: unknown,
	mediaUrls: Record<string, string>,
	opts?: { scale?: number }
): Promise<{ front: Blob; back: Blob | null }> {
	const front = await rasterizeCardFaceToBlob(template, fieldValuesRaw, mediaUrls, 'front', opts);
	if (!templateRowHasBack(template)) {
		return { front, back: null };
	}
	const back = await rasterizeCardFaceToBlob(template, fieldValuesRaw, mediaUrls, 'back', opts);
	return { front, back };
}

/** @deprecated Use `rasterizeCardFrontAndBack` + two separate uploads instead. */
export async function rasterizeCardFrontAndBackSprite(
	template: TemplateRow,
	fieldValuesRaw: unknown,
	mediaUrls: Record<string, string>,
	opts?: { scale?: number }
): Promise<{ blob: Blob; isSprite: boolean }> {
	const front = await rasterizeCardFaceToBlob(template, fieldValuesRaw, mediaUrls, 'front', opts);
	if (!templateRowHasBack(template)) {
		return { blob: front, isSprite: false };
	}
	const back = await rasterizeCardFaceToBlob(template, fieldValuesRaw, mediaUrls, 'back', opts);
	const sprite = await composeFrontBackSprite(front, back);
	return { blob: sprite, isSprite: true };
}
