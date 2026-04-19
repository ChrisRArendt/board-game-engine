import { replaceRasterObjectFitImg } from '$lib/editor/rasterImageLayout';

export interface RasterizeOptions {
	/**
	 * Canvas background behind the DOM snapshot. Default `#ffffff`.
	 * Pass `null` for a transparent PNG (e.g. export with alpha around the card).
	 */
	backgroundColor?: string | null;
	/** Pixel ratio for sharper output (default 2 for ~150 DPI feel on retina) */
	scale?: number;
	/**
	 * Composite the snapshot onto a transparent canvas clipped to a rounded rect (logical px).
	 * Clears html2canvas corner bleed (opaque white/black outside CSS border-radius).
	 */
	clipToRoundedRect?: { width: number; height: number; radius: number };
}

function roundRectPath(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	const rr = Math.min(r, w / 2, h / 2);
	ctx.moveTo(x + rr, y);
	ctx.arcTo(x + w, y, x + w, y + h, rr);
	ctx.arcTo(x + w, y + h, x, y + h, rr);
	ctx.arcTo(x, y + h, x, y, rr);
	ctx.arcTo(x, y, x + w, y, rr);
	ctx.closePath();
}

/** Re-draw `source` through a rounded-rect clip so pixels outside the card shape are transparent. */
function clipCanvasToRoundedRect(
	source: HTMLCanvasElement,
	logicalW: number,
	logicalH: number,
	radiusPx: number
): HTMLCanvasElement {
	const out = document.createElement('canvas');
	out.width = source.width;
	out.height = source.height;
	const ctx = out.getContext('2d');
	if (!ctx) return source;
	const dw = source.width;
	const dh = source.height;
	const scaleX = dw / logicalW;
	const scaleY = dh / logicalH;
	const dr = Math.min(radiusPx * scaleX, radiusPx * scaleY, dw / 2, dh / 2);
	ctx.clearRect(0, 0, dw, dh);
	ctx.beginPath();
	roundRectPath(ctx, 0, 0, dw, dh, dr);
	ctx.clip();
	ctx.drawImage(source, 0, 0);
	return out;
}

/**
 * Images loaded without CORS taint any canvas we draw them into; `toBlob` then throws.
 * Reload each remote &lt;img&gt; with crossOrigin so decode is export-safe.
 */
function prepareImagesForRasterExport(root: HTMLElement): void {
	for (const el of root.querySelectorAll('img')) {
		const img = el as HTMLImageElement;
		const src = img.currentSrc || img.src;
		if (!src || src.startsWith('data:') || src.startsWith('blob:')) continue;
		if (img.crossOrigin === 'anonymous') continue;
		img.crossOrigin = 'anonymous';
		const again = src;
		img.removeAttribute('src');
		img.src = again;
	}
}

async function ensureImagesLoaded(root: HTMLElement): Promise<void> {
	const imgs = [...root.querySelectorAll('img')];
	await Promise.all(
		imgs.map((img) => {
			if (img.complete && img.naturalWidth > 0) return Promise.resolve();
			return new Promise<void>((resolve) => {
				const done = () => resolve();
				img.addEventListener('load', done, { once: true });
				img.addEventListener('error', done, { once: true });
			});
		})
	);
}

/**
 * Rasterize a DOM element to PNG blob (client-side).
 * Caller should pass a container that matches the card size in px.
 */
export async function rasterizeElementToPng(
	el: HTMLElement,
	opts?: RasterizeOptions
): Promise<Blob> {
	const { default: html2canvas } = await import('html2canvas');
	const bg =
		opts?.backgroundColor === undefined ? '#ffffff' : opts.backgroundColor;
	const scale = opts?.scale ?? 2;

	prepareImagesForRasterExport(el);
	await ensureImagesLoaded(el);

	let canvas = await html2canvas(el, {
		scale,
		useCORS: true,
		// Must be false or the snapshot canvas stays tainted and toBlob() throws.
		allowTaint: false,
		backgroundColor: bg,
		logging: false,
		foreignObjectRendering: false,
		onclone: (_doc, clone) => {
			for (const node of clone.querySelectorAll('img[data-raster-object-fit]')) {
				try {
					replaceRasterObjectFitImg(node as HTMLImageElement);
				} catch {
					/* replaceRasterObjectFitImg is defensive; keep img if anything slips through */
				}
			}
		}
	});
	const clip = opts?.clipToRoundedRect;
	if (clip && clip.width > 0 && clip.height > 0) {
		canvas = clipCanvasToRoundedRect(canvas, clip.width, clip.height, Math.max(0, clip.radius));
	}
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error('toBlob failed'));
			},
			'image/png',
			1
		);
	});
}
