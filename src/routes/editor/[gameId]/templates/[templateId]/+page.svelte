<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import TemplateCanvas from '$lib/components/editor/TemplateCanvas.svelte';
	import LayerContextMenu from '$lib/components/editor/LayerContextMenu.svelte';
	import LayerPanel from '$lib/components/editor/LayerPanel.svelte';
	import LayerProperties from '$lib/components/editor/LayerProperties.svelte';
	import GameMediaImageTools from '$lib/components/editor/GameMediaImageTools.svelte';
	import ImageLayoutControls from '$lib/components/editor/ImageLayoutControls.svelte';
	import ColorPicker from '$lib/components/editor/ColorPicker.svelte';
	import GradientEditor from '$lib/components/editor/GradientEditor.svelte';
	import UnitInput from '$lib/components/editor/UnitInput.svelte';
	import type { PageData } from './$types';
	import type { CardBackground, CardLayer } from '$lib/editor/types';
	import {
		parseBackground,
		parseLayers,
		defaultTextLayer,
		defaultImageLayer,
		defaultShapeLayer,
		newId
	} from '$lib/editor/types';
	import type { Json } from '$lib/supabase/database.types';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import { getPieceColorPaletteFromGameData, parseGameDataJson } from '$lib/editor/gameDataJson';
	import { persistPieceColorPalette } from '$lib/editor/persistPieceColorPalette';

	function collapsibleStorageKey(templateId: string, section: 'cardBg' | 'frame') {
		return `bge:template-editor:${templateId}:details:${section}`;
	}

	function readCollapsibleOpen(templateId: string, section: 'cardBg' | 'frame', defaultOpen = true): boolean {
		if (!browser) return defaultOpen;
		try {
			const v = localStorage.getItem(collapsibleStorageKey(templateId, section));
			if (v === null) return defaultOpen;
			return v === '1';
		} catch {
			return defaultOpen;
		}
	}

	function writeCollapsibleOpen(templateId: string, section: 'cardBg' | 'frame', open: boolean) {
		if (!browser) return;
		try {
			localStorage.setItem(collapsibleStorageKey(templateId, section), open ? '1' : '0');
		} catch {
			/* quota / private mode */
		}
	}

	let { data }: { data: PageData } = $props();

	const supabase = createSupabaseBrowserClient();

	let name = $state(data.template.name);
	let canvasW = $state(data.template.canvas_width);
	let canvasH = $state(data.template.canvas_height);
	let borderR = $state(data.template.border_radius);
	let frameW = $state(data.template.frame_border_width ?? 0);
	let frameColor = $state(data.template.frame_border_color ?? '#000000');
	let frameInnerR = $state<number | null>(data.template.frame_inner_radius ?? null);
	const initialLayers = parseLayers(data.template.layers as Json);
	let background = $state(parseBackground(data.template.background as Json));
	let layers = $state(initialLayers);
	let selectedId = $state<string | null>(initialLayers[0]?.id ?? null);
	let saving = $state(false);
	let err = $state('');

	let mediaUrls = $state<Record<string, string>>({});

	let cardBgOpen = $state(true);
	let frameOpen = $state(true);

	let layerCtxMenu = $state<{ id: string; x: number; y: number } | null>(null);

	let pieceColorPalette = $state(getPieceColorPaletteFromGameData(data.game.game_data));

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

	function clipLayerCtxPos(clientX: number, clientY: number) {
		const mw = 168;
		const mh = 124;
		const pad = 8;
		if (!browser) return { x: clientX, y: clientY };
		return {
			x: Math.min(Math.max(pad, clientX), window.innerWidth - mw - pad),
			y: Math.min(Math.max(pad, clientY), window.innerHeight - mh - pad)
		};
	}

	function openLayerContextMenu(id: string, clientX: number, clientY: number) {
		selectedId = id;
		const p = clipLayerCtxPos(clientX, clientY);
		layerCtxMenu = { id, x: p.x, y: p.y };
	}

	function closeLayerContextMenu() {
		layerCtxMenu = null;
	}

	async function loadMedia() {
		const { data: rows } = await supabase.from('game_media').select('id, file_path').eq('game_id', data.game.id);
		const m: Record<string, string> = {};
		for (const r of rows ?? []) {
			m[r.id] = publicStorageUrl(r.file_path);
		}
		mediaUrls = m;
	}

	$effect(() => {
		if (!browser) return;
		void data.game.id;
		void loadMedia();
	});

	let lastTemplateId = $state(data.template.id);
	$effect(() => {
		const id = data.template.id;
		if (id === lastTemplateId) return;
		lastTemplateId = id;
		name = data.template.name;
		canvasW = data.template.canvas_width;
		canvasH = data.template.canvas_height;
		borderR = data.template.border_radius;
		frameW = data.template.frame_border_width ?? 0;
		frameColor = data.template.frame_border_color ?? '#000000';
		frameInnerR = data.template.frame_inner_radius ?? null;
		const parsed = parseLayers(data.template.layers as Json);
		layers = parsed;
		background = parseBackground(data.template.background as Json);
		selectedId = parsed[0]?.id ?? null;
		layerCtxMenu = null;
		pieceColorPalette = getPieceColorPaletteFromGameData(data.game.game_data);
	});

	$effect(() => {
		if (!browser) return;
		const id = data.template.id;
		cardBgOpen = readCollapsibleOpen(id, 'cardBg');
		frameOpen = readCollapsibleOpen(id, 'frame');
	});

	$effect(() => {
		if (!browser) return;
		const id = data.template.id;
		writeCollapsibleOpen(id, 'cardBg', cardBgOpen);
		writeCollapsibleOpen(id, 'frame', frameOpen);
	});

	function selectedLayer(): CardLayer | null {
		if (!selectedId) return null;
		return layers.find((l) => l.id === selectedId) ?? null;
	}

	function setLayers(next: CardLayer[]) {
		layers = next;
	}

	function patchLayer(next: CardLayer) {
		layers = layers.map((l) => (l.id === next.id ? next : l));
	}

	async function save() {
		saving = true;
		err = '';
		try {
			const { error } = await supabase
				.from('card_templates')
				.update({
					name: name.trim() || 'Template',
					canvas_width: canvasW,
					canvas_height: canvasH,
					border_radius: borderR,
					frame_border_width: Math.max(0, Math.min(64, Math.round(frameW))),
					frame_border_color: frameColor.trim() || '#000000',
					frame_inner_radius: frameInnerR,
					background: background as unknown as Json,
					layers: layers as unknown as Json,
					updated_at: new Date().toISOString()
				})
				.eq('id', data.template.id);
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
			await supabase.from('card_instances').update({ render_stale: true }).eq('template_id', data.template.id);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Save failed';
		}
		saving = false;
	}

	function addLayer(kind: 'text' | 'image' | 'shape') {
		let L: CardLayer;
		if (kind === 'text') L = defaultTextLayer();
		else if (kind === 'image') L = defaultImageLayer();
		else L = defaultShapeLayer();
		L.zIndex = layers.length ? Math.max(...layers.map((l) => l.zIndex)) + 1 : 0;
		layers = [...layers, L];
		selectedId = L.id;
	}

	function duplicateLayer(id: string) {
		const src = layers.find((l) => l.id === id);
		if (!src) return;
		/* $state layer objects are Proxies; structuredClone throws DataCloneError on Proxy. */
		const copy = JSON.parse(JSON.stringify(src)) as CardLayer;
		copy.id = newId();
		const baseName = src.name.replace(/\s+\(copy\)$/i, '').trimEnd() || src.name;
		copy.name = `${baseName} (copy)`;
		copy.zIndex = layers.length ? Math.max(...layers.map((l) => l.zIndex)) + 1 : 0;
		copy.x = src.x + 8;
		copy.y = src.y + 8;
		layers = [...layers, copy];
		selectedId = copy.id;
	}

	const fieldPreview: Record<string, string> = {};

	const PANEL_STORAGE_KEY = 'templateEditor.panelWidths.v1';

	let leftPanelW = $state(240);
	let rightPanelW = $state(280);

	function clampPanel(n: number, lo: number, hi: number) {
		return Math.min(hi, Math.max(lo, n));
	}

	function persistPanelWidths() {
		if (!browser) return;
		try {
			localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({ left: leftPanelW, right: rightPanelW }));
		} catch {
			/* quota */
		}
	}

	onMount(() => {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(PANEL_STORAGE_KEY);
			if (!raw) return;
			const j = JSON.parse(raw) as { left?: number; right?: number };
			if (typeof j.left === 'number') leftPanelW = clampPanel(j.left, 160, 560);
			if (typeof j.right === 'number') rightPanelW = clampPanel(j.right, 180, 560);
		} catch {
			/* ignore */
		}
	});

	let resizeKind = $state<'left' | 'right' | null>(null);
	let resizeStartX = 0;
	let resizeStartLeft = 0;
	let resizeStartRight = 0;

	function beginResize(which: 'left' | 'right', e: MouseEvent) {
		e.preventDefault();
		resizeKind = which;
		resizeStartX = e.clientX;
		resizeStartLeft = leftPanelW;
		resizeStartRight = rightPanelW;
		window.addEventListener('mousemove', onResizeMove);
		window.addEventListener('mouseup', onResizeUp);
	}

	function onResizeMove(e: MouseEvent) {
		if (!resizeKind) return;
		const dx = e.clientX - resizeStartX;
		if (resizeKind === 'left') {
			leftPanelW = clampPanel(resizeStartLeft + dx, 160, 560);
		} else {
			rightPanelW = clampPanel(resizeStartRight - dx, 180, 560);
		}
	}

	function onResizeUp() {
		if (resizeKind) persistPanelWidths();
		resizeKind = null;
		window.removeEventListener('mousemove', onResizeMove);
		window.removeEventListener('mouseup', onResizeUp);
	}
