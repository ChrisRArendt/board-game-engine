import type { PageServerLoad } from './$types';
import { collectUsedMediaIds } from '$lib/editor/mediaUsage';

export const load: PageServerLoad = async ({ parent, locals: { supabase }, params }) => {
	const p = await parent();
	const { data: media } = await supabase
		.from('game_media')
		.select('*')
		.eq('game_id', params.gameId)
		.order('created_at', { ascending: false });

	const { data: templates } = await supabase
		.from('card_templates')
		.select('id, layers')
		.eq('game_id', params.gameId);

	const { data: cards } = await supabase
		.from('card_instances')
		.select('template_id, field_values')
		.eq('game_id', params.gameId);

	const usedMediaIds = collectUsedMediaIds(templates ?? [], cards ?? []);

	return { ...p, media: media ?? [], usedMediaIds: [...usedMediaIds] };
};
