import { error, redirect } from '@sveltejs/kit';
import { pageTitle } from '$lib/site';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) throw redirect(303, '/login');

	const { data: game, error: qErr } = await supabase
		.from('custom_board_games')
		.select('*')
		.eq('id', params.gameId)
		.maybeSingle();

	if (qErr) throw error(500, qErr.message);
	if (!game) throw error(404, 'Game not found');
	if (game.creator_id !== session.user.id) throw error(403, 'Only the creator can edit');

	return {
		game,
		title: pageTitle(game.title)
	};
};
