import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession }, url }) => {
	const { session } = await safeGetSession();
	if (session) {
		const next = url.searchParams.get('redirectTo');
		const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/lobby';
		throw redirect(303, safe);
	}
	return {
		redirectTo: url.searchParams.get('redirectTo') ?? '/lobby'
	};
};
