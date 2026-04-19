import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { supabase }, params, depends }) => {
	depends('app:card-instances');
	const p = await parent();
	const { data: card, error: cErr } = await supabase
		.from('card_instances')
		.select('*')
		.eq('id', params.cardId)
		.eq('game_id', params.gameId)
		.maybeSingle();
	if (cErr) throw error(500, cErr.message);
	if (!card) throw error(404, 'Card not found');

	const { data: template, error: tErr } = await supabase
		.from('card_templates')
		.select('*')
		.eq('id', card.template_id)
		.single();
	if (tErr || !template) throw error(404, 'Template not found');

	return { ...p, card, template };
};
