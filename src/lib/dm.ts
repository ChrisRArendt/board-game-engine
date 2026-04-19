import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';
import type { ProfileRow } from '$lib/supabase/database.types';

export type ConversationRow = Database['public']['Tables']['conversations']['Row'];
export type ConversationMessageRow = Database['public']['Tables']['conversation_messages']['Row'];

export type ConversationWithPeer = ConversationRow & {
	other_user_id: string;
	other_profile: Pick<ProfileRow, 'id' | 'display_name' | 'avatar_url' | 'username'> | null;
	last_preview: string | null;
	unread: boolean;
};

function otherUserId(conv: ConversationRow, me: string): string {
	return conv.user_a === me ? conv.user_b : conv.user_a;
}

export async function openConversationWith(
	supabase: SupabaseClient<Database>,
	otherUserId: string
): Promise<string> {
	const { data, error } = await supabase.rpc('dm_open', { _other: otherUserId });
	if (error) throw error;
	return data as string;
}

export async function listConversations(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<ConversationWithPeer[]> {
	const { data: convs, error } = await supabase
		.from('conversations')
		.select('*')
		.or(`user_a.eq.${userId},user_b.eq.${userId}`)
		.order('last_message_at', { ascending: false });
	if (error) throw error;
	const list = convs ?? [];
	const otherIds = [...new Set(list.map((c) => otherUserId(c, userId)))];
	let profiles = new Map<string, ProfileRow>();
	if (otherIds.length) {
		const { data: profs, error: pe } = await supabase
			.from('profiles')
			.select('id, display_name, avatar_url, username')
			.in('id', otherIds);
		if (pe) throw pe;
		for (const p of profs ?? []) profiles.set(p.id, p as ProfileRow);
	}

	const reads = new Map<string, string>();
	const { data: rrows } = await supabase
		.from('conversation_reads')
		.select('conversation_id, last_read_at')
		.eq('user_id', userId);
	for (const r of rrows ?? []) reads.set(r.conversation_id, r.last_read_at);

	const out: ConversationWithPeer[] = [];
	for (const c of list) {
		const oid = otherUserId(c, userId);
		const prof = profiles.get(oid) ?? null;
		const { data: lastMsg } = await supabase
			.from('conversation_messages')
			.select('body, created_at, sender_id')
			.eq('conversation_id', c.id)
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();
		const lastAt = lastMsg?.created_at;
		const readAt = reads.get(c.id);
		const unread =
			lastMsg &&
			lastAt &&
			lastMsg.sender_id !== userId &&
			(!readAt || new Date(lastAt).getTime() > new Date(readAt).getTime());
		out.push({
			...c,
			other_user_id: oid,
			other_profile: prof
				? {
						id: prof.id,
						display_name: prof.display_name,
						avatar_url: prof.avatar_url,
						username: prof.username
					}
				: null,
			last_preview: lastMsg?.body ? lastMsg.body.slice(0, 120) : null,
			unread: !!unread
		});
	}
	return out;
}

export async function listMessages(
	supabase: SupabaseClient<Database>,
	conversationId: string,
	opts?: { limit?: number }
): Promise<ConversationMessageRow[]> {
	const lim = opts?.limit ?? 100;
	const { data, error } = await supabase
		.from('conversation_messages')
		.select('*')
		.eq('conversation_id', conversationId)
		.order('created_at', { ascending: false })
		.limit(lim);
	if (error) throw error;
	return [...(data ?? [])].reverse();
}

export async function sendMessage(
	supabase: SupabaseClient<Database>,
	opts: { conversationId: string; senderId: string; body: string }
): Promise<ConversationMessageRow> {
	const body = opts.body.trim();
	if (!body) throw new Error('Empty message');
	const { data, error } = await supabase
		.from('conversation_messages')
		.insert({
			conversation_id: opts.conversationId,
			sender_id: opts.senderId,
			body
		})
		.select()
		.single();
	if (error) throw error;
	return data;
}

/** Mark thread read + clear matching DM inbox notification. */
export async function markConversationRead(
	supabase: SupabaseClient<Database>,
	opts: { conversationId: string; userId: string }
): Promise<void> {
	const now = new Date().toISOString();
	const { error: e1 } = await supabase.from('conversation_reads').upsert(
		{
			conversation_id: opts.conversationId,
			user_id: opts.userId,
			last_read_at: now
		},
		{ onConflict: 'conversation_id,user_id' }
	);
	if (e1) throw e1;

	const { data: notes } = await supabase
		.from('notifications')
		.select('id, payload')
		.eq('user_id', opts.userId)
		.eq('kind', 'dm')
		.is('read_at', null);
	const ids =
		notes
			?.filter((n) => {
				const pl = n.payload as { conversation_id?: string };
				return pl?.conversation_id === opts.conversationId;
			})
			.map((n) => n.id) ?? [];
	if (ids.length) {
		const { error: e2 } = await supabase
			.from('notifications')
			.update({ read_at: now })
			.in('id', ids);
		if (e2) throw e2;
	}
}
