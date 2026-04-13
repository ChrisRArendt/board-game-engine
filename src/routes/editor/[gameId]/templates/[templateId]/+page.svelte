<script lang="ts">
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import TemplateCanvas from '$lib/components/editor/TemplateCanvas.svelte';
	import LayerPanel from '$lib/components/editor/LayerPanel.svelte';
	import LayerProperties from '$lib/components/editor/LayerProperties.svelte';
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
		defaultShapeLayer
	} from '$lib/editor/types';
	import type { Json } from '$lib/supabase/database.types';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';

	let { data }: { data: PageData } = $props();

	const supabase = createSupabaseBrowserClient();

	let name = $state(data.template.name);
	let canvasW = $state(data.template.canvas_width);
	let canvasH = $state(data.template.canvas_height);
	let borderR = $state(data.template.border_radius);
	const initialLayers = parseLayers(data.template.layers as Json);
	let background = $state(parseBackground(data.template.background as Json));
	let layers = $state(initialLayers);
	let selectedId = $state<string | null>(initialLayers[0]?.id ?? null);
	let saving = $state(false);
	let err = $state('');

	let mediaUrls = $state<Record<string, string>>({});

	async function loadMedia() {
		const { data: rows } = await supabase.from('game_media').select('id, file_path').eq('game_id', data.game.id);
		const m: Record<string, string> = {};
		for (const r of rows ?? []) {
			m[r.id] = publicStorageUrl(r.file_path);
		}
		mediaUrls = m;
	}

	$effect(() => {
		void loadMedia();
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
					background: background as unknown as Json,
					layers: layers as unknown as Json,
					updated_at: new Date().toISOString()
				})
				.eq('id', data.template.id);
			if (error) throw error;
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

	const fieldPreview: Record<string, string> = {};
</script>

<div class="shell">
	<header class="top">
		<input type="text" class="title" bind:value={name} />
		<div class="size">
			<UnitInput label="Width" bind:pxValue={canvasW} />
			<UnitInput label="Height" bind:pxValue={canvasH} />
		</div>
		<label class="br">
			Corner radius (px)
			<input type="number" bind:value={borderR} min="0" />
		</label>
		<button type="button" class="primary" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save template'}</button>
		{#if err}
			<span class="err">{err}</span>
		{/if}
	</header>

	<div class="bg-row">
		<span>Background</span>
		<select
			value={background.type}
			onchange={(e) => {
				const t = (e.currentTarget as HTMLSelectElement).value;
				if (t === 'solid') background = { type: 'solid', color: '#1e293b' };
				else background = { type: 'gradient', stops: [{ offset: 0, color: '#1e293b' }, { offset: 1, color: '#0f172a' }], angle: 135 };
			}}
		>
			<option value="solid">Solid</option>
			<option value="gradient">Gradient</option>
		</select>
		{#if background.type === 'solid'}
			<ColorPicker
				value={background.color}
				onValueChange={(c) => (background = { type: 'solid', color: c })}
			/>
		{:else}
			<GradientEditor
				stops={background.stops}
				angle={background.angle}
				onChange={(next) => (background = { type: 'gradient', stops: next.stops, angle: next.angle })}
			/>
		{/if}
	</div>

	<div class="main">
		<aside class="left">
			<div class="add">
				<span>Add layer</span>
				<button type="button" onclick={() => addLayer('text')}>Text</button>
				<button type="button" onclick={() => addLayer('image')}>Image</button>
				<button type="button" onclick={() => addLayer('shape')}>Shape</button>
			</div>
			<LayerPanel
				{layers}
				{selectedId}
				onSelect={(id) => (selectedId = id)}
				onReorder={setLayers}
				onToggleVis={(id) => {
					layers = layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l));
				}}
				onToggleLock={(id) => {
					layers = layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l));
				}}
				onDelete={(id) => {
					layers = layers.filter((l) => l.id !== id);
					if (selectedId === id) selectedId = layers[0]?.id ?? null;
				}}
			/>
		</aside>
		<TemplateCanvas
			canvasWidth={canvasW}
			canvasHeight={canvasH}
			borderRadius={borderR}
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
		/>
		<aside class="right">
			<LayerProperties layer={selectedLayer()} onChange={patchLayer} />
		</aside>
	</div>
</div>

<style>
	.shell {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 96px);
		min-height: 400px;
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
	.br input {
		width: 72px;
		margin-left: 8px;
		padding: 6px;
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
	.bg-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		padding: 10px 16px;
		border-bottom: 1px solid var(--color-border);
		font-size: 14px;
	}
	.main {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 240px 1fr 280px;
	}
	.left,
	.right {
		overflow: auto;
		padding: 12px;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
	}
	.right {
		border-right: none;
		border-left: 1px solid var(--color-border);
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
