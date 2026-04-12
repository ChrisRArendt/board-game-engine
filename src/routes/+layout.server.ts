import type { LayoutServerLoad } from './$types';
import type { ProfileRow } from '$lib/supabase/database.types';

export const load: LayoutServerLoad = async ({ locals: { supabase, safeGetSession }, depends }) => {
	depends('supabase:auth');
	const { session } = await safeGetSession();

	let profile: ProfileRow | null = null;
	if (session?.user) {
		const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
		profile = data ?? null;
	}

	return { session, profile };
};
