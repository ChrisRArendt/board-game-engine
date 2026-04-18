import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';
import { isSortOrderMissingError } from '$lib/lobby/sortOrderFallback';

export type LobbyRow = Database['public']['Tables']['lobbies']['Row'];
export type LobbyVisibility = LobbyRow['visibility'];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomInviteCode(): string {
	let s = '';
	for (let i = 0; i < 6; i++) {
		s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
	}
	return s;
}

export async function createLobby(
	supabase: SupabaseClient<Database>,
	opts: {
		hostId: string;
		name: string;
		gameKey: string;
		maxPlayers: number;
		description?: string;
		visibility?: LobbyVisibility;
	}
): Promise<LobbyRow> {
	for (let attempt = 0; attempt < 8; attempt++) {
		const invite_code = randomInviteCode();
		const { data, error } = await supabase
			.from('lobbies')
			.insert({
				host_id: opts.hostId,
				name: opts.name,
				game_key: opts.gameKey,
				max_players: opts.maxPlayers,
				description: opts.description ?? '',
				visibility: opts.visibility ?? 'private',
				invite_code,
				status: 'waiting'
			})
			.select()
			.single();

		if (!error && data) {
			let ins = await supabase.from('lobby_members').insert({
				lobby_id: data.id,
				user_id: opts.hostId,
				sort_order: 0
			});
			if (ins.error && isSortOrderMissingError(ins.error)) {
				ins = await supabase.from('lobby_members').insert({
					lobby_id: data.id,
					user_id: opts.hostId
				});
			}
			if (ins.error) {
				throw new Error(ins.error.message);
			}
			return data;
		}
		if (error && error.code !== '23505') throw error;
	}
	throw new Error('Could not generate invite code');
}

/**
 * Add user to lobby_members if the lobby is open and has space (same rules as join by code).
 * No-op if they are already a member.
 */
export async function ensureLobbyMembership(
	supabase: SupabaseClient<Database>,
	lobby: LobbyRow,
	userId: string
): Promise<void> {
	const { data: existing } = await supabase
		.from('lobby_members')
		.select('user_id')
		.eq('lobby_id', lobby.id)
		.eq('user_id', userId)
		.maybeSingle();

	if (existing) return;

	/** Allow joining waiting lobbies or rejoining in-progress games (same capacity rules). */
	if (lobby.status !== 'waiting' && lobby.status !== 'playing') {
		throw new Error('LOBBY_JOIN:not_waiting');
	}

	const { count } = await supabase
		.from('lobby_members')
		.select('*', { count: 'exact', head: true })
		.eq('lobby_id', lobby.id);

	if ((count ?? 0) >= lobby.max_players) {
		throw new Error('LOBBY_JOIN:full');
	}

	const { data: maxRow, error: sortErr } = await supabase
		.from('lobby_members')
		.select('sort_order')
		.eq('lobby_id', lobby.id)
		.order('sort_order', { ascending: false })
		.limit(1)
		.maybeSingle();

	let nextSort: number;
	if (sortErr && isSortOrderMissingError(sortErr)) {
		const { count } = await supabase
			.from('lobby_members')
			.select('*', { count: 'exact', head: true })
			.eq('lobby_id', lobby.id);
		nextSort = count ?? 0;
	} else if (sortErr) {
		throw new Error(sortErr.message);
	} else {
		nextSort = (maxRow?.sort_order ?? -1) + 1;
	}

	let ins = await supabase.from('lobby_members').insert({
		lobby_id: lobby.id,
		user_id: userId,
		sort_order: nextSort
	});

	if (ins.error && isSortOrderMissingError(ins.error)) {
		ins = await supabase.from('lobby_members').insert({
			lobby_id: lobby.id,
			user_id: userId
		});
	}

	if (ins.error) {
		if (ins.error.code === '23505') return;
		throw new Error(ins.error.message);
	}
}

