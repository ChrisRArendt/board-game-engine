<script lang="ts">
	import AIGenerateModal from './AIGenerateModal.svelte';
	import MediaPickerModal from './MediaPickerModal.svelte';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import { uploadImageToGameLibrary } from '$lib/editor/uploadGameMedia';

	let {
		gameId,
		mediaId,
		mediaUrls,
		onMediaIdChange,
		onMergeUrls,
		onAfterPick,
		compact = false,
		/** When no library row matches (e.g. legacy table-bg.jpg), show this preview URL. */
		fallbackThumbUrl = null
	}: {
		gameId: string;
		mediaId: string | null;
		mediaUrls: Record<string, string>;
		onMediaIdChange: (id: string | null) => void | Promise<void>;
		onMergeUrls: (urls: Record<string, string>) => void;
		/** e.g. refresh `game_media` map from Supabase */
		onAfterPick?: () => void;
		compact?: boolean;
		fallbackThumbUrl?: string | null;
	} = $props();

	const supabase = createSupabaseBrowserClient();

	let pickerOpen = $state(false);
	let aiOpen = $state(false);
	let busy = $state(false);
	let err = $state('');
	let dragOver = $state(false);

	const fileInputId = `gmt-${crypto.randomUUID()}`;

	function afterPick() {
		onAfterPick?.();
	}

	async function handleFile(file: File | undefined) {
		if (!file || !file.type.startsWith('image/')) return;
		busy = true;
		err = '';
		try {
			const { mediaId: newId, filePath } = await uploadImageToGameLibrary(supabase, gameId, file);
			onMediaIdChange(newId);
			onMergeUrls({ [newId]: publicStorageUrl(filePath) });
			afterPick();
		} catch (e) {
			err = e instanceof Error ? e.message : 'Upload failed';
		}
		busy = false;
	}

	function onFileInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		void handleFile(f);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const f = e.dataTransfer?.files?.[0];
		void handleFile(f);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}
</script>

<div class="tools" class:compact>
	<div
		class="drop-target"
		class:drag-over={dragOver}
		class:busy
		role="group"
		aria-label="Image: click or drop to upload to library"
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<input
			id={fileInputId}
			type="file"
			accept="image/*"
			class="sr-only"
			disabled={busy}
			onchange={onFileInput}
		/>
		<label
			for={fileInputId}
			class="thumb-label"
			title="Click or drop an image to upload to your library"
		>
			{#if mediaId && mediaUrls[mediaId]}
				<img
					class="thumb"
					src={mediaUrls[mediaId]}
					alt=""
					draggable="false"
				/>
			{:else if fallbackThumbUrl}
				<img class="thumb" src={fallbackThumbUrl} alt="" draggable="false" />
			{:else}
				<div class="thumb ph">No image</div>
			{/if}
			{#if busy}
				<div class="thumb-busy" aria-live="polite">Uploading…</div>
			{/if}
		</label>
	</div>
	<div class="actions">
		<button
			type="button"
			class="btn"
			disabled={busy}
			onclick={() => {
				pickerOpen = true;
			}}>Choose from library</button
		>
		<button
			type="button"
			class="btn"
			disabled={busy}
			onclick={() => {
				aiOpen = true;
			}}>Generate with AI</button
		>
		{#if mediaId}
			<button
				type="button"
				class="btn"
				disabled={busy}
				onclick={() => {
					onMediaIdChange(null);
				}}>Clear</button
			>
		{/if}
		{#if err}
			<p class="field-err">{err}</p>
		{/if}
	</div>
</div>

<MediaPickerModal
	open={pickerOpen}
	{gameId}
	onClose={() => {
		pickerOpen = false;
	}}
	onPick={(id, filePath) => {
		onMediaIdChange(id);
		if (filePath) onMergeUrls({ [id]: publicStorageUrl(filePath) });
		pickerOpen = false;
		afterPick();
	}}
/>

<AIGenerateModal
	open={aiOpen}
	{gameId}
	onClose={() => {
		aiOpen = false;
	}}
	onPick={(r) => {
		onMediaIdChange(r.mediaId);
		onMergeUrls({ [r.mediaId]: r.publicUrl });
		aiOpen = false;
		afterPick();
	}}
/>

<style>
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 12px;
	}
	.tools.compact {
		gap: 8px;
	}
	.drop-target {
		position: relative;
		flex-shrink: 0;
		border-radius: 8px;
		outline: 2px solid transparent;
		outline-offset: 2px;
		transition:
			outline-color 0.12s ease,
			box-shadow 0.12s ease;
	}
	.drop-target.drag-over {
		outline-color: var(--color-accent, #3b82f6);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
	}
	.drop-target.busy .thumb-label {
		pointer-events: none;
		cursor: wait;
	}
	.thumb-label {
		position: relative;
		display: block;
		width: 72px;
		height: 96px;
		cursor: pointer;
		margin: 0;
		border-radius: 6px;
		overflow: hidden;
	}
	.thumb {
		width: 72px;
		height: 96px;
		object-fit: cover;
		border-radius: 6px;
		border: 1px solid var(--color-border, #333);
		background: #111;
		display: block;
	}
	.thumb.ph {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		color: var(--color-text-muted, #888);
		padding: 6px;
		text-align: center;
		box-sizing: border-box;
		width: 72px;
		height: 96px;
		border-radius: 6px;
		border: 1px dashed var(--color-border, #444);
		background: rgba(0, 0, 0, 0.2);
	}
	.thumb-busy {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
		font-size: 11px;
		font-weight: 500;
		border-radius: 6px;
		pointer-events: none;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.actions {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		min-width: 0;
	}
	.btn {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border, #444);
		background: var(--color-surface, #1a1a1a);
		color: inherit;
		cursor: pointer;
		font-size: 12px;
	}
	.btn:hover:not(:disabled) {
		filter: brightness(1.08);
	}
	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.field-err {
		margin: 0;
		font-size: 11px;
		line-height: 1.35;
		color: #f87171;
		max-width: 220px;
	}
</style>
