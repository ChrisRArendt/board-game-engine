<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import { customRulesPublicUrl } from '$lib/customGames';
	import GameMediaImageTools from '$lib/components/editor/GameMediaImageTools.svelte';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import type { PageData } from './$types';
	import type { GameDataJson } from '$lib/engine/types';

	export let data: PageData;

	const supabase = createSupabaseBrowserClient();

	type MediaRow = { id: string; file_path: string };

	function readGameData(): GameDataJson {
		const g = data.game.game_data;
		if (g && typeof g === 'object' && g !== null && 'table' in g) return g as unknown as GameDataJson;
		return { table: { size: { w: 3000, h: 3000 } }, pieces: [] };
	}

	function mediaUrlMap(rows: MediaRow[]): Record<string, string> {
		return Object.fromEntries(rows.map((r) => [r.id, publicStorageUrl(r.file_path)]));
	}

	function resolveCoverMediaId(coverPath: string | null | undefined, rows: MediaRow[]): string | null {
		if (!coverPath) return null;
		return rows.find((r) => r.file_path === coverPath)?.id ?? null;
	}

	let title = data.game.title;
	let description = data.game.description;
	let rulesFile: File | null = null;
	let saving = false;
	let msg = '';
	let err = '';

	let mediaUrls: Record<string, string> = {};
	let coverMediaId: string | null = null;

	function initCoverState() {
		const rows = data.gameMediaList ?? [];
		mediaUrls = mediaUrlMap(rows);
		coverMediaId = resolveCoverMediaId(data.game.cover_image_path, rows);
	}

	initCoverState();

	$: data.game.id, data.game.updated_at, initCoverState();

	function mergeMediaUrls(patch: Record<string, string>) {
		mediaUrls = { ...mediaUrls, ...patch };
	}

	async function onCoverMediaChange(id: string | null) {
		coverMediaId = id;
	}

	$: rulesUrl =
		data.game.rules_pdf_path != null
			? customRulesPublicUrl(PUBLIC_SUPABASE_URL, data.game.rules_pdf_path)
			: null;

	$: coverFallbackThumb =
		data.game.cover_image_path && !resolveCoverMediaId(data.game.cover_image_path, data.gameMediaList ?? [])
			? publicStorageUrl(data.game.cover_image_path)
			: null;

	async function save() {
		saving = true;
		msg = '';
		err = '';
		try {
			let rulesPath: string | null = data.game.rules_pdf_path;
			if (rulesFile && data.session?.user) {
				const path = `${data.session.user.id}/${data.game.id}/rules.pdf`;
				const up = await supabase.storage.from('custom-game-assets').upload(path, rulesFile, {
					upsert: true,
					contentType: 'application/pdf'
				});
				if (up.error) throw up.error;
				rulesPath = path;
			}

			let coverPath: string | null = null;
			if (coverMediaId) {
				const { data: mrow, error: mErr } = await supabase
					.from('game_media')
					.select('file_path')
					.eq('id', coverMediaId)
					.maybeSingle();
				if (mErr) throw mErr;
				coverPath = mrow?.file_path ?? null;
			}

			const gd = readGameData();
			const game_data: GameDataJson = { ...gd };
			const { error } = await supabase
				.from('custom_board_games')
				.update({
					title: title.trim() || 'Untitled',
					description: description.trim(),
					rules_pdf_path: rulesPath,
					cover_image_path: coverPath,
					game_data: game_data as never,
					updated_at: new Date().toISOString()
				})
				.eq('id', data.game.id);
			if (error) throw error;
			msg = 'Saved.';
			rulesFile = null;
			await invalidateAll();
		} catch (e) {
			err = e instanceof Error ? e.message : 'Error';
		}
		saving = false;
	}
</script>

<div class="page editor-page-scroll">
	<h1>{data.game.title}</h1>
	<p class="meta">Key: <code>{data.game.game_key}</code></p>
	<p class="hint">Edit the title, description, thumbnail, and rules PDF for this game.</p>

	{#if msg}
		<p class="ok">{msg}</p>
	{/if}
	{#if err}
		<p class="err">{err}</p>
	{/if}

	<label class="field">
		<span>Title</span>
		<input type="text" bind:value={title} />
	</label>
	<label class="field">
		<span>Description</span>
		<textarea bind:value={description} rows="3"></textarea>
	</label>

	<div class="field cover-field">
		<span>Thumbnail</span>
		<div class="cover-tools">
			<GameMediaImageTools
				gameId={data.game.id}
				mediaId={coverMediaId}
				{mediaUrls}
				onMediaIdChange={onCoverMediaChange}
				onMergeUrls={mergeMediaUrls}
				fallbackThumbUrl={coverFallbackThumb}
			/>
		</div>
	</div>

	<label class="field">
		<span>Rules PDF</span>
		<input
			type="file"
			accept="application/pdf,.pdf"
			onchange={(e) => {
				rulesFile = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
			}}
		/>
		{#if rulesUrl}
			<a href={rulesUrl} target="_blank" rel="noreferrer">Current rules</a>
		{/if}
	</label>

	<button type="button" class="btn primary" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
</div>

<style>
	.page {
		max-width: 560px;
		padding: 1.25rem 1.5rem;
		color: var(--color-text);
	}
	h1 {
		margin-top: 0;
	}
	.meta {
		font-size: 13px;
		color: var(--color-text-muted);
	}
	.meta code {
		font-size: 12px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 1rem;
	}
	.field input,
	.field textarea {
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.hint {
		margin: 0 0 8px;
		font-size: 12px;
		line-height: 1.45;
		color: var(--color-text-muted);
	}
	.cover-field {
		margin-bottom: 1.25rem;
	}
	.cover-tools :global(.thumb-label) {
		width: 160px;
		height: 100px;
	}
	.cover-tools :global(.thumb) {
		width: 160px;
		height: 100px;
		object-fit: cover;
	}
	.cover-tools :global(.thumb.ph) {
		width: 160px;
		height: 100px;
	}
	.btn {
		padding: 8px 16px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		cursor: pointer;
	}
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
	}
	.ok {
		color: #86efac;
	}
	.err {
		color: #f87171;
	}
</style>
