<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import { rasterizeCardInstanceToBlob } from '$lib/editor/bulkCardRasterize';
	import { zipPngFiles, downloadBlob } from '$lib/editor/printExport';
	import {
		layoutCardsToSheetPages,
		rasterBlobDimensions,
		type PageSizeId
	} from '$lib/editor/printSheet';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const supabase = createSupabaseBrowserClient();

	let busy = $state(false);
	let err = $state('');
	let sheetPageSize = $state<PageSizeId>('letter');
	let filterTemplateId = $state<string | 'all'>('all');
	let sortBy = $state<'template' | 'name' | 'updated'>('template');
	let newFromTemplateId = $state('');

	const mediaUrls = $derived(
		Object.fromEntries((data.mediaForCards ?? []).map((m) => [m.id, publicStorageUrl(m.file_path)]))
	);

	const staleCards = $derived(data.cards.filter((c) => c.render_stale));

	const filteredCards = $derived(
		filterTemplateId === 'all'
			? data.cards
			: data.cards.filter((c) => c.template_id === filterTemplateId)
	);

	const sortedCards = $derived.by(() => {
		const list = [...filteredCards];
		const tmplName = (tid: string) =>
			data.templates.find((t) => t.id === tid)?.name ?? '';
		if (sortBy === 'name') {
			list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
		} else if (sortBy === 'updated') {
			list.sort(
				(a, b) =>
					new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
			);
		} else {
			list.sort((a, b) => {
				const c = tmplName(a.template_id).localeCompare(tmplName(b.template_id), undefined, {
					sensitivity: 'base'
				});
				if (c !== 0) return c;
				return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
			});
		}
		return list;
	});

	const cardsByTemplate = $derived.by(() => {
		if (sortBy !== 'template') return null;
		const map = new Map<string, typeof data.cards>();
		for (const c of sortedCards) {
			const arr = map.get(c.template_id) ?? [];
			arr.push(c);
			map.set(c.template_id, arr);
		}
		return map;
	});

	const templatesForSections = $derived(
		filterTemplateId === 'all'
			? data.templates
			: data.templates.filter((t) => t.id === filterTemplateId)
	);

	async function rerenderAllStale() {
		const uid = data.session?.user?.id;
		if (!uid) return;
		if (!staleCards.length) return;
		if (!confirm(`Re-render ${staleCards.length} stale piece(s)? This may take a minute.`)) return;
		busy = true;
		err = '';
		try {
			for (const c of staleCards) {
				const tmpl = data.templates.find((t) => t.id === c.template_id);
				if (!tmpl) continue;
				const blob = await rasterizeCardInstanceToBlob(
					{
						canvas_width: tmpl.canvas_width,
						canvas_height: tmpl.canvas_height,
						border_radius: tmpl.border_radius,
						frame_border_width: tmpl.frame_border_width,
						frame_border_color: tmpl.frame_border_color,
						background: tmpl.background,
						layers: tmpl.layers
					},
					c.field_values,
					mediaUrls
				);
				const path = `${uid}/${data.game.id}/cards/${c.id}.png`;
				const { error: upErr } = await supabase.storage.from('custom-game-assets').upload(path, blob, {
					upsert: true,
					contentType: 'image/png'
				});
				if (upErr) throw upErr;
				const { error: uErr } = await supabase
					.from('card_instances')
					.update({
						rendered_image_path: path,
						render_stale: false,
						updated_at: new Date().toISOString()
					})
					.eq('id', c.id);
				if (uErr) throw uErr;
			}
			await invalidateAll();
		} catch (e) {
			err = e instanceof Error ? e.message : 'Bulk render failed';
		}
		busy = false;
	}

	async function exportTemplateZip(templateId: string) {
		const tmpl = data.templates.find((t) => t.id === templateId);
		if (!tmpl) return;
		const cardsForT = data.cards.filter((c) => c.template_id === templateId);
		if (!cardsForT.length) {
			alert('No cards in this template.');
			return;
		}
		busy = true;
		err = '';
		try {
			const files: { path: string; blob: Blob }[] = [];
			const sheetInput: { blob: Blob; widthPx: number; heightPx: number }[] = [];
			for (const c of cardsForT) {
				const blob = await rasterizeCardInstanceToBlob(
					{
						canvas_width: tmpl.canvas_width,
						canvas_height: tmpl.canvas_height,
						border_radius: tmpl.border_radius,
						frame_border_width: tmpl.frame_border_width,
						frame_border_color: tmpl.frame_border_color,
						background: tmpl.background,
						layers: tmpl.layers
					},
					c.field_values,
					mediaUrls,
					{ scale: 2 }
				);
				const safe =
					((c.name || `card-${c.id}`).replace(/[^\w\-.]+/g, '_') || 'card').slice(0, 80) + '.png';
				files.push({ path: `cards/${safe}`, blob });
				const dim = await rasterBlobDimensions(blob);
				sheetInput.push({ blob, widthPx: dim.w, heightPx: dim.h });
			}
			const sheetBlobs = await layoutCardsToSheetPages(sheetInput, sheetPageSize);
			sheetBlobs.forEach((b, i) => {
				files.push({
					path: `sheets/page-${String(i + 1).padStart(2, '0')}.png`,
					blob: b
				});
			});
			const zipBlob = await zipPngFiles(files);
			downloadBlob(
				zipBlob,
				`${(tmpl.name || 'cards').replace(/\s+/g, '-')}-print-300dpi.zip`
			);
		} catch (e) {
			err = e instanceof Error ? e.message : 'ZIP export failed';
		}
		busy = false;
	}

	async function createCard(templateId: string) {
		busy = true;
		try {
			const { data: row, error } = await supabase
				.from('card_instances')
				.insert({
					game_id: data.game.id,
					template_id: templateId,
					name: 'New piece',
					field_values: {},
					render_stale: true
				})
				.select('id')
				.single();
			if (error) throw error;
			await goto(`/editor/${data.game.id}/pieces/${row.id}`);
		} catch (e) {
			console.error(e);
		}
		busy = false;
	}

	function thumb(path: string | null) {
		if (!path) return '';
		return publicStorageUrl(path);
	}
