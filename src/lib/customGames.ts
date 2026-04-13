import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '$lib/supabase/database.types';
import type { GameDataJson } from '$lib/engine/types';

export const BUILTIN_GAME_OPTIONS: { key: string; label: string }[] = [
	{ key: 'bsg_1', label: 'Battlestar Galactica' }
];

export function isCustomGameKey(gameKey: string): boolean {
	return gameKey.startsWith('custom_');
}

/** Public folder URL for piece images and table-bg.jpg (trailing slash). */
export function customGameAssetBaseUrl(
	supabaseUrl: string,
	creatorId: string,
	gameId: string
): string {
	const base = supabaseUrl.replace(/\/$/, '');
	return `${base}/storage/v1/object/public/custom-game-assets/${creatorId}/${gameId}/`;
}

export function customRulesPublicUrl(supabaseUrl: string, rulesPath: string): string {
	const base = supabaseUrl.replace(/\/$/, '');
	return `${base}/storage/v1/object/public/custom-game-assets/${rulesPath}`;
}

/** Built-in games plus custom games visible to this user (own + friends’). */
export async function loadPlayableGameOptions(
	supabase: SupabaseClient<Database>
): Promise<{ key: string; label: string }[]> {
	const { data: rows, error } = await supabase
		.from('custom_board_games')
		.select('game_key, title')
		.order('title');
	if (error) {
		console.warn('[bge] custom_board_games list', error);
		return [...BUILTIN_GAME_OPTIONS];
	}
	const custom = (rows ?? []).map((r) => ({
		key: r.game_key,
		label: r.title
	}));
	return [...BUILTIN_GAME_OPTIONS, ...custom];
}

export async function listMyCustomGames(
	supabase: SupabaseClient<Database>,
	creatorId: string
): Promise<Database['public']['Tables']['custom_board_games']['Row'][]> {
	const { data, error } = await supabase
		.from('custom_board_games')
		.select('*')
		.eq('creator_id', creatorId)
		.order('updated_at', { ascending: false });
	if (error) throw error;
	return data ?? [];
}

export async function insertCustomBoardGame(
	supabase: SupabaseClient<Database>,
	opts: { creatorId: string; title: string; description: string; gameData: GameDataJson }
): Promise<Database['public']['Tables']['custom_board_games']['Row']> {
	const { data, error } = await supabase
		.from('custom_board_games')
		.insert({
			creator_id: opts.creatorId,
			title: opts.title,
			description: opts.description,
			game_data: opts.gameData as unknown as Json
		})
		.select()
		.single();
	if (error) throw error;
	return data;
}
