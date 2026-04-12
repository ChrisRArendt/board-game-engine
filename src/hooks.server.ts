import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/supabase/server';

const supabaseHandle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event.cookies);

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) {
			return { session: null };
		}
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) {
			return { session: null };
		}
		return { session };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

const authGuardHandle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const isProtected = path.startsWith('/lobby') || path.startsWith('/play');

	if (isProtected) {
		const { session } = await event.locals.safeGetSession();
		if (!session) {
			throw redirect(303, `/login?redirectTo=${encodeURIComponent(path + event.url.search)}`);
		}
	}

	return resolve(event);
};

export const handle = sequence(supabaseHandle, authGuardHandle);
