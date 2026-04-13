import type { PageServerLoad } from './$types';
import { type CardForBoardPiece, templateHasBack } from '$lib/editor/types';

export const load: PageServerLoad = async ({ parent, locals: { supabase }, params }) => {
	const p = await parent();
	const { data: cardRows } = await supabase
		.from('card_instances')
		.select('id, name, rendered_image_path, template_id')
		.eq('game_id', params.gameId)
		.not('rendered_image_path', 'is', null)
		.order('name');

	const rows = cardRows ?? [];
	const templateIds = [...new Set(rows.map((c) => c.template_id))];
	let cardsForBoard: CardForBoardPiece[] = [];

	if (templateIds.length) {
		const { data: tpls } = await supabase
			.from('card_templates')
			.select('id, canvas_width, canvas_height, back_background, back_layers')
			.in('id', templateIds);
		const map = new Map((tpls ?? []).map((t) => [t.id, t]));
		cardsForBoard = rows.map((c) => {
			const t = map.get(c.template_id);
			return {
				id: c.id,
				name: c.name,
				rendered_image_path: c.rendered_image_path,
				canvas_width: t?.canvas_width ?? 375,
				canvas_height: t?.canvas_height ?? 525,
				has_back: t ? templateHasBack(t.back_background, t.back_layers) : false
			};
		});
	}

	return { ...p, cardsForBoard };
};
