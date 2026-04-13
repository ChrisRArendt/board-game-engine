import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { supabase }, params }) => {
	const p = await parent();
	const { data: templates } = await supabase
		.from('card_templates')
		.select('id, name, canvas_width, canvas_height, updated_at')
		.eq('game_id', params.gameId)
		.order('name');
	return { ...p, templates: templates ?? [] };
};
