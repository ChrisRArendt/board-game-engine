import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const {
		url,
		locals: { supabase }
	} = event;

	const code = url.searchParams.get('code');
	if (code) {
		await supabase.auth.exchangeCodeForSession(code);
	}

	let next = url.searchParams.get('next') ?? '/lobby';
	if (!next.startsWith('/') || next.startsWith('//')) {
		next = '/lobby';
	}

	throw redirect(303, next);
};
