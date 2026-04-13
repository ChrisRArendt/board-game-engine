export interface RasterizeOptions {
	/**
	 * Canvas background behind the DOM snapshot. Default `#ffffff`.
	 * Pass `null` for a transparent PNG (e.g. export with alpha around the card).
	 */
	backgroundColor?: string | null;
	/** Pixel ratio for sharper output (default 2 for ~150 DPI feel on retina) */
	scale?: number;
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
	const canvas = await html2canvas(el, {
		scale: opts?.scale ?? 2,
		useCORS: true,
		allowTaint: true,
		backgroundColor: bg,
		logging: false
	});
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
