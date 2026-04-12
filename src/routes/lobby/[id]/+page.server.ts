import { error, redirect } from '@sveltejs/kit';
import { ensureLobbyMembership } from '$lib/lobby';
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

	// #region agent log
	fetch('http://localhost:7278/ingest/b8376de9-9c29-4e05-bd62-1d6be57bcdc1', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1762ed' },
		body: JSON.stringify({
			sessionId: '1762ed',
			runId: 'lobby-load',
			hypothesisId: 'B',
			location: 'lobby/[id]/+page.server.ts:load',
			message: 'membership check',
			data: {
				lobbyId: lobby.id,
				sessionUserId: session.user.id,
				hasMembership: !!membership
			},
			timestamp: Date.now()
		})
	}).catch(() => {});
	// #endregion

	if (!membership) {
		try {
			await ensureLobbyMembership(supabase, lobby, session.user.id);
		} catch (e) {
			// #region agent log
			const errLike = e as { message?: string; code?: string; details?: string; hint?: string };
			fetch('http://localhost:7278/ingest/b8376de9-9c29-4e05-bd62-1d6be57bcdc1', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1762ed' },
				body: JSON.stringify({
					sessionId: '1762ed',
					runId: 'lobby-load',
					hypothesisId: 'D',
					location: 'lobby/[id]/+page.server.ts:ensureLobbyMembership catch',
					message: 'ensureLobbyMembership failed',
					data: {
						isError: e instanceof Error,
						msg: e instanceof Error ? e.message : String(e),
						code: errLike.code,
						details: errLike.details,
						hint: errLike.hint
					},
					timestamp: Date.now()
				})
			}).catch(() => {});
			// #endregion
			const msg = e instanceof Error ? e.message : '';
			if (msg === 'LOBBY_JOIN:not_waiting') {
				throw error(403, 'This lobby is not accepting new players');
			}
			if (msg === 'LOBBY_JOIN:full') {
				throw error(403, 'Lobby is full');
			}
			if (msg) {
				throw error(500, msg);
			}
			throw error(403, 'Could not join this lobby');
		}
	}

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', session.user.id)
		.single();

	const { data: memberRows } = await supabase
		.from('lobby_members')
		.select('user_id, sort_order')
		.eq('lobby_id', lobby.id)
		.order('sort_order', { ascending: true });

	const rows = memberRows ?? [];
	const userIds = rows.map((r) => r.user_id);
	let members: {
		user_id: string;
		sort_order: number;
		display_name: string;
		avatar_url: string | null;
	}[] = [];

	if (userIds.length > 0) {
		const { data: profs } = await supabase
			.from('profiles')
			.select('id, display_name, avatar_url')
			.in('id', userIds);
		const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
		members = rows.map((r) => {
			const p = pmap.get(r.user_id);
			return {
				user_id: r.user_id,
				sort_order: r.sort_order,
				display_name: p?.display_name ?? 'Player',
				avatar_url: p?.avatar_url ?? null
			};
		});
	}

	return {
		lobby,
		session,
		profile,
		members
	};
};
