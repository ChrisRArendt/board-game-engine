import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw redirect(303, '/login');
	}

	const { data: lobby, error: lobErr } = await supabase
		.from('lobbies')
		.select('*')
		.eq('id', params.id)
		.maybeSingle();

	if (lobErr || !lobby) {
		throw error(404, 'Lobby not found');
	}

	const { data: membership } = await supabase
		.from('lobby_members')
		.select('user_id')
		.eq('lobby_id', lobby.id)
		.eq('user_id', session.user.id)
		.maybeSingle();

	if (!membership) {
		throw error(403, 'Not a member of this lobby');
	}

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', session.user.id)
		.single();

	const { data: members } = await supabase
		.from('lobby_members')
		.select('user_id')
		.eq('lobby_id', lobby.id);

	return {
		lobby,
		session,
		profile,
		members: members ?? []
	};
};