</script>

<div class="shell">
	<LayerContextMenu
		menu={layerCtxMenu}
		{layers}
		onClose={closeLayerContextMenu}
		renameLayer={(id, name) => {
			layers = layers.map((l) => (l.id === id ? { ...l, name } : l));
		}}
		{duplicateLayer}
		removeLayer={(id) => {
			layers = layers.filter((l) => l.id !== id);
			if (selectedId === id) selectedId = layers[0]?.id ?? null;
		}}
	/>
	<header class="top">
		<input type="text" class="title" bind:value={name} />
		<div class="size">
			<UnitInput label="Width" bind:pxValue={canvasW} />
			<UnitInput label="Height" bind:pxValue={canvasH} />
		</div>
		<button type="button" class="primary" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save template'}</button>
		{#if err}
			<span class="err">{err}</span>
		{/if}
	</header>

	<div class="main" class:resizing={resizeKind !== null}>
		<aside class="left" style:width="{leftPanelW}px">
			<details class="collapsible-panel card-bg-panel" bind:open={cardBgOpen} aria-labelledby="card-bg-heading">
				<summary class="collapsible-summary">
					<h3 id="card-bg-heading" class="card-bg-heading">Card background</h3>
				</summary>
				<div class="collapsible-inner">
				<label class="card-bg-type">
					<span>Type</span>
					<select
						value={background.type}
						onchange={(e) => {
							const t = (e.currentTarget as HTMLSelectElement).value;
							if (t === 'solid') background = { type: 'solid', color: '#1e293b' };
							else if (t === 'gradient') {
								background = {
									type: 'gradient',
									stops: [
										{ offset: 0, color: '#1e293b' },
										{ offset: 1, color: '#0f172a' }
									],
									angle: 135
								};
							} else {
								background = {
									type: 'image',
									mediaId: null,
									objectFit: 'cover',
									objectPosition: 'center',
									fallbackColor: '#1e293b'
								};
							}
						}}
					>
						<option value="solid">Solid color</option>
						<option value="gradient">Gradient</option>
						<option value="image">Image (library or AI)</option>
					</select>
				</label>
				{#if background.type === 'solid'}
					<div class="card-bg-block">
						<span class="mini-label">Color</span>
						<ColorPicker
							value={background.color}
							palette={pieceColorPalette}
							onPaletteChange={setPieceColorPaletteLocal}
							onValueChange={(c: string) => (background = { type: 'solid', color: c })}
						/>
					</div>
				{:else if background.type === 'gradient'}
					<div class="card-bg-block">
						<GradientEditor
							stops={background.stops}
							angle={background.angle}
							palette={pieceColorPalette}
							onPaletteChange={setPieceColorPaletteLocal}
							onChange={(next) => (background = { type: 'gradient', stops: next.stops, angle: next.angle })}
						/>
					</div>
				{:else if background.type === 'image'}
					{@const bg = background}
					<div class="card-bg-block">
						<span class="mini-label">Photo</span>
						<GameMediaImageTools
							compact
							gameId={data.game.id}
							mediaId={bg.mediaId}
							{mediaUrls}
							onMediaIdChange={(id) => {
								background = {
									type: 'image',
									mediaId: id,
									objectFit: bg.objectFit ?? 'cover',
									objectPosition: bg.objectPosition ?? 'center',
									fallbackColor: bg.fallbackColor ?? '#1e293b'
								};
							}}
							onMergeUrls={(m) => {
								mediaUrls = { ...mediaUrls, ...m };
							}}
							onAfterPick={() => {
								void loadMedia();
							}}
						/>
					</div>
					<div class="card-bg-block">
						<span class="mini-label">Color behind image</span>
						<ColorPicker
							value={bg.fallbackColor ?? '#1e293b'}
							palette={pieceColorPalette}
							onPaletteChange={setPieceColorPaletteLocal}
							onValueChange={(c: string) =>
								(background = {
									type: 'image',
									mediaId: bg.mediaId,
									objectFit: bg.objectFit ?? 'cover',
									objectPosition: bg.objectPosition ?? 'center',
									fallbackColor: c
								})}
						/>
					</div>
					<div class="card-bg-block">
						<ImageLayoutControls
							objectFit={bg.objectFit ?? 'cover'}
							objectPosition={bg.objectPosition ?? 'center'}
							fitLabel="Size"
							onFitChange={(fit) =>
								(background = {
									type: 'image',
									mediaId: bg.mediaId,
									objectFit: fit,
									objectPosition: bg.objectPosition ?? 'center',
									fallbackColor: bg.fallbackColor ?? '#1e293b'
								})}
							onPositionChange={(pos) =>
								(background = {
									type: 'image',
									mediaId: bg.mediaId,
									objectFit: bg.objectFit ?? 'cover',
									objectPosition: pos,
									fallbackColor: bg.fallbackColor ?? '#1e293b'
								})}
						/>
					</div>
				{/if}
				</div>
			</details>

			<details class="collapsible-panel frame-panel" bind:open={frameOpen} aria-labelledby="frame-heading">
				<summary class="collapsible-summary">
					<h3 id="frame-heading" class="card-bg-heading">Frame border</h3>
				</summary>
				<div class="collapsible-inner">
				<label class="frame-row">
					<span>Outer radius (px)</span>
					<input type="number" bind:value={borderR} min="0" max="512" step="1" />
				</label>
				<label class="frame-row">
					<span>Thickness (px)</span>
					<input type="number" bind:value={frameW} min="0" max="64" step="1" />
				</label>
				<div class="card-bg-block">
					<span class="mini-label">Color</span>
					<ColorPicker
						value={frameColor}
						palette={pieceColorPalette}
						onPaletteChange={setPieceColorPaletteLocal}
						onValueChange={(c: string) => (frameColor = c)}
					/>
				</div>
				<div class="frame-row">
					<span>Inner radius (px)</span>
					<div class="frame-inner-inputs">
						<input
							type="number"
							min="0"
							max="512"
							step="1"
							placeholder="Auto"
							value={frameInnerR ?? ''}
							oninput={(e) => {
								const raw = (e.currentTarget as HTMLInputElement).value;
								frameInnerR = raw.trim() === '' ? null : Math.max(0, parseInt(raw, 10) || 0);
							}}
						/>
						<button
							type="button"
							class="frame-inner-clear"
							onclick={() => {
								frameInnerR = null;
							}}>Use auto</button
						>
					</div>
				</div>
				</div>
			</details>

			<div class="add">
				<span>Add layer</span>
				<button type="button" onclick={() => addLayer('text')}>Text</button>
				<button type="button" onclick={() => addLayer('image')}>Image</button>
				<button type="button" onclick={() => addLayer('shape')}>Shape</button>
			</div>
			<LayerPanel
				{layers}
				{selectedId}
				selectLayer={(id) => (selectedId = id)}
				reorderLayers={setLayers}
				toggleVisibility={(id) => {
					layers = layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l));
				}}
				toggleLock={(id) => {
					layers = layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l));
				}}
				{openLayerContextMenu}
			/>
		</aside>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="gutter"
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize layers panel"
			onmousedown={(e) => beginResize('left', e)}
		></div>
		<div class="canvas-wrap">
		<TemplateCanvas
			canvasWidth={canvasW}
			canvasHeight={canvasH}
			borderRadius={borderR}
			frameBorderWidth={frameW}
			frameBorderColor={frameColor}
			frameInnerRadius={frameInnerR}
			{background}
			{layers}
			{selectedId}
			{fieldPreview}
			{mediaUrls}
			onCardResize={(s) => {
				canvasW = s.w;
				canvasH = s.h;
			}}
			onLayerSelect={(id) => (selectedId = id)}
			onLayerMove={(id, x, y) => {
				layers = layers.map((l) => (l.id === id ? { ...l, x, y } : l));
			}}
			onLayerResize={(id, next) => {
				layers = layers.map((l) =>
					l.id === id
						? {
								...l,
								x: next.x,
								y: next.y,
								width: Math.max(8, Math.round(next.w)),
								height: Math.max(8, Math.round(next.h))
							}
						: l
				);
			}}
			onLayerContextMenu={(id, e) => {
				e.preventDefault();
				openLayerContextMenu(id, e.clientX, e.clientY);
			}}
		/>
		</div>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="gutter"
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize properties panel"
			onmousedown={(e) => beginResize('right', e)}
		></div>
		<aside class="right" style:width="{rightPanelW}px">
			<LayerProperties
				layer={selectedLayer()}
				onChange={patchLayer}
				pieceColorPalette={pieceColorPalette}
				onPieceColorPaletteChange={setPieceColorPaletteLocal}
				gameMedia={{
					gameId: data.game.id,
					mediaUrls,
					onMergeUrls: (m) => {
						mediaUrls = { ...mediaUrls, ...m };
					},
					onAfterPick: () => {
						void loadMedia();
					}
				}}
			/>
		</aside>
	</div>
