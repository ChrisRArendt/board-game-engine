import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';

export type NotificationRow = Database['public']['Tables']['notifications']['Row'];

export async function listNotifications(
	supabase: SupabaseClient<Database>,
	userId: string,
	limit = 80
): Promise<NotificationRow[]> {
	const { data, error } = await supabase
		.from('notifications')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(limit);
	if (error) throw error;
	return data ?? [];
}

export async function getUnreadCount(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<number> {
	const { count, error } = await supabase
		.from('notifications')
		.select('*', { count: 'exact', head: true })
		.eq('user_id', userId)
		.is('read_at', null);
	if (error) throw error;
	return count ?? 0;
}

export async function markRead(
	supabase: SupabaseClient<Database>,
	userId: string,
	ids: string[]
): Promise<void> {
	if (ids.length === 0) return;
	const now = new Date().toISOString();
	const { error } = await supabase
		.from('notifications')
		.update({ read_at: now })
		.eq('user_id', userId)
		.in('id', ids)
		.is('read_at', null);
	if (error) throw error;
}

export async function markAllRead(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<void> {
	const now = new Date().toISOString();
	const { error } = await supabase
		.from('notifications')
		.update({ read_at: now })
		.eq('user_id', userId)
		.is('read_at', null);
	if (error) throw error;
}

/** Mark lobby_invite notifications for a lobby as read (QoL when entering the room). */
export async function markLobbyInviteNotificationsReadForLobby(
	supabase: SupabaseClient<Database>,
	userId: string,
	lobbyId: string
): Promise<void> {
	const { data: full, error: fErr } = await supabase
		.from('notifications')
		.select('id, payload')
		.eq('user_id', userId)
		.eq('kind', 'lobby_invite')
		.is('read_at', null);
	if (fErr) throw fErr;
	const toMark =
		full
			?.filter((n) => {
				const pl = n.payload as { lobby_id?: string } | null;
				return pl?.lobby_id === lobbyId;
			})
			.map((n) => n.id) ?? [];
	await markRead(supabase, userId, toMark);
}

export type NotificationHandlers = {
	onInsert?: (row: NotificationRow) => void;
	onUpdate?: (row: NotificationRow) => void;
};

export function subscribeUserNotifications(
	supabase: SupabaseClient<Database>,
	userId: string,
	handlers: NotificationHandlers
): RealtimeChannel {
	const ch = supabase
		.channel(`user_notifications:${userId}`)
		.on(
			'postgres_changes',
			{
				event: 'INSERT',
				schema: 'public',
				table: 'notifications',
				filter: `user_id=eq.${userId}`
			},
			(payload) => {
				const row = payload.new as NotificationRow;
				handlers.onInsert?.(row);
			}
		)
		.on(
			'postgres_changes',
			{
				event: 'UPDATE',
				schema: 'public',
				table: 'notifications',
				filter: `user_id=eq.${userId}`
			},
			(payload) => {
				const row = payload.new as NotificationRow;
				handlers.onUpdate?.(row);
			}
		);
	void ch.subscribe();
	return ch;
}
