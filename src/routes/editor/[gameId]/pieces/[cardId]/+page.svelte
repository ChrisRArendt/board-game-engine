<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import CardPreview from '$lib/components/editor/CardPreview.svelte';
	import AIGenerateModal from '$lib/components/editor/AIGenerateModal.svelte';
	import ColorPicker from '$lib/components/editor/ColorPicker.svelte';
	import {
		buildCardFieldValuesPayload,
		collectFieldBindings,
		type PieceFieldStyle,
		mergeFieldValuesForBindings,
		splitFieldValuesPayload
	} from '$lib/editor/fieldBindings';
	import { parseBackground, parseLayers, type TextLayer } from '$lib/editor/types';
	import { rasterizeElementToPng } from '$lib/editor/rasterize';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import { downloadBlob } from '$lib/editor/printExport';
	import MediaPickerModal from '$lib/components/editor/MediaPickerModal.svelte';
	import type { Json } from '$lib/supabase/database.types';
	import type { PageData } from './$types';
	import { browser } from '$app/environment';

	let { data }: { data: PageData } = $props();

	const supabase = createSupabaseBrowserClient();

	const parsedLayers = $derived(parseLayers(data.template.layers as Json));
	const bindings = $derived(collectFieldBindings(parsedLayers));

	function mergeForCard(): Record<string, string> {
		const pl = parseLayers(data.template.layers as Json);
		const b = collectFieldBindings(pl);
		return mergeFieldValuesForBindings(splitFieldValuesPayload(data.card.field_values).values, b, pl);
	}

	function mergePieceStyles(): Record<string, PieceFieldStyle> {
		const pl = parseLayers(data.template.layers as Json);
		const bs = collectFieldBindings(pl);
		const { styles } = splitFieldValuesPayload(data.card.field_values);
		const out: Record<string, PieceFieldStyle> = {};
		for (const b of bs) {
			const s = styles[b.fieldName];
			out[b.fieldName] = {
				textColor: s?.textColor ?? '',
				backgroundColor: s?.backgroundColor ?? ''
			};
		}
		return out;
	}

	function templateTextColor(fieldName: string): string {
		for (const L of parseLayers(data.template.layers as Json)) {
			if (L.type === 'text' && L.fieldBinding?.fieldName === fieldName) {
				return (L as TextLayer).color;
			}
		}
		return '#e2e8f0';
	}

	/** Template layer is image + this field — even if fieldType was left as "text" when adding Per-piece field. */
	function bindingIsImageLayer(fieldName: string): boolean {
		for (const L of parseLayers(data.template.layers as Json)) {
			if (L.type === 'image' && L.fieldBinding?.fieldName === fieldName) return true;
		}
		return false;
	}

	function isImageField(b: { fieldName: string; fieldType: string }): boolean {
		return b.fieldType === 'image' || bindingIsImageLayer(b.fieldName);
	}

	function showsTextColor(b: { fieldType: string; fieldName: string }): boolean {
		if (bindingIsImageLayer(b.fieldName)) return false;
		return b.fieldType === 'text' || b.fieldType === 'textarea' || b.fieldType === 'number' || b.fieldType === 'color';
	}

	function showsLayerBackground(b: { fieldType: string; fieldName: string }): boolean {
		if (bindingIsImageLayer(b.fieldName)) return true;
		return (
			b.fieldType === 'text' ||
			b.fieldType === 'textarea' ||
			b.fieldType === 'number' ||
			b.fieldType === 'color' ||
			b.fieldType === 'image'
		);
	}

	let name = $state(data.card.name);
	let fieldValues = $state<Record<string, string>>(mergeForCard());
	let pieceStyles = $state<Record<string, PieceFieldStyle>>(mergePieceStyles());

	let lastCardId = $state(data.card.id);
	$effect(() => {
		const id = data.card.id;
		if (lastCardId === id) return;
		lastCardId = id;
		name = data.card.name;
		fieldValues = mergeForCard();
		pieceStyles = mergePieceStyles();
	});

	let previewEl: HTMLDivElement | undefined;
	let saving = $state(false);
	let aiOpen = $state(false);
	let aiFieldKey = $state<string | null>(null);
	let pickerOpen = $state(false);
	let pickerFieldKey = $state<string | null>(null);
	let err = $state('');

	let mediaUrls = $state<Record<string, string>>({});

	async function loadMedia() {
		const gid = data.game.id;
		const { data: rows, error: mediaErr } = await supabase
			.from('game_media')
			.select('id, file_path')
			.eq('game_id', gid);
		const m: Record<string, string> = {};
		for (const r of rows ?? []) {
			m[r.id] = publicStorageUrl(r.file_path);
		}
		mediaUrls = m;
		// #region agent log
		if (browser) {
			const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			const missingFromMap: string[] = [];
			for (const [k, v] of Object.entries(fieldValues)) {
				const vid = String(v).trim();
				if (vid && uuidRe.test(vid) && m[vid] === undefined) missingFromMap.push(k);
			}
			fetch('http://localhost:7278/ingest/b8376de9-9c29-4e05-bd62-1d6be57bcdc1', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a428b6' },
				body: JSON.stringify({
					sessionId: 'a428b6',
					location: 'pieces/+page:loadMedia',
					message: 'game_media loaded',
					data: {
						gameId: gid,
						rowCount: rows?.length ?? 0,
						mapSize: Object.keys(m).length,
						mediaErr: mediaErr?.message ?? null,
						missingFromMap,
						fieldKeys: Object.keys(fieldValues)
					},
					timestamp: Date.now(),
					hypothesisId: 'D'
				})
			}).catch(() => {});
		}
		// #endregion
	}

	$effect(() => {
		if (browser) void loadMedia();
	});

	function bindingInputType(t: string): 'text' | 'number' | 'color' {
		if (t === 'number') return 'number';
		if (t === 'color') return 'color';
		return 'text';
	}

	async function save() {
		saving = true;
		err = '';
		try {
			const pl = parseLayers(data.template.layers as Json);
			const bindings = collectFieldBindings(pl);
			const fvJson = buildCardFieldValuesPayload(fieldValues, pieceStyles, bindings);
			const { error } = await supabase
				.from('card_instances')
				.update({
					name: name.trim() || 'Piece',
					field_values: fvJson,
					render_stale: true,
					updated_at: new Date().toISOString()
				})
				.eq('id', data.card.id);
			if (error) throw error;
			await invalidateAll();
		} catch (e) {
			err = e instanceof Error ? e.message : 'Save failed';
		}
		saving = false;
	}

	async function renderPng() {
		if (!previewEl || !data.session?.user) return;
		saving = true;
		err = '';
		try {
			const blob = await rasterizeElementToPng(previewEl, { scale: 2, backgroundColor: '#ffffff' });
			const path = `${data.session.user.id}/${data.game.id}/cards/${data.card.id}.png`;
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
				.eq('id', data.card.id);
			if (uErr) throw uErr;
			await invalidateAll();
		} catch (e) {
			err = e instanceof Error ? e.message : 'Render failed';
		}
		saving = false;
	}

	async function renderPrintPng() {
		if (!previewEl) return;
		saving = true;
		err = '';
		try {
			/** 150 DPI design → 300 DPI: 2× supersampling on design-sized DOM */
			const blob = await rasterizeElementToPng(previewEl, { scale: 2, backgroundColor: '#ffffff' });
			downloadBlob(blob, `${(name || 'piece').replace(/\s+/g, '-')}-print-300dpi.png`);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Export failed';
		}
		saving = false;
	}
