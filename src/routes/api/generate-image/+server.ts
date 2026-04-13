import { error, json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { publicStorageUrl } from '$lib/editor/mediaUrls';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) throw error(401, 'Unauthorized');

	const OPENAI_API_KEY = env.OPENAI_API_KEY;
	if (!OPENAI_API_KEY) {
		throw error(503, 'OPENAI_API_KEY is not configured');
	}

	let body: { prompt?: string; gameId?: string };
	try {
		body = (await request.json()) as { prompt?: string; gameId?: string };
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
	const gameId = typeof body.gameId === 'string' ? body.gameId : '';
	if (!prompt || prompt.length > 8000) throw error(400, 'Invalid prompt');
	if (!gameId) throw error(400, 'gameId required');

	const { data: game, error: gErr } = await supabase
		.from('custom_board_games')
		.select('id, creator_id')
		.eq('id', gameId)
		.maybeSingle();

	if (gErr || !game) throw error(404, 'Game not found');
	if (game.creator_id !== session.user.id) throw error(403, 'Forbidden');

	const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
	let imageBuffer: Buffer;
	try {
		const result = await openai.images.generate({
			model: 'gpt-image-1-mini',
			prompt,
			size: '1024x1024',
			quality: 'low',
			n: 1,
			output_format: 'webp',
			background: 'opaque'
		});
		const d = result.data?.[0];
		const b64 = d?.b64_json;
		if (b64) {
			imageBuffer = Buffer.from(b64, 'base64');
		} else if (d?.url) {
			const imgRes = await fetch(d.url);
			imageBuffer = Buffer.from(await imgRes.arrayBuffer());
		} else {
			throw new Error('No image in response');
		}
	} catch (e) {
		console.error('[api/generate-image]', e);
		throw error(502, e instanceof Error ? e.message : 'Image generation failed');
	}

	const webpBuf = await sharp(imageBuffer)
		.resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
		.webp({ quality: 85 })
		.toBuffer();

	const meta = await sharp(webpBuf).metadata();
	const fileId = randomUUID();
	const filePath = `${session.user.id}/${gameId}/media/${fileId}.webp`;

	const { error: upErr } = await supabase.storage.from('custom-game-assets').upload(filePath, webpBuf, {
		contentType: 'image/webp',
		upsert: false
	});

	if (upErr) {
		console.error('[api/generate-image] upload', upErr);
		throw error(500, upErr.message);
	}

	const { data: mediaRow, error: insErr } = await supabase
		.from('game_media')
		.insert({
			game_id: gameId,
			creator_id: session.user.id,
			file_path: filePath,
			filename: `${fileId}.webp`,
			source_type: 'ai_generated',
			ai_prompt: prompt,
			width: meta.width ?? null,
			height: meta.height ?? null
		})
		.select('id')
		.single();

	if (insErr || !mediaRow) {
		console.error('[api/generate-image] insert', insErr);
		throw error(500, insErr?.message ?? 'Failed to save media');
	}

	return json({
		mediaId: mediaRow.id,
		publicUrl: publicStorageUrl(filePath),
		filePath
	});
};
