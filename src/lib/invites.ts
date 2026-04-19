import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';
import { ensureLobbyMembership, getLobby } from '$lib/lobby';

export type LobbyInviteRow = Database['public']['Tables']['lobby_invites']['Row'];

export async function sendLobbyInvite(
	supabase: SupabaseClient<Database>,
	opts: { lobbyId: string; inviteeId: string; inviterId: string }
): Promise<LobbyInviteRow> {
	const { data, error } = await supabase
		.from('lobby_invites')
		.insert({
			lobby_id: opts.lobbyId,
			inviter_id: opts.inviterId,
			invitee_id: opts.inviteeId,
			status: 'pending'
		})
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function listPendingInvitesForLobby(
	supabase: SupabaseClient<Database>,
	lobbyId: string
): Promise<LobbyInviteRow[]> {
	const { data, error } = await supabase
		.from('lobby_invites')
		.select('*')
		.eq('lobby_id', lobbyId)
		.eq('status', 'pending');
	if (error) throw error;
	return data ?? [];
}

export async function cancelLobbyInvite(
	supabase: SupabaseClient<Database>,
	inviteId: string
): Promise<void> {
	const now = new Date().toISOString();
	const { error } = await supabase
		.from('lobby_invites')
		.update({ status: 'cancelled', responded_at: now })
		.eq('id', inviteId);
	if (error) throw error;
}

export async function respondToLobbyInvite(
	supabase: SupabaseClient<Database>,
	opts: {
		inviteId: string;
		userId: string;
		decision: 'accepted' | 'declined';
	}
): Promise<void> {
	const { data: row, error: qe } = await supabase
		.from('lobby_invites')
		.select('*')
		.eq('id', opts.inviteId)
		.maybeSingle();
	if (qe) throw qe;
	if (!row) throw new Error('Invite not found');
	if (row.invitee_id !== opts.userId) throw new Error('Not your invite');
	if (row.status !== 'pending') throw new Error('Invite is no longer pending');
	if (new Date(row.expires_at).getTime() < Date.now()) {
		throw new Error('Invite expired');
	}

	const now = new Date().toISOString();
	const { error } = await supabase
		.from('lobby_invites')
		.update({
			status: opts.decision,
			responded_at: now
		})
		.eq('id', opts.inviteId);
	if (error) throw error;

	if (opts.decision === 'accepted') {
		const lobby = await getLobby(supabase, row.lobby_id);
		if (!lobby) throw new Error('Lobby no longer exists');
		await ensureLobbyMembership(supabase, lobby, opts.userId);
	}
}
