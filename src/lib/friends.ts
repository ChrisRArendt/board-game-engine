import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export async function searchUsers(
	supabase: SupabaseClient<Database>,
	query: string,
	selfId: string
): Promise<ProfileRow[]> {
	const q = query.trim();
	if (q.length < 2) return [];

	const { data, error } = await supabase
		.from('profiles')
		.select('*')
		.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
		.neq('id', selfId)
		.limit(20);

	if (error) throw error;
	return data ?? [];
}

export async function sendFriendRequest(
	supabase: SupabaseClient<Database>,
	addresseeId: string,
	selfId: string
) {
	const { data, error } = await supabase
		.from('friendships')
		.insert({ requester_id: selfId, addressee_id: addresseeId, status: 'pending' })
		.select()
		.single();

	if (error) throw error;
	return data;
}

export async function acceptRequest(supabase: SupabaseClient<Database>, friendshipId: string) {
	const { error } = await supabase
		.from('friendships')
		.update({ status: 'accepted' })
		.eq('id', friendshipId);

	if (error) throw error;
}

export async function declineRequest(supabase: SupabaseClient<Database>, friendshipId: string) {
	const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
	if (error) throw error;
}

export async function removeFriend(supabase: SupabaseClient<Database>, friendshipId: string) {
	const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
	if (error) throw error;
}

export type FriendWithProfile = {
	friendshipId: string;
	profile: ProfileRow;
};

export async function getFriends(
	supabase: SupabaseClient<Database>,
	selfId: string
): Promise<FriendWithProfile[]> {
	const { data: rows, error } = await supabase
		.from('friendships')
		.select('id, requester_id, addressee_id, status')
		.eq('status', 'accepted')
		.or(`requester_id.eq.${selfId},addressee_id.eq.${selfId}`);

	if (error) throw error;
	if (!rows?.length) return [];

	const friendIds = rows.map((r) =>
		r.requester_id === selfId ? r.addressee_id : r.requester_id
	);

	const { data: profiles, error: pErr } = await supabase
		.from('profiles')
		.select('*')
		.in('id', friendIds);

	if (pErr) throw pErr;
	const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

	return rows
		.map((r) => {
			const fid = r.requester_id === selfId ? r.addressee_id : r.requester_id;
			const profile = byId.get(fid);
			if (!profile) return null;
			return { friendshipId: r.id, profile };
		})
		.filter((x): x is FriendWithProfile => x !== null);
}

export type PendingRequest = {
	id: string;
	requester: ProfileRow;
};

export async function getPendingIncoming(
	supabase: SupabaseClient<Database>,
	selfId: string
): Promise<PendingRequest[]> {
	const { data: rows, error } = await supabase
		.from('friendships')
		.select('id, requester_id')
		.eq('addressee_id', selfId)
		.eq('status', 'pending');

	if (error) throw error;
	if (!rows?.length) return [];

	const ids = rows.map((r) => r.requester_id);
	const { data: profiles, error: pErr } = await supabase
		.from('profiles')
		.select('*')
		.in('id', ids);

	if (pErr) throw pErr;
	const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

	return rows
		.map((r) => {
			const requester = byId.get(r.requester_id);
			if (!requester) return null;
			return { id: r.id, requester };
		})
		.filter((x): x is PendingRequest => x !== null);
}
