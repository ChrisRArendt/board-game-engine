import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Browsers default to /favicon.ico; we serve SVG at /favicon.svg */
export const GET: RequestHandler = () => {
	throw redirect(302, '/favicon.svg');
};
