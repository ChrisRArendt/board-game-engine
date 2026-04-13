<script lang="ts">
	import AIGenerateModal from './AIGenerateModal.svelte';
	import MediaPickerModal from './MediaPickerModal.svelte';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';

	let {
		gameId,
		mediaId,
		mediaUrls,
		onMediaIdChange,
		onMergeUrls,
		onAfterPick,
		compact = false
	}: {
		gameId: string;
		mediaId: string | null;
		mediaUrls: Record<string, string>;
		onMediaIdChange: (id: string | null) => void;
		onMergeUrls: (urls: Record<string, string>) => void;
		/** e.g. refresh `game_media` map from Supabase */
		onAfterPick?: () => void;
		compact?: boolean;
	} = $props();

	let pickerOpen = $state(false);
	let aiOpen = $state(false);

	function afterPick() {
		onAfterPick?.();
	}
</script>

<div class="tools" class:compact>
	{#if mediaId && mediaUrls[mediaId]}
		<img class="thumb" src={mediaUrls[mediaId]} alt="" />
	{:else}
		<div class="thumb ph">No image</div>
	{/if}
	<div class="actions">
		<button
			type="button"
			class="btn"
			onclick={() => {
				pickerOpen = true;
			}}>Choose from library</button
		>
		<button
			type="button"
			class="btn"
			onclick={() => {
				aiOpen = true;
			}}>Generate with AI</button
		>
		{#if mediaId}
			<button
				type="button"
				class="btn"
				onclick={() => {
					onMediaIdChange(null);
				}}>Clear</button
			>
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
	.thumb {
		width: 72px;
		height: 96px;
		object-fit: cover;
		border-radius: 6px;
		border: 1px solid var(--color-border, #333);
		background: #111;
		flex-shrink: 0;
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
	.btn:hover {
		filter: brightness(1.08);
	}
</style>
