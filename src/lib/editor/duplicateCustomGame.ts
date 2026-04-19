import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '$lib/supabase/database.types';
import type { GameDataJson } from '$lib/engine/types';
import { parseGameDataJson } from '$lib/editor/gameDataJson';

const BUCKET = 'custom-game-assets';

const CARD_BG_RE = /^cards\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.png$/i;

function duplicateTitle(title: string): string {
	const suffix = ' (copy)';
	const max = 500;
	const base = title.trim() || 'Untitled game';
	if (base.length + suffix.length <= max) return base + suffix;
	return base.slice(0, Math.max(0, max - suffix.length)) + suffix;
}

/**
 * Build destination storage path for the duplicate: `{sessionUid}/{newGameId}/{rest}` where `rest`
 * is everything after `/{sourceGameId}/` in the source path.
 * Always uses the signed-in user for the first segment so INSERT RLS passes, even when legacy
 * `file_path` rows used a different owner prefix than `auth.uid()`.
 */
function destPathForDuplicate(
	sessionUid: string,
	sourceGameId: string,
	newGameId: string,
	oldPath: string
): string {
	const marker = `/${sourceGameId}/`;
	const i = oldPath.indexOf(marker);
	if (i === -1) {
		throw new Error(`Expected path to contain ${marker}: ${oldPath}`);
	}
	const rest = oldPath.slice(i + marker.length);
	return `${sessionUid}/${newGameId}/${rest}`;
}

function deepCloneJson<T>(v: T): T {
	return typeof structuredClone === 'function'
		? structuredClone(v)
		: (JSON.parse(JSON.stringify(v)) as T);
}

/** Replace any string value that is an old media UUID with the new id. */
function remapUuidStringsInJson(value: unknown, idMap: Map<string, string>): unknown {
	if (typeof value === 'string') {
		return idMap.get(value) ?? value;
	}
	if (Array.isArray(value)) {
		return value.map((x) => remapUuidStringsInJson(x, idMap));
	}
	if (value && typeof value === 'object') {
		const o = value as Record<string, unknown>;
		const next: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(o)) {
			next[k] = remapUuidStringsInJson(v, idMap);
		}
		return next;
	}
	return value;
}

function remapGameDataPieceRefs(
	gd: GameDataJson,
	templateIdMap: Map<string, string>,
	instanceIdMap: Map<string, string>
): GameDataJson {
	const out = deepCloneJson(gd);
	for (const p of out.pieces) {
		if (p.card_template_id) {
			const next = templateIdMap.get(p.card_template_id);
			if (next) p.card_template_id = next;
		}
		if (p.bg) {
			const m = p.bg.match(CARD_BG_RE);
			if (m) {
				const newId = instanceIdMap.get(m[1]);
				if (newId) p.bg = `cards/${newId}.png`;
			}
		}
	}
	return out;
}

function guessContentType(path: string): string {
	const lower = path.toLowerCase();
	if (lower.endsWith('.png')) return 'image/png';
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	if (lower.endsWith('.webp')) return 'image/webp';
	if (lower.endsWith('.gif')) return 'image/gif';
	if (lower.endsWith('.svg')) return 'image/svg+xml';
	if (lower.endsWith('.pdf')) return 'application/pdf';
	return 'application/octet-stream';
}

/**
 * Clone a storage object within the bucket. Uses download + upload so INSERT RLS applies
 * (Storage `copy()` can fail with "new row violates row-level security policy" on some projects).
 */
async function storageDuplicateObject(
	supabase: SupabaseClient<Database>,
	fromPath: string,
	toPath: string,
	sessionUid: string
): Promise<void> {
	const { data: blob, error: dErr } = await supabase.storage.from(BUCKET).download(fromPath);
	if (dErr || !blob) {
		throw new Error(`Storage download ${fromPath}: ${dErr?.message ?? 'no data'}`);
	}

	const { error: uErr } = await supabase.storage.from(BUCKET).upload(toPath, blob, {
		upsert: true,
		contentType: guessContentType(toPath) || blob.type || undefined
	});
	if (uErr) {
		throw new Error(`Storage upload ${toPath}: ${uErr.message}`);
	}
}

async function storageRemovePaths(supabase: SupabaseClient<Database>, paths: string[]): Promise<void> {
	if (paths.length === 0) return;
	const { error } = await supabase.storage.from(BUCKET).remove(paths);
	if (error) console.warn('[duplicateGame] rollback storage remove', error);
}

async function rollbackDbAndStorage(
	supabase: SupabaseClient<Database>,
	newGameId: string,
	copiedPaths: string[]
): Promise<void> {
	const { error } = await supabase.from('custom_board_games').delete().eq('id', newGameId);
	if (error) console.warn('[duplicateGame] rollback delete game', error);
	await storageRemovePaths(supabase, copiedPaths);
}

export type DuplicateGameProgress = {
	/** Short stage name for the UI title line */
	stage: string;
	/** Current action (file name, template name, etc.) */
	detail: string;
	completed: number;
	total: number;
	/** 0–100 */
	percent: number;
};

