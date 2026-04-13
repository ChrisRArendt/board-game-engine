<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import CardPreview from '$lib/components/editor/CardPreview.svelte';
	import ColorPicker from '$lib/components/editor/ColorPicker.svelte';
	import GameMediaImageTools from '$lib/components/editor/GameMediaImageTools.svelte';
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
	import type { Json } from '$lib/supabase/database.types';
	import type { PageData } from './$types';
	import { browser } from '$app/environment';
	import { getPieceColorPaletteFromGameData, parseGameDataJson } from '$lib/editor/gameDataJson';

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
		pieceColorPalette = getPieceColorPaletteFromGameData(data.game.game_data);
	});

	let previewEl: HTMLDivElement | undefined;
	type ActionPhase = 'idle' | 'loading' | 'success';
	let saveBtnState = $state<ActionPhase>('idle');
	let renderBtnState = $state<ActionPhase>('idle');
	let printBtnState = $state<ActionPhase>('idle');
	let err = $state('');

	const actionBusy = $derived(
		saveBtnState === 'loading' || renderBtnState === 'loading' || printBtnState === 'loading'
	);

	const SUCCESS_MS = 2000;

	let mediaUrls = $state<Record<string, string>>({});

	let pieceColorPalette = $state(getPieceColorPaletteFromGameData(data.game.game_data));

	async function loadMedia() {
		const gid = data.game.id;
		const { data: rows } = await supabase.from('game_media').select('id, file_path').eq('game_id', gid);
		const m: Record<string, string> = {};
		for (const r of rows ?? []) {
			m[r.id] = publicStorageUrl(r.file_path);
		}
		mediaUrls = m;
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
		if (saveBtnState === 'loading') return;
		saveBtnState = 'loading';
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
			const gd = parseGameDataJson(data.game.game_data);
			const { error: gErr } = await supabase
				.from('custom_board_games')
				.update({
					game_data: { ...gd, piece_color_palette: pieceColorPalette } as unknown as Json,
					updated_at: new Date().toISOString()
				})
				.eq('id', data.game.id);
			if (gErr) throw gErr;
			await invalidateAll();
			saveBtnState = 'success';
			window.setTimeout(() => {
				saveBtnState = 'idle';
			}, SUCCESS_MS);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Save failed';
			saveBtnState = 'idle';
		}
	}

	async function renderPng() {
		if (!previewEl || !data.session?.user) return;
		if (renderBtnState === 'loading') return;
		renderBtnState = 'loading';
		err = '';
		try {
			const blob = await rasterizeElementToPng(previewEl, { scale: 2, backgroundColor: null });
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
			renderBtnState = 'success';
			window.setTimeout(() => {
				renderBtnState = 'idle';
			}, SUCCESS_MS);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Render failed';
			renderBtnState = 'idle';
		}
	}

	async function renderPrintPng() {
		if (!previewEl) return;
		if (printBtnState === 'loading') return;
		printBtnState = 'loading';
		err = '';
		try {
			/** 150 DPI design → 300 DPI: 2× supersampling on design-sized DOM */
			const blob = await rasterizeElementToPng(previewEl, { scale: 2, backgroundColor: null });
			downloadBlob(blob, `${(name || 'piece').replace(/\s+/g, '-')}-print-300dpi.png`);
			printBtnState = 'success';
			window.setTimeout(() => {
				printBtnState = 'idle';
			}, SUCCESS_MS);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Export failed';
			printBtnState = 'idle';
		}
	}
</script>