</script>

<div class="page">
	<nav class="breadcrumb" aria-label="Breadcrumb">
		<a href="/editor/{data.game.id}">Editor</a>
		<span class="sep">→</span>
		<a href="/editor/{data.game.id}/pieces">Pieces</a>
		<span class="sep">→</span>
		<span class="current">{name || 'Untitled'}</span>
	</nav>

	<header class="head">
		<h1>Edit piece</h1>
		<p class="meta">
			From template: {data.template.name}
			{#if data.card.render_stale}
				<span class="stale-tag" role="status">Stale</span>
			{/if}
		</p>
	</header>

	<div class="grid">
		<div class="form-col">
			<label class="field">
				<span>Name</span>
				<input type="text" bind:value={name} />
			</label>

			{#each bindings as b}
				<section class="field-bucket" aria-labelledby="field-{b.fieldName}">
					<h3 class="field-bucket-title" id="field-{b.fieldName}">{b.fieldLabel}</h3>
					<div class="field-bucket-main">
						{#if isImageField(b)}
							<div class="img-row">
								{#if fieldValues[b.fieldName] && mediaUrls[fieldValues[b.fieldName]]}
									<img
										class="thumb"
										src={mediaUrls[fieldValues[b.fieldName]]}
										alt=""
									/>
								{:else}
									<div class="thumb ph">No image</div>
								{/if}
								<div class="img-actions">
									<button
										type="button"
										class="btn small"
										onclick={() => {
											pickerFieldKey = b.fieldName;
											pickerOpen = true;
										}}>Choose from library</button
									>
									<button
										type="button"
										class="btn small"
										onclick={() => {
											aiFieldKey = b.fieldName;
											aiOpen = true;
										}}>Generate with AI</button
									>
								</div>
							</div>
						{:else if b.fieldType === 'textarea'}
							<textarea
								class="piece-field-textarea"
								value={fieldValues[b.fieldName]}
								rows="5"
								spellcheck="true"
								oninput={(e) => {
									fieldValues = {
										...fieldValues,
										[b.fieldName]: (e.currentTarget as HTMLTextAreaElement).value
									};
								}}
							></textarea>
						{:else}
							<input
								type={bindingInputType(b.fieldType)}
								value={fieldValues[b.fieldName]}
								oninput={(e) => {
									fieldValues = {
										...fieldValues,
										[b.fieldName]: (e.currentTarget as HTMLInputElement).value
									};
								}}
							/>
						{/if}
					</div>
					{#if showsTextColor(b)}
						<div class="style-row">
							<span class="style-label">Text color</span>
							<ColorPicker
								value={pieceStyles[b.fieldName]?.textColor?.trim()
									? pieceStyles[b.fieldName].textColor
									: templateTextColor(b.fieldName)}
								onValueChange={(v) => {
									pieceStyles = {
										...pieceStyles,
										[b.fieldName]: { ...pieceStyles[b.fieldName], textColor: v }
									};
								}}
							/>
							<button
								type="button"
								class="btn tiny"
								onclick={() => {
									pieceStyles = {
										...pieceStyles,
										[b.fieldName]: { ...pieceStyles[b.fieldName], textColor: '' }
									};
								}}>Use template</button
							>
						</div>
					{/if}
					{#if showsLayerBackground(b)}
						<div class="style-row">
							<span class="style-label">Layer background</span>
							<ColorPicker
								value={pieceStyles[b.fieldName]?.backgroundColor?.trim() || '#ffffff'}
								onValueChange={(v) => {
									pieceStyles = {
										...pieceStyles,
										[b.fieldName]: { ...pieceStyles[b.fieldName], backgroundColor: v }
									};
								}}
							/>
							<button
								type="button"
								class="btn tiny"
								onclick={() => {
									pieceStyles = {
										...pieceStyles,
										[b.fieldName]: { ...pieceStyles[b.fieldName], backgroundColor: '' }
									};
								}}>Clear</button
							>
						</div>
					{/if}
				</section>
			{/each}

			{#if err}
				<p class="err">{err}</p>
			{/if}

			<div class="actions">
				<button type="button" class="btn primary" disabled={saving} onclick={save}>Save piece</button>
				<button type="button" class="btn" disabled={saving} onclick={renderPng}>Render piece image (game)</button>
				<button type="button" class="btn" disabled={saving} onclick={renderPrintPng}>Download print PNG (300 DPI)</button>
			</div>
		</div>

		<div class="preview-col">
			<h2>Preview</h2>
			<div class="preview-wrap" bind:this={previewEl}>
				<CardPreview
					width={data.template.canvas_width}
					height={data.template.canvas_height}
					borderRadius={data.template.border_radius}
					background={parseBackground(data.template.background as Json)}
					layers={parsedLayers}
					{fieldValues}
					fieldStyles={pieceStyles}
					{mediaUrls}
				/>
			</div>
		</div>
	</div>
</div>

<AIGenerateModal
	open={aiOpen}
	gameId={data.game.id}
	onClose={() => {
		aiOpen = false;
		aiFieldKey = null;
	}}
	onPick={(r) => {
		if (aiFieldKey) {
			fieldValues = { ...fieldValues, [aiFieldKey]: r.mediaId };
			mediaUrls = { ...mediaUrls, [r.mediaId]: r.publicUrl };
		}
		aiOpen = false;
		aiFieldKey = null;
		void loadMedia();
	}}
/>

<MediaPickerModal
	open={pickerOpen}
	gameId={data.game.id}
	onClose={() => {
		pickerOpen = false;
		pickerFieldKey = null;
	}}
	onPick={(id, filePath) => {
		if (pickerFieldKey) {
			fieldValues = { ...fieldValues, [pickerFieldKey]: id };
			if (filePath) {
				mediaUrls = { ...mediaUrls, [id]: publicStorageUrl(filePath) };
			}
		}
		pickerOpen = false;
		pickerFieldKey = null;
		void loadMedia();
	}}
/>

<style>
	.page {
		padding: 1.25rem 1.5rem;
		max-width: 1120px;
		color: var(--color-text);
	}
	.breadcrumb {
		font-size: 13px;
		color: var(--color-text-muted);
		margin-bottom: 1rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.breadcrumb a {
		color: var(--color-accent, #3b82f6);
		text-decoration: none;
	}
	.breadcrumb a:hover {
		text-decoration: underline;
	}
	.breadcrumb .sep {
		opacity: 0.6;
		user-select: none;
	}
	.breadcrumb .current {
		color: var(--color-text);
		font-weight: 500;
		max-width: 40ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	h1 {
		margin-top: 0;
		margin-bottom: 0.35rem;
	}
	h2 {
		font-size: 1rem;
		margin-top: 0;
		margin-bottom: 0.75rem;
	}
	.head {
		margin-bottom: 1.25rem;
	}
	.meta {
		color: var(--color-text-muted);
		font-size: 14px;
		margin: 0 0 0.5rem;
	}
	.meta .stale-tag {
		margin-left: 8px;
		font-size: 12px;
		color: #fbbf24;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(280px, 1fr) minmax(300px, 1fr);
		gap: 1.75rem;
		align-items: start;
	}
	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
		.preview-col {
			position: static;
		}
	}
	.preview-col {
		position: sticky;
		top: 0.75rem;
	}
	.form-col {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.field-bucket {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 1rem;
		padding: 14px 16px;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		background: var(--color-surface-muted);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}
	.field-bucket-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--color-text);
		line-height: 1.3;
	}
	.field-bucket-main {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 1rem;
	}
	.field input,
	.field-bucket input,
	.field-bucket textarea {
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		width: 100%;
		box-sizing: border-box;
	}
	.field-bucket textarea.piece-field-textarea {
		min-height: 7rem;
		resize: vertical;
		font: inherit;
		line-height: 1.45;
	}
	.btn {
		padding: 8px 14px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
		margin-right: 8px;
		margin-bottom: 8px;
	}
	.btn.small {
		padding: 4px 8px;
		font-size: 12px;
		margin-top: 6px;
	}
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
	}
	.actions {
		margin: 1rem 0;
	}
	.preview-wrap {
		display: inline-block;
		padding: 16px;
		border-radius: 8px;
		background: repeating-conic-gradient(#1a1a1a 0% 25%, #242424 0% 50%) 50% / 20px 20px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
	}
	.err {
		color: #f87171;
	}
	.img-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 12px;
	}
	.thumb {
		width: 72px;
		height: 96px;
		object-fit: cover;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: #111;
	}
	.thumb.ph {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		color: #888;
	}
	.img-actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.field-bucket .style-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin: 0;
		padding: 10px 0 0;
		border-top: 1px solid var(--color-border);
	}
	.style-row :global(.color-row) {
		flex: 1 1 180px;
		min-width: 0;
	}
	.style-label {
		font-size: 12px;
		color: var(--color-text-muted);
		width: 100%;
	}
	.btn.tiny {
		padding: 4px 8px;
		font-size: 11px;
		align-self: center;
	}
</style>
