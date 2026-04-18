import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
	const parentData = await parent();
	const game = parentData.game;
	if (!game?.id) return parentData;

	const { data: gameMediaList, error: qErr } = await supabase
		.from('game_media')
		.select('id, file_path')
		.eq('game_id', game.id)
		.order('created_at', { ascending: false });

	if (qErr) {
		console.error('[editor settings] game_media', qErr);
		return { ...parentData, gameMediaList: [] };
	}

	return {
		...parentData,
		gameMediaList: gameMediaList ?? []
	};
};
