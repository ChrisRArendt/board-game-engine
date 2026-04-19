import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';
import { MAX_UPLOAD_BYTES } from '$lib/editor/gameMediaUploadLimits';
import { encodeRasterToWebpForStorage } from '$lib/editor/encodeImageToWebpInBrowser';

/**
 * Uploads an image to `custom-game-assets` and inserts a `game_media` row.
 * Raster images are re-encoded to WebP in the browser at up to 8192px on the long edge
 * (see `gameMediaUploadLimits.ts`).
 */
export async function uploadImageToGameLibrary(
	client: SupabaseClient<Database>,
	gameId: string,
	file: File
): Promise<{ mediaId: string; filePath: string }> {
	const { data: u } = await client.auth.getUser();
	const uid = u.user?.id;
	if (!uid) throw new Error('Not signed in');

	if (!file.type.startsWith('image/')) throw new Error('Expected an image file');
	if (file.type === 'image/svg+xml') {
		throw new Error('SVG is not supported; use a raster image (PNG, JPEG, WebP, …).');
	}
	if (file.size > MAX_UPLOAD_BYTES) {
		throw new Error(
			`Image is too large to process (${Math.round(file.size / (1024 * 1024))} MB). Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`
		);
	}

	const { blob, width, height } = await encodeRasterToWebpForStorage(file);

	const fname = `upload_${crypto.randomUUID()}.webp`;
	const path = `${uid}/${gameId}/media/${fname}`;

	const baseName =
		file.name && file.name.includes('.')
			? file.name.slice(0, file.name.lastIndexOf('.'))
			: file.name || 'image';
	const safeBase = baseName.replace(/[^\w\-.]+/g, '_').slice(0, 120) || 'image';
	const displayFilename = `${safeBase}.webp`;

	const { error: upErr } = await client.storage.from('custom-game-assets').upload(path, blob, {
		contentType: 'image/webp',
		upsert: false
	});
	if (upErr) throw upErr;

	const { data: row, error: insErr } = await client
		.from('game_media')
		.insert({
			game_id: gameId,
			creator_id: uid,
			file_path: path,
			filename: displayFilename,
			source_type: 'upload',
			ai_prompt: null,
			width,
			height
		})
		.select('id')
		.single();

	if (insErr || !row) throw insErr ?? new Error('Failed to save media');

	return { mediaId: row.id, filePath: path };
}
