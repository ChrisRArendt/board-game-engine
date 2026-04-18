import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '$lib/supabase/database.types';
import type { GameDataJson } from '$lib/engine/types';

/** Static cover served from `/data/...` (see `static/data/`). */
export type PlayableGameOption = {
	key: string;
	label: string;
	/** Absolute path on this origin, e.g. `/data/bsg_1/cover.svg`, or public storage URL for custom games. */
	coverUrl: string | null;
};

/** Tile image when a custom game has no `cover_image_path` (matches built-in tile treatment). */
export const DEFAULT_CUSTOM_GAME_COVER_URL = '/data/custom_game_default_cover.svg';

export const BUILTIN_GAME_OPTIONS: PlayableGameOption[] = [
	{
		key: 'bsg_1',
		label: 'Battlestar Galactica',
		coverUrl: '/data/bsg_1/cover.svg'
	}
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

/** Public URL for an optional cover file in the custom-game-assets bucket. */
export function customGameCoverPublicUrl(supabaseUrl: string, coverPath: string): string {
	const base = supabaseUrl.replace(/\/$/, '');
	return `${base}/storage/v1/object/public/custom-game-assets/${coverPath}`;
}

/** Built-in games plus all custom games (publicly playable; editor remains creator-only). */
export async function loadPlayableGameOptions(
	supabase: SupabaseClient<Database>,
	supabaseUrl: string
): Promise<PlayableGameOption[]> {
	const { data: rows, error } = await supabase
		.from('custom_board_games')
		.select('game_key, title, cover_image_path')
		.order('title');
	if (error) {
		console.warn('[bge] custom_board_games list', error);
		return [...BUILTIN_GAME_OPTIONS];
	}
	const custom = (rows ?? []).map((r) => ({
		key: r.game_key,
		label: r.title,
		coverUrl: r.cover_image_path
			? customGameCoverPublicUrl(supabaseUrl, r.cover_image_path)
			: DEFAULT_CUSTOM_GAME_COVER_URL
	}));
	return [...BUILTIN_GAME_OPTIONS, ...custom];
}

/** Cover for hub tiles / in-progress cards when options are loaded or game key is custom. */
export function coverUrlForGameKey(
	gameKey: string,
	options: PlayableGameOption[]
): string | null {
	const hit = options.find((g) => g.key === gameKey);
	if (hit?.coverUrl) return hit.coverUrl;
	if (isCustomGameKey(gameKey)) return DEFAULT_CUSTOM_GAME_COVER_URL;
	return null;
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
