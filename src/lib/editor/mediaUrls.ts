import { PUBLIC_SUPABASE_URL } from '$env/static/public';

export function publicStorageUrl(filePath: string): string {
	const base = PUBLIC_SUPABASE_URL.replace(/\/$/, '');
	return `${base}/storage/v1/object/public/custom-game-assets/${filePath}`;
}
