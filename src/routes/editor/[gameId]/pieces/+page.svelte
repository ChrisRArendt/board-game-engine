<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import {
		rasterizeCardFrontAndBackSprite,
		rasterizeCardInstanceToBlob,
		templateRowHasBack,
		type TemplateRow
	} from '$lib/editor/bulkCardRasterize';
	import { zipPngFiles, downloadBlob } from '$lib/editor/printExport';
	import { generateDuplexPrintPdf, downloadPdf } from '$lib/editor/pdfExport';
	import {
		layoutCardsToSheetPages,
		layoutDuplexCardSheets,
		rasterBlobDimensions,
		type DuplexCardForSheet,
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

	let printPdfOpen = $state(false);
	let printPdfBusy = $state(false);
	let printPdfPageSize = $state<PageSizeId>('letter');
	let printPdfSelected = $state<Record<string, boolean>>({});
	let printPdfQty = $state<Record<string, number>>({});

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

	function templateRowFromDb(tmpl: PageData['templates'][number]): TemplateRow {
		return {
			canvas_width: tmpl.canvas_width,
			canvas_height: tmpl.canvas_height,
			border_radius: tmpl.border_radius,
			frame_border_width: tmpl.frame_border_width,
			frame_border_color: tmpl.frame_border_color,
			frame_inner_radius: tmpl.frame_inner_radius ?? null,
			background: tmpl.background,
			layers: tmpl.layers,
			back_background: tmpl.back_background,
			back_layers: tmpl.back_layers
		};
	}

	function openPrintPdfDialog() {
		const sel: Record<string, boolean> = {};
		const qty: Record<string, number> = {};
		for (const c of sortedCards) {
			sel[c.id] = true;
			qty[c.id] = 1;
		}
		printPdfSelected = sel;
		printPdfQty = qty;
		printPdfPageSize = sheetPageSize;
		printPdfOpen = true;
	}

	function togglePrintPdfSelectAll(on: boolean) {
		const next = { ...printPdfSelected };
		for (const c of sortedCards) {
			next[c.id] = on;
		}
		printPdfSelected = next;
	}

	async function generatePrintPdf() {
		if (printPdfBusy) return;
		const uid = data.session?.user?.id;
		if (!uid) {
			err = 'You must be signed in.';
			return;
		}
		printPdfBusy = true;
		err = '';
		try {
			const duplex: DuplexCardForSheet[] = [];
			for (const c of data.cards) {
				if (!printPdfSelected[c.id]) continue;
				const q = Math.max(1, Math.floor(printPdfQty[c.id] ?? 1));
				const tmpl = data.templates.find((t) => t.id === c.template_id);
				if (!tmpl) continue;
				const row = templateRowFromDb(tmpl);
				const hasBack = templateRowHasBack(row);
				const front = await rasterizeCardInstanceToBlob(row, c.field_values, mediaUrls, {
					scale: 2,
					face: 'front'
				});
				const back = hasBack
					? await rasterizeCardInstanceToBlob(row, c.field_values, mediaUrls, {
							scale: 2,
							face: 'back'
						})
					: null;
				const dim = await rasterBlobDimensions(front);
				for (let i = 0; i < q; i++) {
					duplex.push({
						frontBlob: front,
						backBlob: back,
						widthPx: dim.w,
						heightPx: dim.h
					});
				}
			}
			if (!duplex.length) {
				err = 'Select at least one piece with quantity ≥ 1.';
				return;
			}
			const bytes = await generateDuplexPrintPdf(duplex, printPdfPageSize);
			const safe =
				(String(data.game.title || 'game').replace(/[^\w\-.]+/g, '_') || 'print') + '-duplex.pdf';
			downloadPdf(bytes, safe);
			printPdfOpen = false;
		} catch (e) {
			err = e instanceof Error ? e.message : 'PDF export failed';
		} finally {
			printPdfBusy = false;
		}
	}

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
				const row = templateRowFromDb(tmpl);
				const blob = templateRowHasBack(row)
					? (await rasterizeCardFrontAndBackSprite(row, c.field_values, mediaUrls, { scale: 2 }))
							.blob
					: await rasterizeCardInstanceToBlob(row, c.field_values, mediaUrls, { scale: 2 });
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
			const row = templateRowFromDb(tmpl);
			const duplexSheets = templateRowHasBack(row);
			const sheetInput: { blob: Blob; widthPx: number; heightPx: number }[] = [];
			const sheetDuplex: DuplexCardForSheet[] = [];
			for (const c of cardsForT) {
				const front = await rasterizeCardInstanceToBlob(row, c.field_values, mediaUrls, {
					scale: 2,
					face: 'front'
				});
				const safe =
					((c.name || `card-${c.id}`).replace(/[^\w\-.]+/g, '_') || 'card').slice(0, 80) + '.png';
				files.push({ path: `cards/${safe}`, blob: front });
				const dim = await rasterBlobDimensions(front);
				if (duplexSheets) {
					const back = await rasterizeCardInstanceToBlob(row, c.field_values, mediaUrls, {
						scale: 2,
						face: 'back'
					});
					sheetDuplex.push({
						frontBlob: front,
						backBlob: back,
						widthPx: dim.w,
						heightPx: dim.h
					});
				} else {
					sheetInput.push({ blob: front, widthPx: dim.w, heightPx: dim.h });
				}
			}
			if (duplexSheets) {
				const pairs = await layoutDuplexCardSheets(sheetDuplex, sheetPageSize);
				pairs.forEach((p, i) => {
					const n = String(i + 1).padStart(2, '0');
					files.push({ path: `sheets/page-${n}-front.png`, blob: p.front });
					files.push({ path: `sheets/page-${n}-back.png`, blob: p.back });
				});
			} else {
				const sheetBlobs = await layoutCardsToSheetPages(sheetInput, sheetPageSize);
				sheetBlobs.forEach((b, i) => {
					files.push({
						path: `sheets/page-${String(i + 1).padStart(2, '0')}.png`,
						blob: b
					});
				});
			}
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

	<div class="print-pdf-actions">
		<button
			type="button"
			class="btn primary"
			disabled={busy || !data.cards.length}
			onclick={openPrintPdfDialog}
		>
			Print PDF (duplex)
		</button>
	</div>

	{#if printPdfOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="modal-backdrop"
			onclick={() => (printPdfOpen = false)}
			role="presentation"
		>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="modal print-pdf-dialog"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="print-pdf-title"
				tabindex="-1"
			>
				<h2 id="print-pdf-title">Print-ready PDF</h2>
				<p class="print-pdf-hint">
					Duplex: print all pages with <strong>flip on long edge</strong>. Or print odd pages first,
					flip the stack, then even pages. Pages are interleaved: sheet 1 fronts, sheet 1 backs, …
				</p>
				<label class="modal-field">
					Page size
					<select bind:value={printPdfPageSize} disabled={printPdfBusy}>
						<option value="letter">US Letter (8.5×11")</option>
						<option value="a4">A4</option>
					</select>
				</label>
				<div class="select-all-row">
					<label>
						<input
							type="checkbox"
							checked={sortedCards.length > 0 &&
								sortedCards.every((c) => printPdfSelected[c.id])}
							onchange={(e) =>
								togglePrintPdfSelectAll((e.currentTarget as HTMLInputElement).checked)}
							disabled={printPdfBusy || !sortedCards.length}
						/>
						Select all (current list)
					</label>
				</div>
				<div class="print-pdf-table-wrap">
					<table class="print-pdf-table">
						<thead>
							<tr>
								<th class="col-check"></th>
								<th>Name</th>
								<th>Template</th>
								<th class="col-qty">Qty</th>
							</tr>
						</thead>
						<tbody>
							{#each sortedCards as c (c.id)}
								{@const tmpl = data.templates.find((t) => t.id === c.template_id)}
								<tr>
									<td>
										<input
											type="checkbox"
											checked={printPdfSelected[c.id] ?? false}
											disabled={printPdfBusy}
											onchange={(e) => {
												printPdfSelected = {
													...printPdfSelected,
													[c.id]: (e.currentTarget as HTMLInputElement).checked
												};
											}}
										/>
									</td>
									<td>{c.name}</td>
									<td class="tm">{tmpl?.name ?? '—'}</td>
									<td>
										<input
											class="qty-input"
											type="number"
											min="1"
											max="999"
											value={printPdfQty[c.id] ?? 1}
											disabled={printPdfBusy}
											oninput={(e) => {
												const raw = (e.currentTarget as HTMLInputElement).value;
												const n = parseInt(raw, 10);
												printPdfQty = {
													...printPdfQty,
													[c.id]: Number.isFinite(n) && n >= 1 ? n : 1
												};
											}}
										/>
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="4" class="muted">No pieces match the current filter.</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="modal-actions">
					<button
						type="button"
						class="btn"
						disabled={printPdfBusy}
						onclick={() => (printPdfOpen = false)}
					>
						Cancel
					</button>
					<button
						type="button"
						class="btn primary"
						disabled={printPdfBusy}
						onclick={() => void generatePrintPdf()}
					>
						{printPdfBusy ? 'Rasterizing…' : 'Download PDF'}
					</button>
				</div>
			</div>
		</div>
	{/if}

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
	.print-pdf-actions {
		margin-bottom: 1rem;
	}
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.modal {
		background: var(--color-surface);
		color: var(--color-text);
		border-radius: 10px;
		border: 1px solid var(--color-border);
		padding: 1.25rem 1.5rem;
		max-width: 560px;
		width: 100%;
		max-height: min(90vh, 720px);
		overflow: auto;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
	}
	.print-pdf-dialog h2 {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
	}
	.print-pdf-hint {
		font-size: 13px;
		color: var(--color-text-muted);
		margin: 0 0 1rem;
		line-height: 1.45;
	}
	.modal-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		margin-bottom: 8px;
	}
	.modal-field select {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
		max-width: 260px;
	}
	.select-all-row {
		margin-bottom: 10px;
		font-size: 14px;
	}
	.print-pdf-table-wrap {
		overflow-x: auto;
		margin-bottom: 1rem;
		border: 1px solid var(--color-border);
		border-radius: 8px;
	}
	.print-pdf-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.print-pdf-table th,
	.print-pdf-table td {
		padding: 8px 10px;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}
	.print-pdf-table th {
		background: var(--color-bg);
		font-weight: 600;
	}
	.col-check {
		width: 36px;
	}
	.col-qty {
		width: 72px;
	}
	.qty-input {
		width: 4rem;
		padding: 4px 6px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
	}
	.print-pdf-table .tm {
		color: var(--color-text-muted);
		font-size: 12px;
	}
	.modal-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
