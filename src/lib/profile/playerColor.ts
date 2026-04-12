import { createSupabaseBrowserClient } from '$lib/supabase/client';

/** Persist chosen ring color to the signed-in user profile (cross-device). Empty = automatic. */
export async function savePlayerColorToAccount(hex: string | ''): Promise<{ ok: boolean }> {
	const supabase = createSupabaseBrowserClient();
	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) return { ok: false };
	const trimmed = hex.trim();
	const value =
		trimmed && /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
	const { error } = await supabase
		.from('profiles')
		.update({ player_color: value })
		.eq('id', user.id);
	return { ok: !error };
}
