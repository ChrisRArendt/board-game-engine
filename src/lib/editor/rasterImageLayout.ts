/**
 * html2canvas draws &lt;img&gt; by stretching to the box (ignores CSS object-fit).
 * For export we paint into a same-size canvas using object-fit / object-position math.
 */

/** Parse common `object-position` values into 0–100 alignment for each axis (CSS-style). */
export function parseObjectPositionPercent(input: string): { px: number; py: number } {
	const t = input.trim().toLowerCase();
	if (!t) return { px: 50, py: 50 };
	const parts = t.split(/\s+/).filter(Boolean);
	const key: Record<string, number> = {
		left: 0,
		center: 50,
		right: 100,
		top: 0,
		bottom: 100
	};
	function one(tok: string): number {
		if (tok.endsWith('%')) {
			const n = parseFloat(tok);
			return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
		}
		return key[tok] ?? 50;
	}
	if (parts.length === 1) {
		const k = parts[0];
		if (k === 'center') return { px: 50, py: 50 };
		if (k === 'left' || k === 'right' || k.endsWith('%')) return { px: one(k), py: 50 };
		if (k === 'top' || k === 'bottom') return { px: 50, py: one(k) };
	}
	return { px: one(parts[0] ?? 'center'), py: one(parts[1] ?? 'center') };
}

export function drawImageWithObjectFit(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	cw: number,
	ch: number,
	fit: 'cover' | 'contain' | 'fill',
	objectPosition: string
): void {
	const iw = img.naturalWidth;
	const ih = img.naturalHeight;
	if (!iw || !ih || !cw || !ch) return;
	const { px, py } = parseObjectPositionPercent(objectPosition);

	if (fit === 'fill') {
		ctx.drawImage(img, 0, 0, iw, ih, 0, 0, cw, ch);
		return;
	}

	if (fit === 'contain') {
		const scale = Math.min(cw / iw, ch / ih);
		const dw = iw * scale;
		const dh = ih * scale;
		const dx = (cw - dw) * (px / 100);
		const dy = (ch - dh) * (py / 100);
		ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
		return;
	}

	// cover
	const scale = Math.max(cw / iw, ch / ih);
	const sw = cw / scale;
	const sh = ch / scale;
	let sx = (iw - sw) * (px / 100);
	let sy = (ih - sh) * (py / 100);
	sx = Math.max(0, Math.min(iw - sw, sx));
	sy = Math.max(0, Math.min(ih - sh, sy));
	ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
}

/** Replace a layout-sized &lt;img&gt; with a &lt;canvas&gt; painted with object-fit (for html2canvas). */
export function replaceRasterObjectFitImg(img: HTMLImageElement): void {
	try {
		const fit = img.dataset.rasterObjectFit as 'cover' | 'contain' | 'fill' | undefined;
		if (!fit || (fit !== 'cover' && fit !== 'contain' && fit !== 'fill')) return;
		const iw = img.naturalWidth;
		const ih = img.naturalHeight;
		if (!iw || !ih) return;

		const br = img.getBoundingClientRect();
		const cw = Math.max(1, Math.round(br.width || img.offsetWidth || 1));
		const ch = Math.max(1, Math.round(br.height || img.offsetHeight || 1));
		const pos = img.dataset.rasterObjectPosition ?? '50% 50%';

		// Must create the canvas in the same document as `img` (html2canvas clone lives in an iframe).
		const doc = img.ownerDocument;
		const canvas = doc.createElement('canvas');
		canvas.width = cw;
		canvas.height = ch;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		drawImageWithObjectFit(ctx, img, cw, ch, fit, pos);

		canvas.className = img.className;
		canvas.style.cssText = img.style.cssText;
		canvas.setAttribute('aria-hidden', 'true');
		img.replaceWith(canvas);
	} catch {
		/* html2canvas rejects if onclone throws; fall back to stretched <img> */
	}
}
