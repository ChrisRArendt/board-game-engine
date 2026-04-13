/** Design resolution: 150 pixels per inch (screen + default raster). */

export const DPI_DESIGN = 150;
export const DPI_PRINT = 300;

export type DisplayUnit = 'px' | 'in' | 'cm';

export const CM_PER_INCH = 2.54;

export function pxPerCm(): number {
	return DPI_DESIGN / CM_PER_INCH;
}

export function pxToIn(px: number): number {
	return px / DPI_DESIGN;
}

export function inToPx(inches: number): number {
	return Math.round(inches * DPI_DESIGN);
}

export function pxToCm(px: number): number {
	return px / pxPerCm();
}

export function cmToPx(cm: number): number {
	return Math.round(cm * pxPerCm());
}

export function formatInDimension(px: number): number {
	return Math.round((pxToIn(px) + Number.EPSILON) * 1000) / 1000;
}

export function formatCmDimension(px: number): number {
	return Math.round((pxToCm(px) + Number.EPSILON) * 100) / 100;
}

/** Convert a value from `unit` to px. */
export function toPx(value: number, unit: DisplayUnit): number {
	switch (unit) {
		case 'px':
			return Math.round(value);
		case 'in':
			return inToPx(value);
		case 'cm':
			return cmToPx(value);
	}
}

/** Convert px to display value in `unit`. */
export function fromPx(pxVal: number, unit: DisplayUnit): number {
	switch (unit) {
		case 'px':
			return pxVal;
		case 'in':
			return pxToIn(pxVal);
		case 'cm':
			return pxToCm(pxVal);
	}
}

export interface CardSizePreset {
	id: string;
	label: string;
	widthPx: number;
	heightPx: number;
}

export const CARD_PRESETS: CardSizePreset[] = [
	{ id: 'poker', label: 'Poker (2.5" × 3.5")', widthPx: inToPx(2.5), heightPx: inToPx(3.5) },
	{ id: 'tarot', label: 'Tarot (2.75" × 4.75")', widthPx: inToPx(2.75), heightPx: inToPx(4.75) },
	{ id: 'mini', label: 'Mini (1.75" × 2.5")', widthPx: inToPx(1.75), heightPx: inToPx(2.5) }
];

/** Print export: scale design px to print px at 300 DPI from 150 DPI design = 2x */
export function designPxToPrintPx(designPx: number): number {
	return Math.round((designPx * DPI_PRINT) / DPI_DESIGN);
}
