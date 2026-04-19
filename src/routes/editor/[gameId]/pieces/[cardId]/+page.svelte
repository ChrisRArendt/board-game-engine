<script lang="ts">
	import { goto, invalidate, invalidateAll } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import CardPreview from '$lib/components/editor/CardPreview.svelte';
	import PieceListThumb from '$lib/components/editor/PieceListThumb.svelte';
	import ColorPicker from '$lib/components/editor/ColorPicker.svelte';
	import GameMediaImageTools from '$lib/components/editor/GameMediaImageTools.svelte';
	import {
		buildCardFieldValuesPayload,
		collectFieldBindings,
		groupBindingsForPieceEditor,
		type PieceFieldStyle,
		mergeFieldValuesForBindings,
		splitFieldValuesPayload
	} from '$lib/editor/fieldBindings';
	import {
		parseBackground,
		parseLayers,
		parseOptionalBackgroundOrNull,
		parseOptionalLayersOrNull,
		defaultBackBackground,
		templateHasBack,
		type FieldBinding,
		type TextLayer
	} from '$lib/editor/types';
	import { rasterizeElementToPng } from '$lib/editor/rasterize';
	import { rasterizeCardFrontAndBack, rasterizeCardInstanceToBlob } from '$lib/editor/bulkCardRasterize';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import { downloadBlob, zipPngFiles } from '$lib/editor/printExport';
	import type { Json } from '$lib/supabase/database.types';
	import type { PageData } from './$types';
	import { browser } from '$app/environment';
	import {
		getPieceColorPaletteFromGameData,
		parseGameDataJson,
		removeBoardPiecesForCard
	} from '$lib/editor/gameDataJson';
	import { persistPieceColorPalette } from '$lib/editor/persistPieceColorPalette';

	let { data }: { data: PageData } = $props();

	const supabase = createSupabaseBrowserClient();

	const parsedLayers = $derived(parseLayers(data.template.layers as Json));
	const parsedBackLayers = $derived(
		parseOptionalLayersOrNull(data.template.back_layers as Json) ?? []
	);
	const hasBack = $derived(
		templateHasBack(data.template.back_background, data.template.back_layers)
	);
	const backBackground = $derived(
		parseOptionalBackgroundOrNull(data.template.back_background as Json) ?? defaultBackBackground()
	);
	const bindings = $derived(collectFieldBindings(parsedLayers, parsedBackLayers));
	const bindingSections = $derived(groupBindingsForPieceEditor(bindings));

	function allLayersFlat(): ReturnType<typeof parseLayers> {
		return [...parseLayers(data.template.layers as Json), ...parsedBackLayers];
	}

	function mergeForCard(): Record<string, string> {
		const pl = parseLayers(data.template.layers as Json);
		const pb = parseOptionalLayersOrNull(data.template.back_layers as Json) ?? [];
		const b = collectFieldBindings(pl, pb);
		return mergeFieldValuesForBindings(
			splitFieldValuesPayload(data.card.field_values).values,
			b,
			[...pl, ...pb]
		);
	}

	function mergePieceStyles(): Record<string, PieceFieldStyle> {
		const pl = parseLayers(data.template.layers as Json);
		const pb = parseOptionalLayersOrNull(data.template.back_layers as Json) ?? [];
		const bs = collectFieldBindings(pl, pb);
		const { styles } = splitFieldValuesPayload(data.card.field_values);
		const out: Record<string, PieceFieldStyle> = {};
		for (const b of bs) {
			const s = styles[b.fieldName];
			out[b.fieldName] = {
				textColor: s?.textColor ?? '',
				backgroundColor: s?.backgroundColor ?? '',
				fontSize:
					typeof s?.fontSize === 'number' && Number.isFinite(s.fontSize) && s.fontSize > 0
						? s.fontSize
						: undefined
			};
		}
		return out;
	}

	function templateFontSize(fieldName: string): number {
		for (const L of allLayersFlat()) {
			if (L.type === 'text' && L.fieldBinding?.fieldName === fieldName) {
				return (L as TextLayer).fontSize ?? 16;
			}
		}
		return 16;
	}

	function templateTextColor(fieldName: string): string {
		for (const L of allLayersFlat()) {
			if (L.type === 'text' && L.fieldBinding?.fieldName === fieldName) {
				return (L as TextLayer).color;
			}
		}
		return '#e2e8f0';
	}

	/** Template layer is image + this field — even if fieldType was left as "text" when adding Per-piece field. */
	function bindingIsImageLayer(fieldName: string): boolean {
		for (const L of allLayersFlat()) {
			if (L.type === 'image' && L.fieldBinding?.fieldName === fieldName) return true;
		}
		return false;
	}

	function isImageField(b: { fieldName: string; fieldType: string }): boolean {
		return b.fieldType === 'image' || bindingIsImageLayer(b.fieldName);
	}

	function showsTextColor(b: FieldBinding): boolean {
		if (b.shapeGradientGroup) return false;
		if (bindingIsImageLayer(b.fieldName)) return false;
		return b.fieldType === 'text' || b.fieldType === 'textarea' || b.fieldType === 'number' || b.fieldType === 'color';
	}

	function showsLayerBackground(b: FieldBinding): boolean {
		if (b.shapeGradientGroup) return false;
		if (bindingIsImageLayer(b.fieldName)) return true;
		return (
			b.fieldType === 'text' ||
			b.fieldType === 'textarea' ||
			b.fieldType === 'number' ||
			b.fieldType === 'color' ||
			b.fieldType === 'image'
		);
	}

	function showsFontSize(b: FieldBinding): boolean {
		if (b.shapeGradientGroup) return false;
		if (bindingIsImageLayer(b.fieldName)) return false;
		return (
			b.fieldType === 'text' ||
			b.fieldType === 'textarea' ||
			b.fieldType === 'number' ||
			b.fieldType === 'color'
		);
	}

	let name = $state('');
	let fieldValues = $state<Record<string, string>>({});
	let pieceStyles = $state<Record<string, PieceFieldStyle>>({});

	let lastCardId = $state<string | null>(null);
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
	let previewColEl: HTMLDivElement | undefined;
	let previewColW = 500;
	$effect(() => {
		if (!previewColEl) return;
		const ro = new ResizeObserver((entries) => {
			for (const e of entries) previewColW = e.contentRect.width;
		});
		ro.observe(previewColEl);
		return () => ro.disconnect();
	});
	const previewScale = $derived((() => {
		const cw = data.template.canvas_width;
		const available = previewColW - 32;
		const cols = hasBack ? 2 : 1;
		const gap = hasBack ? 16 : 0;
		const maxCardW = (available - gap) / cols;
		if (cw <= 0 || maxCardW >= cw) return 1;
		return Math.max(0.25, maxCardW / cw);
	})());

	function backPngPathFromFront(frontPath: string): string {
		return frontPath.replace(/\.png$/i, '-back.png');
	}

	/** Same as pieces list: public URL for storage path (used with `PieceListThumb`). */
	function thumb(path: string | null) {
		if (!path) return '';
		return publicStorageUrl(path);
	}

	/** Matches listing: `card.updated_at`, plus DB value right after render so thumbs refresh immediately. */
	let renderedThumbCacheKeyOverride = $state('');
	/** Until `invalidateAll` returns, `data.card` can still lack `rendered_image_path` — mirror list thumbs as soon as upload succeeds. */
	let optimisticRenderedPath = $state<string | null>(null);
	$effect(() => {
		void data.card.id;
		renderedThumbCacheKeyOverride = '';
		optimisticRenderedPath = null;
	});
	const renderCacheKey = $derived(renderedThumbCacheKeyOverride || (data.card.updated_at ?? ''));
	const effectiveRenderedPath = $derived(optimisticRenderedPath ?? data.card.rendered_image_path);

	type ActionPhase = 'idle' | 'loading' | 'success';
	let saveBtnState = $state<ActionPhase>('idle');
	let renderBtnState = $state<ActionPhase>('idle');
	let printBtnState = $state<ActionPhase>('idle');
	let deleteBtnState = $state<ActionPhase>('idle');
	let err = $state('');

	const actionBusy = $derived(
		saveBtnState === 'loading' ||
			renderBtnState === 'loading' ||
			printBtnState === 'loading' ||
			deleteBtnState === 'loading'
	);

	const SUCCESS_MS = 2000;

	let mediaUrls = $state<Record<string, string>>({});

	let pieceColorPalette = $state<string[]>([]);

	let palettePersistTimer: ReturnType<typeof setTimeout> | null = null;

	function setPieceColorPaletteLocal(cols: string[]) {
		pieceColorPalette = cols;
		const gid = data.game.id;
		if (palettePersistTimer) clearTimeout(palettePersistTimer);
		palettePersistTimer = setTimeout(() => {
			palettePersistTimer = null;
			void (async () => {
				const { error } = await persistPieceColorPalette(supabase, gid, cols);
				if (error) console.error('save palette', error);
			})();
		}, 450);
	}

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
			const pb = parseOptionalLayersOrNull(data.template.back_layers as Json) ?? [];
			const bindings = collectFieldBindings(pl, pb);
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
			await invalidate('app:card-instances');
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

	function templateRowForRasterize() {
		return {
			canvas_width: data.template.canvas_width,
			canvas_height: data.template.canvas_height,
			border_radius: data.template.border_radius,
			frame_border_width: data.template.frame_border_width,
			frame_border_color: data.template.frame_border_color,
			frame_inner_radius: data.template.frame_inner_radius ?? null,
			background: data.template.background,
			layers: data.template.layers,
			back_background: data.template.back_background,
			back_layers: data.template.back_layers
		};
	}

	async function renderPng() {
		if (!data.session?.user) return;
		if (renderBtnState === 'loading') return;
		renderBtnState = 'loading';
		err = '';
		try {
			const { front, back } = await rasterizeCardFrontAndBack(
				templateRowForRasterize(),
				data.card.field_values,
				mediaUrls,
				{ scale: 2 }
			);
			const uid = data.session.user.id;
			const base = `${uid}/${data.game.id}/cards/${data.card.id}`;
			const frontPath = `${base}.png`;
			const { error: upErr } = await supabase.storage.from('custom-game-assets').upload(frontPath, front, {
				upsert: true,
				contentType: 'image/png'
			});
			if (upErr) throw upErr;
			if (back) {
				const backPath = `${base}-back.png`;
				const { error: upErr2 } = await supabase.storage.from('custom-game-assets').upload(backPath, back, {
					upsert: true,
					contentType: 'image/png'
				});
				if (upErr2) throw upErr2;
			}
			const { data: updatedCard, error: uErr } = await supabase
				.from('card_instances')
				.update({
					rendered_image_path: frontPath,
					render_stale: false,
					updated_at: new Date().toISOString()
				})
				.eq('id', data.card.id)
				.select('id, render_stale, updated_at')
				.single();
			if (uErr) throw uErr;
			if (!updatedCard || updatedCard.render_stale !== false) {
				throw new Error('Could not confirm render state was saved.');
			}
			optimisticRenderedPath = frontPath;
			renderedThumbCacheKeyOverride = updatedCard.updated_at ?? '';
			await invalidate('app:card-instances');
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

	async function deletePiece() {
		if (
			!confirm(
				'Delete this piece from the game? Any copies on the board will be removed. This cannot be undone.'
			)
		)
			return;
		if (deleteBtnState === 'loading') return;
		deleteBtnState = 'loading';
		err = '';
		try {
			const gd = parseGameDataJson(data.game.game_data);
			const nextGd = removeBoardPiecesForCard(gd, data.card.id);
			const { error: gErr } = await supabase
				.from('custom_board_games')
				.update({
					game_data: nextGd as unknown as Json,
					updated_at: new Date().toISOString()
				})
				.eq('id', data.game.id);
			if (gErr) throw gErr;

			const path = data.card.rendered_image_path;
			if (path) {
				const { error: rmErr } = await supabase.storage.from('custom-game-assets').remove([path]);
				if (rmErr) console.warn('[delete piece] storage remove', rmErr);
			}

			const { error: dErr } = await supabase
				.from('card_instances')
				.delete()
				.eq('id', data.card.id)
				.eq('game_id', data.game.id);
			if (dErr) throw dErr;

			await goto(`/editor/${data.game.id}/pieces`);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Delete failed';
			deleteBtnState = 'idle';
		}
	}

	async function renderPrintPng() {
		if (printBtnState === 'loading') return;
		if (!hasBack && !previewEl) return;
		printBtnState = 'loading';
		err = '';
		try {
			const base = `${(name || 'piece').replace(/\s+/g, '-')}-print-300dpi`;
			if (hasBack) {
				const tmpl = templateRowForRasterize();
				const front = await rasterizeCardInstanceToBlob(tmpl, data.card.field_values, mediaUrls, {
					scale: 2,
					face: 'front'
				});
				const back = await rasterizeCardInstanceToBlob(tmpl, data.card.field_values, mediaUrls, {
					scale: 2,
					face: 'back'
				});
				const zip = await zipPngFiles([
					{ path: `${base}-front.png`, blob: front },
					{ path: `${base}-back.png`, blob: back }
				]);
				downloadBlob(zip, `${base}.zip`);
			} else {
				if (!previewEl) return;
				const blob = await rasterizeElementToPng(previewEl, {
					scale: 2,
					backgroundColor: null,
					clipToRoundedRect: {
						width: data.template.canvas_width,
						height: data.template.canvas_height,
						radius: data.template.border_radius
					}
				});
				downloadBlob(blob, `${base}.png`);
			}
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

			{#each bindingSections as section}
				{#if section.kind === 'shapeGradient'}
					<section
						class="field-bucket field-bucket-shape-gradient"
						aria-labelledby="field-{section.groupId}"
					>
						<div class="field-shape-gradient-row">
							<h3 class="field-bucket-title" id="field-{section.groupId}">{section.groupTitle}</h3>
							<div class="field-shape-gradient-swatches">
								{#each section.bindings as b}
									<ColorPicker
										ariaLabel={`Gradient stop ${b.shapeGradientGroup!.stopIndex + 1} (${section.groupTitle})`}
										value={fieldValues[b.fieldName]?.trim() || b.defaultValue || '#ffffff'}
										palette={pieceColorPalette}
										onPaletteChange={setPieceColorPaletteLocal}
										onValueChange={(v: string) => {
											fieldValues = { ...fieldValues, [b.fieldName]: v };
										}}
										resetLabel="Use template"
										onReset={() => {
											fieldValues = { ...fieldValues, [b.fieldName]: b.defaultValue ?? '' };
										}}
									/>
								{/each}
							</div>
						</div>
					</section>
				{:else}
					{@const b = section.binding}
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
							{#if showsFontSize(b)}
								<div class="field-font-size">
									<label class="font-size-label">
										<span>Size (px)</span>
										<input
											type="number"
											min="4"
											max="500"
											step="0.5"
											class="font-size-input"
											placeholder={String(templateFontSize(b.fieldName))}
											title="Leave empty to use the template size ({templateFontSize(b.fieldName)}px)"
											value={pieceStyles[b.fieldName]?.fontSize != null &&
											pieceStyles[b.fieldName]!.fontSize! > 0
												? String(pieceStyles[b.fieldName]!.fontSize)
												: ''}
											oninput={(e) => {
												const raw = (e.currentTarget as HTMLInputElement).value;
												const n = parseFloat(raw);
												pieceStyles = {
													...pieceStyles,
													[b.fieldName]: {
														...pieceStyles[b.fieldName],
														fontSize:
															raw === '' || !Number.isFinite(n) || n <= 0 ? undefined : n
													}
												};
											}}
										/>
									</label>
								</div>
							{/if}
							{#if showsLayerBackground(b) || showsTextColor(b)}
								<div class="field-swatches">
									{#if showsLayerBackground(b)}
										<ColorPicker
											ariaLabel="Background color for {b.fieldLabel}"
											value={pieceStyles[b.fieldName]?.backgroundColor?.trim() || '#ffffff'}
											palette={pieceColorPalette}
											onPaletteChange={setPieceColorPaletteLocal}
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
											onPaletteChange={setPieceColorPaletteLocal}
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
				{/if}
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
					{:else if hasBack}
						Download print PNGs (ZIP, front + back)
					{:else}
						Download print PNG (300 DPI)
					{/if}
				</button>
				<button
					type="button"
					class="btn danger"
					disabled={actionBusy}
					aria-busy={deleteBtnState === 'loading'}
					onclick={deletePiece}
				>
					{deleteBtnState === 'loading' ? 'Deleting…' : 'Delete piece'}
				</button>
			</div>
		</div>

		<div class="preview-col" bind:this={previewColEl}>
			<h2>Preview</h2>
			<div class="preview-chrome" class:two-up={hasBack}>
				<div class="preview-face">
					<span class="preview-face-label">Front</span>
					<div
						class="preview-zoom-outer"
						style:width="{data.template.canvas_width * previewScale}px"
						style:height="{data.template.canvas_height * previewScale}px"
					>
						<div
							class="preview-zoom-inner"
							style:transform="scale({previewScale})"
							style:transform-origin="top left"
						>
							<div class="preview-export-root" bind:this={previewEl}>
								<CardPreview
								width={data.template.canvas_width}
								height={data.template.canvas_height}
								borderRadius={data.template.border_radius}
								frameBorderWidth={data.template.frame_border_width ?? 0}
								frameBorderColor={data.template.frame_border_color ?? '#000000'}
								frameInnerRadius={data.template.frame_inner_radius ?? null}
								background={parseBackground(data.template.background as Json)}
								layers={parsedLayers}
								{fieldValues}
								fieldStyles={pieceStyles}
								{mediaUrls}
								displayScale={1}
								flattenLayout
							/>
							</div>
						</div>
					</div>
				</div>
				{#if hasBack}
					<div class="preview-face">
						<span class="preview-face-label">Back</span>
						<div
							class="preview-zoom-outer"
							style:width="{data.template.canvas_width * previewScale}px"
							style:height="{data.template.canvas_height * previewScale}px"
						>
							<div
								class="preview-zoom-inner"
								style:transform="scale({previewScale})"
								style:transform-origin="top left"
							>
								<div class="preview-export-root" aria-hidden="true">
									<CardPreview
									width={data.template.canvas_width}
									height={data.template.canvas_height}
									borderRadius={data.template.border_radius}
									frameBorderWidth={data.template.frame_border_width ?? 0}
									frameBorderColor={data.template.frame_border_color ?? '#000000'}
									frameInnerRadius={data.template.frame_inner_radius ?? null}
									background={backBackground}
									layers={parsedBackLayers}
									{fieldValues}
									fieldStyles={pieceStyles}
									{mediaUrls}
									displayScale={1}
									flattenLayout
								/>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div class="rendered-panel" aria-labelledby="rendered-heading">
				<h3 id="rendered-heading" class="rendered-heading">Rendered for play</h3>
				<p class="rendered-hint">
					Stored PNGs — what the board and flip animation use after you render.
				</p>
				<div class="rendered-pair" class:two-up={hasBack}>
					<figure class="rendered-fig">
						<figcaption>Front</figcaption>
						{#if effectiveRenderedPath}
							<div class="rendered-frame">
								<PieceListThumb src={thumb(effectiveRenderedPath)} cacheKey={renderCacheKey} />
							</div>
						{:else}
							<p class="rendered-missing">Not rendered yet — use “Render piece image (game)”.</p>
						{/if}
					</figure>
					{#if hasBack}
						<figure class="rendered-fig">
							<figcaption>Back</figcaption>
							{#if effectiveRenderedPath}
								<div class="rendered-frame">
									<PieceListThumb
										src={thumb(backPngPathFromFront(effectiveRenderedPath))}
										cacheKey={renderCacheKey}
									/>
								</div>
							{:else}
								<p class="rendered-missing">Back path unavailable.</p>
							{/if}
						</figure>
					{/if}
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
	.preview-chrome.two-up {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		align-items: start;
	}
	@media (max-width: 900px) {
		.preview-chrome.two-up {
			grid-template-columns: 1fr;
		}
	}
	.preview-face {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		overflow: hidden;
	}
	.preview-face-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}
	.rendered-panel {
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
	}
	.rendered-heading {
		font-size: 0.95rem;
		margin: 0 0 0.35rem;
	}
	.rendered-hint {
		font-size: 12px;
		color: var(--color-text-muted);
		margin: 0 0 0.75rem;
		line-height: 1.4;
	}
	.rendered-pair {
		display: grid;
		gap: 1rem;
	}
	.rendered-pair.two-up {
		grid-template-columns: 1fr 1fr;
	}
	@media (max-width: 900px) {
		.rendered-pair.two-up {
			grid-template-columns: 1fr;
		}
	}
	.rendered-fig {
		margin: 0;
		min-width: 0;
	}
	.rendered-fig figcaption {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		margin-bottom: 6px;
	}
	.rendered-frame {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		max-height: 240px;
		margin: 0 auto;
		border-radius: 8px;
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
		background: #1a1a1f;
		overflow: hidden;
	}
	.rendered-frame :global(.piece-list-thumb) {
		position: absolute;
		inset: 0;
	}
	.rendered-missing {
		font-size: 13px;
		color: var(--color-text-muted);
		margin: 0;
		padding: 0.75rem;
		text-align: center;
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
	.field-bucket-shape-gradient {
		padding: 12px 16px;
	}
	.field-shape-gradient-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 14px;
		min-width: 0;
	}
	.field-bucket-shape-gradient .field-bucket-title {
		flex: 1 1 140px;
		min-width: 0;
		margin: 0;
	}
	.field-shape-gradient-swatches {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		gap: 6px;
		flex-shrink: 0;
		align-items: center;
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
	.field-font-size {
		flex: 0 0 auto;
		display: flex;
		align-items: flex-start;
		padding-top: 2px;
	}
	.font-size-label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 11px;
		color: var(--color-text-muted);
		margin: 0;
	}
	.font-size-input {
		width: 4.75rem;
		padding: 6px 8px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		font-size: 13px;
		box-sizing: border-box;
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
	.btn.danger {
		border-color: rgba(248, 113, 113, 0.55);
		color: #f87171;
		background: rgba(248, 113, 113, 0.08);
	}
	.btn.danger:hover:not(:disabled) {
		background: rgba(248, 113, 113, 0.16);
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
