import { pageTitle } from '$lib/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { title: pageTitle('Messages') };
};
