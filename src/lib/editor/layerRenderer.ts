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

export function backgroundStyle(bg: CardBackground): string {
	if (bg.type === 'solid') {
		return bg.color;
	}
	return gradientCss(bg.stops, bg.angle);
}

export function shapeFillStyle(fill: ShapeLayer['fill']): string {
	if (fill.type === 'solid') return fill.color;
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
	if (layer.fieldBinding && layer.fieldBinding.fieldType === 'image') {
		const v = fieldValues[layer.fieldBinding.fieldName];
		return v ?? layer.fieldBinding.defaultValue ?? null;
	}
	return layer.mediaId;
}

/** Sorted layers by zIndex for painting order */
export function sortLayers(layers: CardLayer[]): CardLayer[] {
	return [...layers].sort((a, b) => a.zIndex - b.zIndex);
}