export async function joinLobbyByCode(
	supabase: SupabaseClient<Database>,
	inviteCode: string,
	userId: string
): Promise<LobbyRow> {
	const code = inviteCode.trim().toUpperCase();
	const { data: lobby, error } = await supabase
		.from('lobbies')
		.select('*')
		.eq('invite_code', code)
		.eq('status', 'waiting')
		.maybeSingle();

	if (error) throw error;
	if (!lobby) throw new Error('Lobby not found or already started');

	try {
		await ensureLobbyMembership(supabase, lobby, userId);
	} catch (e) {
		const msg = e instanceof Error ? e.message : '';
		if (msg === 'LOBBY_JOIN:full') throw new Error('Lobby is full');
		if (msg === 'LOBBY_JOIN:not_waiting') throw new Error('Lobby not found or already started');
		throw e;
	}
	return lobby;
}

/** Waiting lobbies you host or are a member of (hub “My lobbies”). */
export async function listMyWaitingLobbies(supabase: SupabaseClient<Database>, userId: string) {
	const { data: hosted, error: e1 } = await supabase
		.from('lobbies')
		.select('*')
		.eq('host_id', userId)
		.eq('status', 'waiting')
		.order('created_at', { ascending: false });
	if (e1) throw e1;

	const { data: mrows, error: e2 } = await supabase
		.from('lobby_members')
		.select('lobby_id')
		.eq('user_id', userId);
	if (e2) throw e2;

	const mids = [...new Set((mrows ?? []).map((r) => r.lobby_id))];
	let memberLobbies: LobbyRow[] = [];
	if (mids.length) {
		const { data: ml, error: e3 } = await supabase
			.from('lobbies')
			.select('*')
			.in('id', mids)
			.eq('status', 'waiting')
			.order('created_at', { ascending: false });
		if (e3) throw e3;
		memberLobbies = ml ?? [];
	}

	const byId = new Map<string, LobbyRow>();
	for (const L of [...(hosted ?? []), ...memberLobbies]) {
		byId.set(L.id, L);
	}
	return [...byId.values()].sort(
		(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);
}

/** Discoverable public waiting lobbies (hub “Public” tab). */
export async function listPublicLobbies(
	supabase: SupabaseClient<Database>,
	opts?: { gameKey?: string; q?: string }
) {
	let q = supabase
		.from('lobbies')
		.select('*')
		.eq('status', 'waiting')
		.eq('visibility', 'public')
		.order('created_at', { ascending: false })
		.limit(80);

	if (opts?.gameKey) {
		q = q.eq('game_key', opts.gameKey);
	}

	const needle = opts?.q?.trim();
	if (needle) {
		const esc = needle.replace(/%/g, '\\%').replace(/_/g, '\\_');
		q = q.or(`name.ilike.%${esc}%,description.ilike.%${esc}%`);
	}

	const { data, error } = await q;
	if (error) throw error;
	return data ?? [];
}

/** @deprecated Prefer listMyWaitingLobbies or listPublicLobbies */
export async function listOpenLobbies(supabase: SupabaseClient<Database>) {
	return listPublicLobbies(supabase);
}

export async function updateLobby(
	supabase: SupabaseClient<Database>,
	lobbyId: string,
	hostId: string,
	patch: {
		name?: string;
		description?: string;
		max_players?: number;
		visibility?: LobbyVisibility;
	}
) {
	const { error } = await supabase
		.from('lobbies')
		.update(patch)
		.eq('id', lobbyId)
		.eq('host_id', hostId);
	if (error) throw error;
}

export type PublicLobbyDetail = {
	lobby: LobbyRow;
	host: Database['public']['Tables']['profiles']['Row'];
	memberCount: number;
};

export async function getPublicLobbyDetail(
	supabase: SupabaseClient<Database>,
	lobbyId: string
): Promise<PublicLobbyDetail | null> {
	const { data: lobby, error: lErr } = await supabase
		.from('lobbies')
		.select('*')
		.eq('id', lobbyId)
		.maybeSingle();
	if (lErr) throw lErr;
	if (!lobby || lobby.visibility !== 'public' || lobby.status !== 'waiting') return null;

	const { data: host, error: hErr } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', lobby.host_id)
		.single();
	if (hErr) throw hErr;

	const { count, error: cErr } = await supabase
		.from('lobby_members')
		.select('*', { count: 'exact', head: true })
		.eq('lobby_id', lobbyId);
	if (cErr) throw cErr;

	return { lobby, host, memberCount: count ?? 0 };
}

/** Lobbies the user is in that are currently in `playing` status (resume from hub). */
export async function listMyActiveGames(supabase: SupabaseClient<Database>, userId: string) {
	const { data: rows, error } = await supabase
		.from('lobby_members')
		.select('lobby_id')
		.eq('user_id', userId);

	if (error) throw error;
	const ids = (rows ?? []).map((r) => r.lobby_id);
	if (ids.length === 0) return [];

	const { data: lobbies, error: lErr } = await supabase
		.from('lobbies')
		.select('*')
		.in('id', ids)
		.eq('status', 'playing')
		.order('created_at', { ascending: false });

	if (lErr) throw lErr;
	return lobbies ?? [];
}

export async function deleteLobby(supabase: SupabaseClient<Database>, lobbyId: string, hostId: string) {
	const { error } = await supabase.from('lobbies').delete().eq('id', lobbyId).eq('host_id', hostId);
	if (error) throw error;
}

export async function endGame(supabase: SupabaseClient<Database>, lobbyId: string, hostId: string) {
	const { error } = await supabase
		.from('lobbies')
		.update({ status: 'finished' })
		.eq('id', lobbyId)
		.eq('host_id', hostId);

	if (error) throw error;
}

export async function getLobby(supabase: SupabaseClient<Database>, lobbyId: string) {
	const { data, error } = await supabase.from('lobbies').select('*').eq('id', lobbyId).maybeSingle();
	if (error) throw error;
	return data;
}

export async function getLobbyMembers(supabase: SupabaseClient<Database>, lobbyId: string) {
	const { data: members, error } = await supabase
		.from('lobby_members')
		.select('user_id, joined_at')
		.eq('lobby_id', lobbyId);

	if (error) throw error;
	if (!members?.length) return [];

	const ids = members.map((m) => m.user_id);
	const { data: profiles, error: pErr } = await supabase
		.from('profiles')
		.select('*')
		.in('id', ids);

	if (pErr) throw pErr;
	const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

	return members.map((m) => ({
		...m,
		profile: byId.get(m.user_id)!
	}));
}

export async function leaveLobby(supabase: SupabaseClient<Database>, lobbyId: string, userId: string) {
	const { error } = await supabase
		.from('lobby_members')
		.delete()
		.eq('lobby_id', lobbyId)
		.eq('user_id', userId);

	if (error) throw error;

	const { data: lobby } = await supabase.from('lobbies').select('host_id').eq('id', lobbyId).single();
	if (lobby?.host_id === userId) {
		await supabase.from('lobbies').update({ status: 'finished' }).eq('id', lobbyId);
	}
}

/**
 * Apply member order by updating `sort_order` per row (fallback when `set_lobby_member_order` RPC
 * is missing from PostgREST cache). Requires migration `007_lobby_members_update_policy.sql`.
 */
export async function persistLobbyMemberOrderWithoutRpc(
	supabase: SupabaseClient<Database>,
	lobbyId: string,
	userIds: string[]
): Promise<{ error: PostgrestError | null }> {
	for (let i = 0; i < userIds.length; i++) {
		const { error } = await supabase
			.from('lobby_members')
			.update({ sort_order: i })
			.eq('lobby_id', lobbyId)
			.eq('user_id', userIds[i]);
		if (error) return { error };
	}
	return { error: null };
}

export async function startGame(supabase: SupabaseClient<Database>, lobbyId: string, hostId: string) {
	const { error } = await supabase
		.from('lobbies')
		.update({ status: 'playing' })
		.eq('id', lobbyId)
		.eq('host_id', hostId);

	if (error) throw error;
}
