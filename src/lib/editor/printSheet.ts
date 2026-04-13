import { DPI_PRINT } from './units';

export type PageSizeId = 'letter' | 'a4';

const PAGE_INCH: Record<PageSizeId, { w: number; h: number }> = {
	letter: { w: 8.5, h: 11 },
	a4: { w: 8.27, h: 11.69 }
};

const MARGIN_IN = 0.5;
const GAP_PX = 12;
/** ~1.5mm tick length at 300 DPI */
const CUT_MARK_PX = 18;

function inchToPx(inches: number): number {
	return Math.round(inches * DPI_PRINT);
}

export interface CardForSheet {
	blob: Blob;
	widthPx: number;
	heightPx: number;
}

function scaleToFit(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
	const s = Math.min(maxW / w, maxH / h, 1);
	return { w: Math.round(w * s), h: Math.round(h * s) };
}

/**
 * Pack cards left-to-right, top-to-bottom on pages at 300 DPI with margins and corner cut marks.
 */
export async function layoutCardsToSheetPages(
	cards: CardForSheet[],
	pageSize: PageSizeId = 'letter'
): Promise<Blob[]> {
	if (!cards.length) return [];
	const pageIn = PAGE_INCH[pageSize];
	const pageW = inchToPx(pageIn.w);
	const pageH = inchToPx(pageIn.h);
	const margin = inchToPx(MARGIN_IN);
	const innerW = pageW - 2 * margin;
	const innerH = pageH - 2 * margin;

	const pages: Blob[] = [];
	let i = 0;

	while (i < cards.length) {
		const canvas = document.createElement('canvas');
		canvas.width = pageW;
		canvas.height = pageH;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('2d context unavailable');
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, pageW, pageH);

		let x = margin;
		let y = margin;
		let rowH = 0;
		let placed = false;

		while (i < cards.length) {
			const c = cards[i];
			const img = await blobToImage(c.blob);
			let cw = c.widthPx;
			let ch = c.heightPx;

			// Ensure card fits in printable area (scale down if needed)
			const fitted = scaleToFit(cw, ch, innerW, innerH);
			cw = fitted.w;
			ch = fitted.h;

			if (x + cw > margin + innerW && x > margin) {
				x = margin;
				y += rowH + GAP_PX;
				rowH = 0;
			}

			if (y + ch > margin + innerH) {
				if (!placed) {
					// Single oversized card: draw scaled to full inner box
					const full = scaleToFit(c.widthPx, c.heightPx, innerW, innerH);
					const img2 = await blobToImage(c.blob);
					ctx.drawImage(img2, margin, margin, full.w, full.h);
					drawCutMarks(ctx, margin, margin, full.w, full.h);
					i++;
					placed = true;
				}
				break;
			}

			ctx.drawImage(img, x, y, cw, ch);
			drawCutMarks(ctx, x, y, cw, ch);
			rowH = Math.max(rowH, ch);
			x += cw + GAP_PX;
			i++;
			placed = true;
		}

		pages.push(await canvasToPngBlob(canvas));
	}

	return pages;
}

function drawCutMarks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	const n = CUT_MARK_PX;
	ctx.strokeStyle = '#333333';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x - n, y);
	ctx.lineTo(x, y);
	ctx.moveTo(x, y - n);
	ctx.lineTo(x, y);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x + w, y - n);
	ctx.lineTo(x + w, y);
	ctx.moveTo(x + w + n, y);
	ctx.lineTo(x + w, y);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x - n, y + h);
	ctx.lineTo(x, y + h);
	ctx.moveTo(x, y + h + n);
	ctx.lineTo(x, y + h);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x + w, y + h + n);
	ctx.lineTo(x + w, y + h);
	ctx.moveTo(x + w + n, y + h);
	ctx.lineTo(x + w, y + h);
	ctx.stroke();
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

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
	});
}

/** Measure intrinsic size of a raster blob. */
export async function rasterBlobDimensions(blob: Blob): Promise<{ w: number; h: number }> {
	const img = await blobToImage(blob);
	return { w: img.naturalWidth, h: img.naturalHeight };
}
