import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { supabase }, params }) => {
	const p = await parent();
	const { data: templates } = await supabase
		.from('card_templates')
		.select('*')
		.eq('game_id', params.gameId)
		.order('name');
	const { data: cards } = await supabase
		.from('card_instances')
		.select('id, name, template_id, render_stale, rendered_image_path, field_values, updated_at')
		.eq('game_id', params.gameId)
		.order('name');
	const { data: mediaForCards } = await supabase
		.from('game_media')
		.select('id, file_path')
		.eq('game_id', params.gameId);
	return {
		...p,
		templates: templates ?? [],
		cards: cards ?? [],
		mediaForCards: mediaForCards ?? []
	};
};
