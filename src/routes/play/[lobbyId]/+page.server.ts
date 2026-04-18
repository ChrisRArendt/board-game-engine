import { error, redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { fetchLobbyMembersOrdered, messageFromUnknown } from '$lib/lobby/sortOrderFallback';
import { pageTitle } from '$lib/site';
import { customGameAssetBaseUrl, customRulesPublicUrl, isCustomGameKey } from '$lib/customGames';
import type { GameDataJson } from '$lib/engine/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw redirect(303, '/login');
	}

	const { data: lobby, error: lobErr } = await supabase
		.from('lobbies')
		.select('*')
		.eq('id', params.lobbyId)
		.maybeSingle();

	if (lobErr || !lobby) {
		throw error(404, 'Lobby not found');
	}

	if (lobby.status !== 'playing') {
		throw redirect(303, `/lobby/${params.lobbyId}`);
	}

	const { data: membership } = await supabase
		.from('lobby_members')
		.select('user_id')
		.eq('lobby_id', lobby.id)
		.eq('user_id', session.user.id)
		.maybeSingle();

	if (!membership) {
		throw error(403, 'Not a member of this game');
	}

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', session.user.id)
		.single();

	let memberOrderIds: string[];
	try {
		const orderRows = await fetchLobbyMembersOrdered(supabase, lobby.id);
		memberOrderIds = orderRows.map((r) => r.user_id);
	} catch (e) {
		throw error(500, messageFromUnknown(e));
	}

	const { data: snapRow } = await supabase
		.from('game_snapshots')
		.select('snapshot')
		.eq('lobby_id', lobby.id)
		.maybeSingle();

	const isHost = lobby.host_id === session.user.id;

	let customGame:
		| {
				gameData: GameDataJson;
				assetBaseUrl: string;
				rulesUrl: string | null;
		  }
		| null = null;

	if (isCustomGameKey(lobby.game_key)) {
		const { data: cg, error: cgErr } = await supabase
			.from('custom_board_games')
			.select('id, creator_id, game_data, rules_pdf_path')
			.eq('game_key', lobby.game_key)
			.maybeSingle();

		if (cgErr) {
			throw error(500, messageFromUnknown(cgErr));
		}
		if (!cg) {
			throw error(404, 'Custom board game not found');
		}
		const assetBaseUrl = customGameAssetBaseUrl(PUBLIC_SUPABASE_URL, cg.creator_id, cg.id);
		const rulesUrl = cg.rules_pdf_path
			? customRulesPublicUrl(PUBLIC_SUPABASE_URL, cg.rules_pdf_path)
			: null;
		customGame = {
			gameData: cg.game_data as unknown as GameDataJson,
			assetBaseUrl,
			rulesUrl
		};
	}

	return {
		lobby,
		session,
		profile,
		memberOrderIds,
		storedSnapshot: snapRow?.snapshot ?? null,
		isHost,
		customGame,
		title: pageTitle(lobby.name.trim() || 'Game')
	};
};
