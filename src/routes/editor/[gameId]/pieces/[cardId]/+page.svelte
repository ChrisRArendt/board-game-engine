<script lang="ts">
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import CardPreview from '$lib/components/editor/CardPreview.svelte';
	import AIGenerateModal from '$lib/components/editor/AIGenerateModal.svelte';
	import { collectFieldBindings } from '$lib/editor/fieldBindings';
	import { parseBackground, parseLayers } from '$lib/editor/types';
	import { rasterizeElementToPng } from '$lib/editor/rasterize';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import { downloadBlob } from '$lib/editor/printExport';
	import MediaPickerModal from '$lib/components/editor/MediaPickerModal.svelte';
	import type { Json } from '$lib/supabase/database.types';
	import type { PageData } from './$types';
	import { browser } from '$app/environment';

	let { data }: { data: PageData } = $props();

	const supabase = createSupabaseBrowserClient();

	function initialFieldValues(): Record<string, string> {
		const out: Record<string, string> = {};
		try {
			const raw = data.card.field_values as Record<string, unknown>;
			for (const [k, v] of Object.entries(raw)) {
				out[k] = typeof v === 'string' ? v : String(v ?? '');
			}
		} catch {
			/* empty */
		}
		return out;
	}

	let name = $state(data.card.name);
	let fieldValues = $state<Record<string, string>>(initialFieldValues());

	const bindings = collectFieldBindings(parseLayers(data.template.layers as Json));

	let previewEl: HTMLDivElement | undefined;
	let saving = $state(false);
	let aiOpen = $state(false);
	let aiFieldKey = $state<string | null>(null);
	let pickerOpen = $state(false);
	let pickerFieldKey = $state<string | null>(null);
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
			const { error } = await supabase
				.from('card_instances')
				.update({
					name: name.trim() || 'Card',
					field_values: fieldValues as unknown as Json,
					updated_at: new Date().toISOString()
				})
				.eq('id', data.card.id);
			if (error) throw error;
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
			downloadBlob(blob, `${(name || 'card').replace(/\s+/g, '-')}-print-300dpi.png`);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Export failed';
		}
		saving = false;
	}
</script>

<div class="page">
	<h1>Edit card</h1>
	<p class="meta">Template: {data.template.name}</p>

	<label class="field">
		<span>Name</span>
		<input type="text" bind:value={name} />
	</label>

	{#each bindings as b}
		<div class="field">
			<span>{b.fieldLabel}</span>
			{#if b.fieldType === 'textarea'}
				<textarea bind:value={fieldValues[b.fieldName]} rows="3"></textarea>
			{:else if b.fieldType === 'image'}
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
			{:else}
				<input
					type={bindingInputType(b.fieldType)}
					bind:value={fieldValues[b.fieldName]}
				/>
			{/if}
		</div>
	{/each}

	{#if err}
		<p class="err">{err}</p>
	{/if}

	<div class="actions">
		<button type="button" class="btn" disabled={saving} onclick={save}>Save fields</button>
		<button type="button" class="btn primary" disabled={saving} onclick={renderPng}>Render to PNG (game)</button>
		<button type="button" class="btn" disabled={saving} onclick={renderPrintPng}>Download print PNG (300 DPI)</button>
	</div>

	<h2>Preview</h2>
	<div class="preview-wrap" bind:this={previewEl}>
		<CardPreview
			width={data.template.canvas_width}
			height={data.template.canvas_height}
			borderRadius={data.template.border_radius}
			background={parseBackground(data.template.background as Json)}
			layers={parseLayers(data.template.layers as Json)}
			{fieldValues}
			{mediaUrls}
		/>
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
		}
		aiOpen = false;
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
	onPick={(id) => {
		if (pickerFieldKey) {
			fieldValues = { ...fieldValues, [pickerFieldKey]: id };
		}
		pickerOpen = false;
		void loadMedia();
	}}
/>

<style>
	.page {
		padding: 1.25rem 1.5rem;
		max-width: 720px;
		color: var(--color-text);
	}
	h1 {
		margin-top: 0;
	}
	h2 {
		font-size: 1rem;
		margin-top: 1.5rem;
	}
	.meta {
		color: var(--color-text-muted);
		font-size: 14px;
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
	.btn {
		padding: 8px 14px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
		margin-right: 8px;
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
		background: #111;
		border-radius: 8px;
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
</style>
