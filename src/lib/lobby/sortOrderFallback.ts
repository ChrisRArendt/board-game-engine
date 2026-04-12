import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';

/**
 * Use `joined_at` / omit `sort_order` on insert when PostgREST rejects `sort_order` for any reason:
 * stale API schema cache, or the error only appearing in `details` (not only `message`).
 */
export function isSortOrderMissingError(
	err: { message?: string; details?: string; hint?: string; code?: string } | null | undefined
): boolean {
	const m = `${err?.message ?? ''} ${err?.details ?? ''} ${err?.hint ?? ''}`.toLowerCase();
	const c = err?.code ?? '';
	if (m.includes('sort_order') && m.includes('schema cache')) return true;
	if (m.includes("could not find the 'sort_order' column")) return true;
	if (m.includes('sort_order') && m.includes('does not exist')) return true;
	if (c === '42703' && m.includes('sort_order')) return true;
	/* PostgREST: missing column / stale cache */
	if ((c === 'PGRST204' || c === 'PGRST205') && m.includes('sort_order')) return true;
	return false;
}

/** @deprecated use isSortOrderMissingError */
export const isSortOrderSchemaCacheError = isSortOrderMissingError;

/** PostgREST cache missing an RPC (e.g. set_lobby_member_order) — use row updates instead. */
export function isRpcMissingFromCacheError(err: { message?: string; details?: string } | null | undefined): boolean {
	const m = `${err?.message ?? ''} ${err?.details ?? ''}`.toLowerCase();
	return (
		(m.includes('schema cache') && m.includes('function')) ||
		m.includes('could not find the function')
	);
}

export type LobbyMemberOrderRow = { user_id: string; sort_order: number };

/**
 * Load lobby member rows in display order. Prefer `sort_order`; if PostgREST cache is stale,
 * fall back to `joined_at` (same as initial migration backfill).
 */
/** Safe string for SvelteKit `error()` when catching PostgREST objects. */
export function messageFromUnknown(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
		return (e as { message: string }).message;
	}
	try {
		return JSON.stringify(e);
	} catch {
		return String(e);
	}
}

function postgrestErrMessage(err: { message?: string; details?: string; hint?: string }): string {
	const parts = [err.message, err.details, err.hint].filter(Boolean);
	return parts.length ? parts.join(' — ') : JSON.stringify(err);
}

export async function fetchLobbyMembersOrdered(
	supabase: SupabaseClient<Database>,
	lobbyId: string
): Promise<LobbyMemberOrderRow[]> {
	const primary = await supabase
		.from('lobby_members')
		.select('user_id, sort_order')
		.eq('lobby_id', lobbyId)
		.order('sort_order', { ascending: true });

	if (!primary.error) {
		return primary.data ?? [];
	}

	if (isSortOrderMissingError(primary.error)) {
		const fb = await supabase
			.from('lobby_members')
			.select('user_id, joined_at')
			.eq('lobby_id', lobbyId)
			.order('joined_at', { ascending: true });
		if (fb.error) {
			throw new Error(postgrestErrMessage(fb.error));
		}
		return (fb.data ?? []).map((r, i) => ({ user_id: r.user_id, sort_order: i }));
	}

	throw new Error(postgrestErrMessage(primary.error));
}
