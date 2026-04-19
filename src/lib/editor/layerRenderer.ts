import type {
	CardBackground,
	CardLayer,
	ImageLayer,
	ShapeLayer,
	TextLayer
} from './types';

export function gradientCss(
	stops: { offset: number; color: string }[],
	angleDeg: number
): string {
	const s = [...stops].sort((a, b) => a.offset - b.offset);
	const parts = s.map((x) => `${x.color} ${Math.round(x.offset * 100)}%`).join(', ');
	return `linear-gradient(${angleDeg}deg, ${parts})`;
}

export function radialGradientCss(
	stops: { offset: number; color: string }[],
	radiusPct: number
): string {
	const s = [...stops].sort((a, b) => a.offset - b.offset);
	const parts = s.map((x) => `${x.color} ${Math.round(x.offset * 100)}%`).join(', ');
	const r = Math.min(200, Math.max(5, Math.round(radiusPct)));
	return `radial-gradient(ellipse ${r}% ${r}% at 50% 50%, ${parts})`;
}

/** CSS `background` for the card face (solid, gradient, or image via `game_media` URLs). */
export function cardFaceBackgroundCss(bg: CardBackground, mediaUrls: Record<string, string>): string {
	if (bg.type === 'solid') {
		return bg.color;
	}
	if (bg.type === 'gradient') {
		return gradientCss(bg.stops, bg.angle);
	}
	const fb = bg.fallbackColor ?? '#1a1a1a';
	const id = bg.mediaId;
	const url = id ? mediaUrls[id] : '';
	if (!url) {
		return fb;
	}
	const fit = bg.objectFit ?? 'cover';
	const size = fit === 'contain' ? 'contain' : fit === 'fill' ? '100% 100%' : 'cover';
	const pos = (bg.objectPosition && bg.objectPosition.trim()) || 'center';
	const safe = JSON.stringify(url);
	return `${fb} url(${safe}) ${pos} / ${size} no-repeat`;
}

export function shapeFillStyle(fill: ShapeLayer['fill']): string {
	if (fill.type === 'solid') return fill.color;
	if (fill.gradientKind === 'radial') {
		return radialGradientCss(fill.stops, fill.radialRadiusPct ?? 100);
	}
	return gradientCss(fill.stops, fill.angle);
}

export function resolveTextContent(layer: TextLayer, fieldValues: Record<string, string>): string {
	if (layer.fieldBinding) {
		const v = fieldValues[layer.fieldBinding.fieldName];
		return v ?? layer.fieldBinding.defaultValue ?? '';
	}
	return layer.content;
}

export function resolveImageMediaId(
	layer: ImageLayer,
	fieldValues: Record<string, string>
): string | null {
	/** Any bound image layer reads its media id from field_values (per-piece). Do not require fieldType === 'image' — new bindings default to "text" in the template UI, which would otherwise skip field_values and fall back to layer.mediaId (usually null). */
	if (layer.fieldBinding) {
		const v = fieldValues[layer.fieldBinding.fieldName];
		if (v != null && String(v).trim() !== '') return String(v).trim();
		const d = layer.fieldBinding.defaultValue;
		if (d != null && String(d).trim() !== '') return String(d).trim();
	}
	return layer.mediaId;
}

/** Sorted layers by zIndex for painting order */
export function sortLayers(layers: CardLayer[]): CardLayer[] {
	return [...layers].sort((a, b) => a.zIndex - b.zIndex);
}