function createProgressReporter(
	onProgress: ((p: DuplicateGameProgress) => void) | undefined,
	total: number
) {
	let completed = 0;
	return (stage: string, detail: string) => {
		completed += 1;
		const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 100;
		onProgress?.({ stage, detail, completed, total, percent });
	};
}

/**
 * Deep-clones a custom game for the current user: DB rows, storage objects, and remapped `game_data` piece refs.
 */
export async function duplicateCustomGame(
	supabase: SupabaseClient<Database>,
	sourceGameId: string,
	options?: { onProgress?: (p: DuplicateGameProgress) => void }
): Promise<{ id: string }> {
	const { data: userData } = await supabase.auth.getUser();
	const uid = userData.user?.id;
	if (!uid) throw new Error('Not signed in');

	const copiedPaths: string[] = [];

	const { data: sourceGame, error: gErr } = await supabase
		.from('custom_board_games')
		.select('*')
		.eq('id', sourceGameId)
		.single();
	if (gErr || !sourceGame) throw gErr ?? new Error('Game not found');
	if (sourceGame.creator_id !== uid) throw new Error('Not allowed to duplicate this game');

	const { data: templates, error: tErr } = await supabase
		.from('card_templates')
		.select('*')
		.eq('game_id', sourceGameId);
	if (tErr) throw tErr;

	const { data: instances, error: iErr } = await supabase
		.from('card_instances')
		.select('*')
		.eq('game_id', sourceGameId);
	if (iErr) throw iErr;

	const { data: mediaRows, error: mErr } = await supabase
		.from('game_media')
		.select('*')
		.eq('game_id', sourceGameId);
	if (mErr) throw mErr;

	const placeholderGameData = parseGameDataJson(sourceGame.game_data);
	const emptyPieces: GameDataJson = {
		table: placeholderGameData.table,
		pieces: []
	};

	let newGameId: string | null = null;

	const nM = mediaRows?.length ?? 0;
	const nT = templates?.length ?? 0;
	const nI = instances?.length ?? 0;
	const nCover =
		sourceGame.cover_image_path && sourceGame.cover_image_path.includes(`/${sourceGameId}/`)
			? 1
			: 0;
	const nRules =
		sourceGame.rules_pdf_path && sourceGame.rules_pdf_path.includes(`/${sourceGameId}/`) ? 1 : 0;
	const totalTicks = 1 + nM + nT + nI + nCover + nRules + 1;
	const report = createProgressReporter(options?.onProgress, totalTicks);

	const prepParts: string[] = [];
	if (nM) prepParts.push(`${nM} media file${nM === 1 ? '' : 's'}`);
	if (nT) prepParts.push(`${nT} template${nT === 1 ? '' : 's'}`);
	if (nI) prepParts.push(`${nI} piece${nI === 1 ? '' : 's'}`);
	if (nCover || nRules) prepParts.push('cover/rules');
	options?.onProgress?.({
		stage: 'Preparing',
		detail: prepParts.length ? `Will copy ${prepParts.join(', ')}.` : 'Duplicating project…',
		completed: 0,
		total: totalTicks,
		percent: 0
	});

	try {
		const { data: insertedGame, error: insErr } = await supabase
			.from('custom_board_games')
			.insert({
				creator_id: uid,
				title: duplicateTitle(sourceGame.title),
				description: sourceGame.description ?? '',
				game_data: emptyPieces as unknown as Json,
				rules_pdf_path: null,
				cover_image_path: null
			})
			.select('id')
			.single();
		if (insErr || !insertedGame) throw insErr ?? new Error('Failed to create game');
		newGameId = insertedGame.id;

		const { error: refreshErr } = await supabase.auth.refreshSession();
		if (refreshErr) console.warn('[duplicateGame] refreshSession', refreshErr.message);

		report('Project', `Saved new project “${duplicateTitle(sourceGame.title)}”`);

		const mediaIdMap = new Map<string, string>();

		let mediaIdx = 0;
		for (const m of mediaRows ?? []) {
			const oldPath = m.file_path;
			const newPath = destPathForDuplicate(uid, sourceGameId, newGameId, oldPath);
			await storageDuplicateObject(supabase, oldPath, newPath, uid);
			copiedPaths.push(newPath);

			const { data: newMedia, error: insM } = await supabase
				.from('game_media')
				.insert({
					game_id: newGameId,
					creator_id: uid,
					file_path: newPath,
					filename: m.filename,
					source_type: m.source_type,
					ai_prompt: m.ai_prompt,
					width: m.width,
					height: m.height
				})
				.select('id')
				.single();
			if (insM || !newMedia) throw insM ?? new Error('Failed to insert game_media');
			mediaIdMap.set(m.id, newMedia.id);
			mediaIdx += 1;
			report(
				'Media library',
				`${m.filename} (${mediaIdx}/${nM || 1})`
			);
		}

		const templateIdMap = new Map<string, string>();

		let tmplIdx = 0;
		for (const t of templates ?? []) {
			const bg = remapUuidStringsInJson(t.background, mediaIdMap) as Json;
			const layers = remapUuidStringsInJson(t.layers, mediaIdMap) as Json;
			const backBg =
				t.back_background === null || t.back_background === undefined
					? null
					: (remapUuidStringsInJson(t.back_background, mediaIdMap) as Json);
			const backLayers =
				t.back_layers === null || t.back_layers === undefined
					? null
					: (remapUuidStringsInJson(t.back_layers, mediaIdMap) as Json);

			const { data: newT, error: insT } = await supabase
				.from('card_templates')
				.insert({
					game_id: newGameId,
					name: t.name,
					canvas_width: t.canvas_width,
					canvas_height: t.canvas_height,
					border_radius: t.border_radius,
					frame_border_width: t.frame_border_width,
					frame_border_color: t.frame_border_color,
					frame_inner_radius: t.frame_inner_radius,
					background: bg,
					layers,
					back_background: backBg,
					back_layers: backLayers
				})
				.select('id')
				.single();
			if (insT || !newT) throw insT ?? new Error('Failed to insert template');
			templateIdMap.set(t.id, newT.id);
			tmplIdx += 1;
			report('Piece templates', `${t.name} (${tmplIdx}/${nT || 1})`);
		}

		const instanceIdMap = new Map<string, string>();

		let pieceIdx = 0;
		for (const c of instances ?? []) {
			const newTemplateId = templateIdMap.get(c.template_id);
			if (!newTemplateId) throw new Error('Template mapping missing for card instance');

			const fieldValues = remapUuidStringsInJson(c.field_values, mediaIdMap) as Json;

			const { data: newC, error: insC } = await supabase
				.from('card_instances')
				.insert({
					template_id: newTemplateId,
					game_id: newGameId,
					name: c.name,
					field_values: fieldValues,
					rendered_image_path: null,
					render_stale: true
				})
				.select('id')
				.single();
			if (insC || !newC) throw insC ?? new Error('Failed to insert card instance');
			instanceIdMap.set(c.id, newC.id);

			let renderedPath: string | null = null;
			let renderStale = true;

			if (c.rendered_image_path) {
				const frontOld = c.rendered_image_path;
				const backOld = frontOld.replace(/\.png$/i, '-back.png');
				const newFront = `${uid}/${newGameId}/cards/${newC.id}.png`;
				const newBack = `${uid}/${newGameId}/cards/${newC.id}-back.png`;

				try {
					await storageDuplicateObject(supabase, frontOld, newFront, uid);
					copiedPaths.push(newFront);
					renderedPath = newFront;
					renderStale = false;
				} catch {
					renderedPath = null;
					renderStale = true;
				}

				if (renderedPath) {
					try {
						await storageDuplicateObject(supabase, backOld, newBack, uid);
						copiedPaths.push(newBack);
					} catch {
						/* optional back face */
					}
				}
			}

			const { error: upErr } = await supabase
				.from('card_instances')
				.update({
					rendered_image_path: renderedPath,
					render_stale: renderStale,
					updated_at: new Date().toISOString()
				})
				.eq('id', newC.id);
			if (upErr) throw upErr;
			pieceIdx += 1;
			const pieceLabel = c.name?.trim() || `Piece ${pieceIdx}`;
			report('Pieces & renders', `${pieceLabel} (${pieceIdx}/${nI || 1})`);
		}

		let newCover: string | null = null;
		let newRules: string | null = null;

		if (sourceGame.cover_image_path) {
			const op = sourceGame.cover_image_path;
			if (op.includes(`/${sourceGameId}/`)) {
				const np = destPathForDuplicate(uid, sourceGameId, newGameId, op);
				try {
					await storageDuplicateObject(supabase, op, np, uid);
					copiedPaths.push(np);
					newCover = np;
				} catch (e) {
					console.warn('[duplicateGame] cover copy', e);
				}
				report('Cover & rules', 'Thumbnail / cover image');
			}
		}

		if (sourceGame.rules_pdf_path) {
			const op = sourceGame.rules_pdf_path;
			if (op.includes(`/${sourceGameId}/`)) {
				const np = destPathForDuplicate(uid, sourceGameId, newGameId, op);
				try {
					await storageDuplicateObject(supabase, op, np, uid);
					copiedPaths.push(np);
					newRules = np;
				} catch (e) {
					console.warn('[duplicateGame] rules copy', e);
				}
				report('Cover & rules', 'Rules PDF');
			}
		}

		const baseGd = parseGameDataJson(sourceGame.game_data);
		const remappedGd = remapGameDataPieceRefs(baseGd, templateIdMap, instanceIdMap);

		const { error: upG } = await supabase
			.from('custom_board_games')
			.update({
				game_data: remappedGd as unknown as Json,
				cover_image_path: newCover,
				rules_pdf_path: newRules,
				updated_at: new Date().toISOString()
			})
			.eq('id', newGameId);
		if (upG) throw upG;

		report('Finishing', 'Board layout and metadata saved');

		return { id: newGameId };
	} catch (e) {
		if (newGameId) {
			await rollbackDbAndStorage(supabase, newGameId, copiedPaths);
		}
		throw e;
	}
}
