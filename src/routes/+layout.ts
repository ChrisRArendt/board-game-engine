import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends }) => {
	depends('supabase:auth');
	/** Preserve page `load` fields (e.g. `title`) alongside session/profile. */
	return { ...data };
};
