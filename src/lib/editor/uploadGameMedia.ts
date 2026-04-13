import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';

/**
 * Uploads a file to `custom-game-assets` and inserts a `game_media` row (same as Media Library uploads).
 */
export async function uploadImageToGameLibrary(
	client: SupabaseClient<Database>,
	gameId: string,
	file: File
): Promise<{ mediaId: string; filePath: string }> {
	const { data: u } = await client.auth.getUser();
	const uid = u.user?.id;
	if (!uid) throw new Error('Not signed in');

	const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
	const fname = `upload_${crypto.randomUUID()}${ext}`;
	const path = `${uid}/${gameId}/media/${fname}`;

	const { error: upErr } = await client.storage.from('custom-game-assets').upload(path, file, {
		contentType: file.type || undefined
	});
	if (upErr) throw upErr;

	const { data: row, error: insErr } = await client
		.from('game_media')
		.insert({
			game_id: gameId,
			creator_id: uid,
			file_path: path,
			filename: file.name,
			source_type: 'upload',
			ai_prompt: null
		})
		.select('id')
		.single();

	if (insErr || !row) throw insErr ?? new Error('Failed to save media');

	return { mediaId: row.id, filePath: path };
}
