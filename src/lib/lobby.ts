import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';

export type LobbyRow = Database['public']['Tables']['lobbies']['Row'];

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
	opts: { hostId: string; name: string; gameKey: string; maxPlayers: number }
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
				invite_code,
				status: 'waiting'
			})
			.select()
			.single();

		if (!error && data) {
			await supabase.from('lobby_members').insert({
				lobby_id: data.id,
				user_id: opts.hostId
			});
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

	if (lobby.status !== 'waiting') {
		throw new Error('LOBBY_JOIN:not_waiting');
	}

	const { count } = await supabase
		.from('lobby_members')
		.select('*', { count: 'exact', head: true })
		.eq('lobby_id', lobby.id);

	if ((count ?? 0) >= lobby.max_players) {
		throw new Error('LOBBY_JOIN:full');
	}

	const { error: insErr } = await supabase.from('lobby_members').insert({
		lobby_id: lobby.id,
		user_id: userId
	});

	if (insErr) {
		if (insErr.code === '23505') return;
		throw insErr;
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

export async function listOpenLobbies(supabase: SupabaseClient<Database>) {
	const { data, error } = await supabase
		.from('lobbies')
		.select('*')
		.eq('status', 'waiting')
		.order('created_at', { ascending: false })
		.limit(50);

	if (error) throw error;
	return data ?? [];
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

export async function startGame(supabase: SupabaseClient<Database>, lobbyId: string, hostId: string) {
	const { error } = await supabase
		.from('lobbies')
		.update({ status: 'playing' })
		.eq('id', lobbyId)
		.eq('host_id', hostId);

	if (error) throw error;
}
