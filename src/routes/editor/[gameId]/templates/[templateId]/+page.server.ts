import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { supabase }, params }) => {
	const p = await parent();
	const { data: template, error: qErr } = await supabase
		.from('card_templates')
		.select('*')
		.eq('id', params.templateId)
		.eq('game_id', params.gameId)
		.maybeSingle();
	if (qErr) throw error(500, qErr.message);
	if (!template) throw error(404, 'Template not found');

	const { data: templateBackSources, error: listErr } = await supabase
		.from('card_templates')
		.select('id, name, back_background, back_layers')
		.eq('game_id', params.gameId)
		.neq('id', params.templateId)
		.order('name');
	if (listErr) throw error(500, listErr.message);

	return { ...p, template, templateBackSources: templateBackSources ?? [] };
};
