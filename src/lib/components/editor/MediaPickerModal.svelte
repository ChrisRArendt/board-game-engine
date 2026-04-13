<script lang="ts">
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import type { Database } from '$lib/supabase/database.types';

	type MediaRow = Database['public']['Tables']['game_media']['Row'];

	let {
		open = false,
		gameId,
		onClose,
		onPick
	}: {
		open?: boolean;
		gameId: string;
		onClose: () => void;
		onPick: (mediaId: string) => void;
	} = $props();

	const supabase = createSupabaseBrowserClient();

	let media = $state<MediaRow[]>([]);
	let loading = $state(false);

	async function load() {
		loading = true;
		const { data } = await supabase
			.from('game_media')
			.select('*')
			.eq('game_id', gameId)
			.order('created_at', { ascending: false });
		media = data ?? [];
		loading = false;
	}

	$effect(() => {
		if (open) void load();
	});

	function onWinKey(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onWinKey} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={onClose} role="presentation">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="panel" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()} tabindex="-1">
			<h2>Choose image</h2>
			{#if loading}
				<p class="muted">Loading…</p>
			{:else if !media.length}
				<p class="muted">No media yet. Upload in the Media library.</p>
			{:else}
				<div class="grid">
					{#each media as m (m.id)}
						<button
							type="button"
							class="cell"
							onclick={() => {
								onPick(m.id);
								onClose();
							}}
						>
							<img src={publicStorageUrl(m.file_path)} alt={m.filename} loading="lazy" />
							<span class="cap">{m.filename}</span>
						</button>
					{/each}
				</div>
			{/if}
			<div class="actions">
				<button type="button" class="btn" onclick={onClose}>Cancel</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		z-index: 1200;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.panel {
		background: var(--color-surface, #1a1a1a);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		max-width: min(920px, 100vw);
		max-height: min(80vh, 720px);
		overflow: auto;
		padding: 1rem 1.25rem;
		color: var(--color-text);
	}
	h2 {
		margin: 0 0 12px;
		font-size: 1.1rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 10px;
	}
	.cell {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
		background: var(--color-bg);
		cursor: pointer;
		color: inherit;
		text-align: left;
	}
	.cell img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		display: block;
	}
	.cap {
		padding: 6px 8px;
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.actions {
		margin-top: 14px;
		display: flex;
		justify-content: flex-end;
	}
	.btn {
		padding: 8px 16px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
	}
	.muted {
		opacity: 0.75;
		font-size: 14px;
	}
</style>
