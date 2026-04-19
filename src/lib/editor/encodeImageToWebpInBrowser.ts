import { browser } from '$app/environment';
import { MAX_RESULT_EDGE_PX, UPLOAD_WEBP_QUALITY } from '$lib/editor/gameMediaUploadLimits';

/**
 * Decodes a raster image in the browser, applies optional downscale so the long
 * edge is at most {@link MAX_RESULT_EDGE_PX}, and encodes WebP (lossy).
 * Avoids sending huge originals through serverless (e.g. Vercel ~4.5 MB body cap).
 */
export async function encodeRasterToWebpForStorage(
	file: File
): Promise<{ blob: Blob; width: number; height: number }> {
	if (!browser) throw new Error('Image encoding is only available in the browser');

	const bmp = await createImageBitmap(file);
	try {
		const iw = bmp.width;
		const ih = bmp.height;
		if (!iw || !ih) throw new Error('Could not read image dimensions');

		const long = Math.max(iw, ih);
		const scale = long > MAX_RESULT_EDGE_PX ? MAX_RESULT_EDGE_PX / long : 1;
		const w = Math.max(1, Math.round(iw * scale));
		const h = Math.max(1, Math.round(ih * scale));

		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not create canvas context');
		ctx.drawImage(bmp, 0, 0, w, h);

		const quality = Math.min(1, Math.max(0.01, UPLOAD_WEBP_QUALITY / 100));
		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error('WebP export failed'))),
				'image/webp',
				quality
			);
		});
		return { blob, width: w, height: h };
	} finally {
		bmp.close();
	}
}
