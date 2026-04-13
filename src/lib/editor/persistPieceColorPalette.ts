import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '$lib/supabase/database.types';
import { parseGameDataJson } from '$lib/editor/gameDataJson';

/** Writes `piece_color_palette` into this game's `custom_board_games.game_data` (fetch-merge-update). */
export async function persistPieceColorPalette(
	supabase: SupabaseClient,
	gameId: string,
	palette: string[]
): Promise<{ error: Error | null }> {
	const { data, error: fetchErr } = await supabase
		.from('custom_board_games')
		.select('game_data')
		.eq('id', gameId)
		.single();
	if (fetchErr) return { error: fetchErr };
	const gd = parseGameDataJson(data?.game_data);
	const next = { ...gd, piece_color_palette: [...palette] };
	const { error } = await supabase
		.from('custom_board_games')
		.update({ game_data: next as unknown as Json, updated_at: new Date().toISOString() })
		.eq('id', gameId);
	return { error: error ?? null };
}

/** Debounce rapid palette updates (e.g. dragging in the native color input before close). */
export function debouncePalettePersist(
	persist: (palette: string[]) => Promise<void>,
	delayMs: number
): (palette: string[]) => void {
	let t: ReturnType<typeof setTimeout> | null = null;
	return (palette: string[]) => {
		if (t) clearTimeout(t);
		t = setTimeout(() => {
			t = null;
			void persist(palette);
		}, delayMs);
	};
}