<div class="page editor-page-scroll">
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
					<div
						class="field-inline-row"
						class:with-textarea={b.fieldType === 'textarea'}
						class:is-image={isImageField(b)}
					>
						<div class="field-inline-main">
							{#if isImageField(b)}
								<GameMediaImageTools
									gameId={data.game.id}
									mediaId={fieldValues[b.fieldName]?.trim() || null}
									{mediaUrls}
									onMediaIdChange={(id) => {
										fieldValues = { ...fieldValues, [b.fieldName]: id ?? '' };
									}}
									onMergeUrls={(u) => {
										mediaUrls = { ...mediaUrls, ...u };
									}}
									onAfterPick={() => {
										void loadMedia();
									}}
								/>
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
									class="piece-field-input"
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
						{#if showsLayerBackground(b) || showsTextColor(b)}
							<div class="field-swatches">
								{#if showsLayerBackground(b)}
									<ColorPicker
										ariaLabel="Background color for {b.fieldLabel}"
										value={pieceStyles[b.fieldName]?.backgroundColor?.trim() || '#ffffff'}
										palette={pieceColorPalette}
										onPaletteChange={(cols: string[]) => (pieceColorPalette = cols)}
										onValueChange={(v: string) => {
											pieceStyles = {
												...pieceStyles,
												[b.fieldName]: { ...pieceStyles[b.fieldName], backgroundColor: v }
											};
										}}
										resetLabel="Clear override"
										onReset={() => {
											pieceStyles = {
												...pieceStyles,
												[b.fieldName]: { ...pieceStyles[b.fieldName], backgroundColor: '' }
											};
										}}
									/>
								{/if}
								{#if showsTextColor(b)}
									<ColorPicker
										ariaLabel="Text color for {b.fieldLabel}"
										value={pieceStyles[b.fieldName]?.textColor?.trim()
											? pieceStyles[b.fieldName].textColor
											: templateTextColor(b.fieldName)}
										palette={pieceColorPalette}
										onPaletteChange={(cols: string[]) => (pieceColorPalette = cols)}
										onValueChange={(v: string) => {
											pieceStyles = {
												...pieceStyles,
												[b.fieldName]: { ...pieceStyles[b.fieldName], textColor: v }
											};
										}}
										resetLabel="Use template"
										onReset={() => {
											pieceStyles = {
												...pieceStyles,
												[b.fieldName]: { ...pieceStyles[b.fieldName], textColor: '' }
											};
										}}
									/>
								{/if}
							</div>
						{/if}
					</div>
				</section>
			{/each}

			{#if err}
				<p class="err">{err}</p>
			{/if}

			<div class="actions" aria-live="polite">
				<button
					type="button"
					class="btn primary"
					class:btn-done={saveBtnState === 'success'}
					disabled={actionBusy}
					aria-busy={saveBtnState === 'loading'}
					onclick={save}
				>
					{#if saveBtnState === 'loading'}
						Saving…
					{:else if saveBtnState === 'success'}
						Saved
					{:else}
						Save piece
					{/if}
				</button>
				<button
					type="button"
					class="btn"
					class:btn-done={renderBtnState === 'success'}
					disabled={actionBusy || !data.session?.user}
					aria-busy={renderBtnState === 'loading'}
					onclick={renderPng}
				>
					{#if renderBtnState === 'loading'}
						Rendering…
					{:else if renderBtnState === 'success'}
						Rendered
					{:else}
						Render piece image (game)
					{/if}
				</button>
				<button
					type="button"
					class="btn"
					class:btn-done={printBtnState === 'success'}
					disabled={actionBusy}
					aria-busy={printBtnState === 'loading'}
					onclick={renderPrintPng}
				>
					{#if printBtnState === 'loading'}
						Preparing…
					{:else if printBtnState === 'success'}
						Downloaded
					{:else}
						Download print PNG (300 DPI)
					{/if}
				</button>
			</div>
		</div>

		<div class="preview-col">
			<h2>Preview</h2>
			<div class="preview-chrome">
				<div class="preview-export-root" bind:this={previewEl}>
					<CardPreview
						width={data.template.canvas_width}
						height={data.template.canvas_height}
						borderRadius={data.template.border_radius}
						frameBorderWidth={data.template.frame_border_width ?? 0}
						frameBorderColor={data.template.frame_border_color ?? '#000000'}
						background={parseBackground(data.template.background as Json)}
						layers={parsedLayers}
						{fieldValues}
						fieldStyles={pieceStyles}
						{mediaUrls}
						flattenLayout={true}
					/>
				</div>
			</div>
		</div>
	</div>
</div>

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
		gap: 8px;
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
	.field-inline-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.field-inline-row.with-textarea,
	.field-inline-row.is-image {
		align-items: flex-start;
	}
	.field-inline-main {
		flex: 1 1 160px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field-swatches {
		display: flex;
		flex-direction: row;
		gap: 6px;
		flex-shrink: 0;
		align-items: center;
	}
	.field-inline-row.with-textarea .field-swatches,
	.field-inline-row.is-image .field-swatches {
		align-items: flex-start;
		padding-top: 2px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 1rem;
	}
	.field input,
	.field-bucket input.piece-field-input,
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
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
	}
	.btn.primary.btn-done {
		background: #15803d;
	}
	.btn.btn-done:not(.primary) {
		border-color: #22c55e;
		color: #86efac;
		background: rgba(34, 197, 94, 0.12);
	}
	.btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
	.actions {
		margin: 1rem 0;
	}
	.preview-chrome {
		display: inline-block;
		padding: 16px;
		border-radius: 8px;
		background: repeating-conic-gradient(#1a1a1a 0% 25%, #242424 0% 50%) 50% / 20px 20px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
	}
	.preview-export-root {
		display: inline-block;
		vertical-align: top;
		line-height: 0;
	}
	.err {
		color: #f87171;
	}
</style>
