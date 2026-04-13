export interface RasterizeOptions {
	/** Background color for transparent areas (default: white) */
	backgroundColor?: string;
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
	const canvas = await html2canvas(el, {
		scale: opts?.scale ?? 2,
		useCORS: true,
		allowTaint: true,
		backgroundColor: opts?.backgroundColor ?? '#ffffff',
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