</script>

<div class="page editor-page-scroll">
	<h1>Pieces</h1>

	<div class="list-controls">
		<label>
			Template
			<select bind:value={filterTemplateId}>
				<option value="all">All templates</option>
				{#each data.templates as t (t.id)}
					<option value={t.id}>{t.name}</option>
				{/each}
			</select>
		</label>
		<label>
			Sort
			<select bind:value={sortBy}>
				<option value="template">Template A–Z, then name</option>
				<option value="name">Name (A–Z)</option>
				<option value="updated">Recently updated</option>
			</select>
		</label>
	</div>

	<label class="sheet-opt">
		Print sheet page size (ZIP)
		<select bind:value={sheetPageSize}>
			<option value="letter">US Letter (8.5×11")</option>
			<option value="a4">A4</option>
		</select>
	</label>

	{#if err}
		<p class="err">{err}</p>
	{/if}

	{#if staleCards.length}
		<div class="stale-banner">
			<span>{staleCards.length} piece(s) need re-render after a template change.</span>
			<button type="button" class="btn primary" disabled={busy} onclick={() => void rerenderAllStale()}>
				{busy ? 'Working…' : `Re-render all stale (${staleCards.length})`}
			</button>
		</div>
	{/if}

	{#if sortBy === 'template'}
		{#each templatesForSections as t (t.id)}
			<section class="sec">
				<h2>{t.name}</h2>
				<div class="row-btns">
					<button type="button" class="btn" disabled={busy} onclick={() => createCard(t.id)}>
						New piece from this template
					</button>
					<button
						type="button"
						class="btn"
						disabled={busy}
						onclick={() => void exportTemplateZip(t.id)}
					>
						Export ZIP (300 DPI)
					</button>
				</div>
				<ul>
					{#each cardsByTemplate?.get(t.id) ?? [] as card (card.id)}
						<li>
							{#if card.rendered_image_path}
								<img src={thumb(card.rendered_image_path)} alt="" class="thumb" />
							{:else}
								<div class="ph">No render</div>
							{/if}
							<div class="row-actions">
								<a href="/editor/{data.game.id}/pieces/{card.id}" title="Edit piece">{card.name}</a>
								<a class="row-sublink" href="/editor/{data.game.id}/templates/{t.id}">Open template</a>
							</div>
							{#if card.render_stale}<span class="stale">Stale</span>{/if}
						</li>
					{:else}
						<li class="muted">No pieces yet for this template.</li>
					{/each}
				</ul>
			</section>
		{:else}
			<p class="muted">Create a template first.</p>
		{/each}
	{:else}
		<section class="sec flat-sec">
			<div class="row-btns inline-create">
				<label>
					New piece from template
					<select bind:value={newFromTemplateId}>
						<option value="">— choose —</option>
						{#each data.templates as t (t.id)}
							<option value={t.id}>{t.name}</option>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="btn primary"
					disabled={busy || !newFromTemplateId}
					onclick={() => {
						if (newFromTemplateId) void createCard(newFromTemplateId);
					}}
				>
					Create
				</button>
			</div>
			<ul>
				{#each sortedCards as card (card.id)}
					{@const tmpl = data.templates.find((x) => x.id === card.template_id)}
					<li>
						{#if card.rendered_image_path}
							<img src={thumb(card.rendered_image_path)} alt="" class="thumb" />
						{:else}
							<div class="ph">No render</div>
						{/if}
						<div class="card-meta">
							<a href="/editor/{data.game.id}/pieces/{card.id}" title="Edit piece">{card.name}</a>
							<span class="tmpl-tag">{tmpl?.name ?? '—'}</span>
							{#if tmpl}
								<a class="row-sublink" href="/editor/{data.game.id}/templates/{tmpl.id}">Open template</a>
							{/if}
						</div>
						{#if card.render_stale}<span class="stale">Stale</span>{/if}
					</li>
				{:else}
					<li class="muted">No pieces match this filter.</li>
				{/each}
			</ul>
		</section>
	{/if}

</div>

<style>
	.page {
		padding: 1.25rem 1.5rem;
		max-width: 720px;
		color: var(--color-text);
	}
	h1 {
		margin-top: 0;
	}
	.list-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 24px;
		align-items: flex-end;
		margin-bottom: 1.25rem;
		font-size: 14px;
		color: var(--color-text-muted);
	}
	.list-controls label {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.list-controls select {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		min-width: 200px;
	}
	.inline-create label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		color: var(--color-text-muted);
	}
	.inline-create select {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		min-width: 220px;
	}
	.row-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		min-width: 0;
	}
	.row-sublink {
		font-size: 12px;
		color: var(--color-accent, #3b82f6);
		text-decoration: none;
	}
	.row-sublink:hover {
		text-decoration: underline;
	}
	.card-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.tmpl-tag {
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.sec {
		margin-bottom: 2rem;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 1rem;
	}
	h2 {
		font-size: 1rem;
		margin: 0 0 8px;
	}
	.btn {
		padding: 6px 12px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
		margin-bottom: 8px;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--color-border);
	}
	.thumb {
		width: 48px;
		height: 64px;
		object-fit: cover;
		border-radius: 4px;
		background: #222;
	}
	.ph {
		width: 48px;
		height: 64px;
		background: #222;
		border-radius: 4px;
		font-size: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #888;
	}
	a {
		color: var(--color-accent, #3b82f6);
	}
	.stale {
		font-size: 12px;
		color: #fbbf24;
	}
	.muted {
		opacity: 0.7;
	}
	.err {
		color: #f87171;
		margin-bottom: 1rem;
	}
	.stale-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 8px;
		background: rgba(251, 191, 36, 0.12);
		border: 1px solid rgba(251, 191, 36, 0.4);
		margin-bottom: 1.25rem;
		font-size: 14px;
	}
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
	}
	.row-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 8px;
	}
	.sheet-opt {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		margin-bottom: 1rem;
		color: var(--color-text-muted);
	}
	.sheet-opt select {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
</style>