</div>

<style>
	.shell {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		width: 100%;
		overflow: hidden;
	}
	.top {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: flex-end;
		padding: 10px 16px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.title {
		font-size: 1.1rem;
		font-weight: 600;
		padding: 8px 10px;
		min-width: 200px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
	}
	.size {
		display: flex;
		gap: 12px;
	}
	.primary {
		padding: 8px 16px;
		border-radius: 6px;
		border: none;
		background: var(--color-accent, #3b82f6);
		color: #fff;
		cursor: pointer;
	}
	.err {
		color: #f87171;
		font-size: 13px;
	}
	.collapsible-panel {
		padding-bottom: 14px;
		margin-bottom: 14px;
		border-bottom: 1px solid var(--color-border);
	}
	.collapsible-summary {
		list-style: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		user-select: none;
	}
	.collapsible-summary::-webkit-details-marker {
		display: none;
	}
	.collapsible-summary::before {
		content: '';
		flex-shrink: 0;
		width: 0;
		height: 0;
		border-top: 5px solid transparent;
		border-bottom: 5px solid transparent;
		border-left: 6px solid var(--color-text-muted);
		transform: rotate(0deg);
		transition: transform 0.12s ease;
	}
	.collapsible-panel[open] .collapsible-summary::before {
		transform: rotate(90deg);
	}
	.collapsible-summary .card-bg-heading {
		margin: 0;
	}
	.collapsible-inner {
		padding-top: 4px;
	}
	.card-bg-heading {
		margin: 0 0 4px;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text);
	}
	.card-bg-type {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.card-bg-type select {
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
		font-size: 13px;
	}
	.card-bg-block {
		margin-bottom: 12px;
	}
	.card-bg-block:last-child {
		margin-bottom: 0;
	}
	.mini-label {
		display: block;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		margin-bottom: 6px;
	}
	.frame-row {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.frame-row input {
		max-width: 96px;
		padding: 6px 8px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
	}
	.frame-inner-inputs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.frame-inner-clear {
		padding: 5px 10px;
		font-size: 11px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
	}
	.main {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: row;
		align-items: stretch;
	}
	.main.resizing {
		cursor: col-resize;
		user-select: none;
	}
	.left,
	.right {
		flex-shrink: 0;
		overflow: auto;
		padding: 12px;
		min-width: 0;
		box-sizing: border-box;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
	}
	.canvas-wrap {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.right {
		border-right: none;
		border-left: none;
	}
	.gutter {
		flex-shrink: 0;
		width: 6px;
		margin: 0 -3px;
		cursor: col-resize;
		background: transparent;
		position: relative;
		z-index: 2;
	}
	.gutter:hover {
		background: rgba(59, 130, 246, 0.15);
	}
	.gutter::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		width: 1px;
		transform: translateX(-50%);
		background: var(--color-border);
		pointer-events: none;
	}
	.add {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-bottom: 12px;
		font-size: 13px;
	}
	.add button {
		padding: 6px 10px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
		cursor: pointer;
		font-size: 12px;
	}
</style>
