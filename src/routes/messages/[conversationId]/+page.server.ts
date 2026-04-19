import { error, redirect } from '@sveltejs/kit';
import { pageTitle } from '$lib/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals: { supabase } }) => {
	const { session } = await parent();
	if (!session) throw redirect(303, '/login');

	const { data: conv, error: ce } = await supabase
		.from('conversations')
		.select('*')
		.eq('id', params.conversationId)
		.maybeSingle();

	if (ce) throw error(500, ce.message);
	if (!conv) throw error(404, 'Conversation not found');

	const uid = session.user.id;
	if (uid !== conv.user_a && uid !== conv.user_b) throw error(403, 'Forbidden');

	const otherId = uid === conv.user_a ? conv.user_b : conv.user_a;
	const { data: peer, error: pe } = await supabase.from('profiles').select('*').eq('id', otherId).single();

	if (pe || !peer) throw error(500, pe?.message ?? 'Peer not found');

	return {
		conv,
		peer,
		title: pageTitle(`Messages — ${peer.display_name}`)
	};
};
