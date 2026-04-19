import { json, type RequestHandler } from '@sveltejs/kit';
import { getGoogleFontFamilyNames } from '$lib/server/googleFontsFamilyIndex';

/** Full family-name list for the editor; cached server-side and via HTTP Cache-Control. */
export const GET: RequestHandler = async () => {
	const families = await getGoogleFontFamilyNames();
	return json(
		{ families },
		{
			headers: {
				'Cache-Control': 'public, max-age=3600, s-maxage=86400'
			}
		}
	);
};
