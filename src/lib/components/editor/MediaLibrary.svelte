<script lang="ts">
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import AIGenerateModal from './AIGenerateModal.svelte';
	import type { Database } from '$lib/supabase/database.types';

	type MediaRow = Database['public']['Tables']['game_media']['Row'];

	let {
		gameId,
		media,
		usedMediaIds = [],
		onChanged
	}: {
		gameId: string;
		media: MediaRow[];
		/** IDs referenced by templates or card image fields */
		usedMediaIds?: string[];
		onChanged: () => void;
	} = $props();

	const used = $derived(new Set(usedMediaIds));

	const supabase = createSupabaseBrowserClient();

	let filter = $state<'all' | 'upload' | 'ai' | 'used' | 'unused'>('all');
	let aiOpen = $state(false);
	let busy = $state(false);
	let err = $state('');
	let detail = $state<MediaRow | null>(null);
	let dragOver = $state(false);

	const filtered = $derived(
		media.filter((m) => {
			if (filter === 'upload') return m.source_type === 'upload';
			if (filter === 'ai') return m.source_type === 'ai_generated';
			if (filter === 'used') return used.has(m.id);
			if (filter === 'unused') return !used.has(m.id);
			return true;
		})
	);

	async function del(m: MediaRow) {
		if (!confirm('Delete this file from storage and library?')) return;
		busy = true;
		err = '';
		try {
			const { error: rErr } = await supabase.from('game_media').delete().eq('id', m.id);
			if (rErr) throw rErr;
			const { error: sErr } = await supabase.storage.from('custom-game-assets').remove([m.file_path]);
			if (sErr) console.warn(sErr);
			if (detail?.id === m.id) detail = null;
			onChanged();
		} catch (e) {
			err = e instanceof Error ? e.message : 'Delete failed';
		}
		busy = false;
	}

	async function onUploadFiles(files: FileList | null) {
		if (!files?.length) return;
		busy = true;
		err = '';
		try {
			const { data: u } = await supabase.auth.getUser();
			const uid = u.user?.id;
			if (!uid) throw new Error('Not signed in');
			for (const file of Array.from(files)) {
				const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
				const fname = `upload_${crypto.randomUUID()}${ext}`;
				const path = `${uid}/${gameId}/media/${fname}`;
				const { error: upErr } = await supabase.storage.from('custom-game-assets').upload(path, file, {
					contentType: file.type || undefined
				});
				if (upErr) throw upErr;
				const { error: insErr } = await supabase.from('game_media').insert({
					game_id: gameId,
					creator_id: uid,
					file_path: path,
					filename: file.name,
					source_type: 'upload',
					ai_prompt: null
				});
				if (insErr) throw insErr;
			}
			onChanged();
		} catch (e) {
			err = e instanceof Error ? e.message : 'Upload failed';
		}
		busy = false;
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}
	function onDragLeave() {
		dragOver = false;
	}
	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const dt = e.dataTransfer;
		if (dt?.files?.length) void onUploadFiles(dt.files);
	}
</script>

<div class="lib">
	<div class="bar">
		<div class="filters">
			<button type="button" class:active={filter === 'all'} onclick={() => (filter = 'all')}>All</button>
			<button type="button" class:active={filter === 'upload'} onclick={() => (filter = 'upload')}>
				Uploaded
			</button>
			<button type="button" class:active={filter === 'ai'} onclick={() => (filter = 'ai')}>AI</button>
			<button type="button" class:active={filter === 'used'} onclick={() => (filter = 'used')}>
				Used in cards
			</button>
			<button type="button" class:active={filter === 'unused'} onclick={() => (filter = 'unused')}>
				Unused
			</button>
		</div>
		<div class="actions">
			<label class="btn">
				<input
					type="file"
					accept="image/*"
					multiple
					class="hid"
					disabled={busy}
					onchange={(e) => void onUploadFiles((e.currentTarget as HTMLInputElement).files)}
				/>
				Upload
			</label>
			<button type="button" class="btn primary" disabled={busy} onclick={() => (aiOpen = true)}>
				Generate with AI
			</button>
		</div>
	</div>
	{#if err}<p class="err">{err}</p>{/if}

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="drop"
		class:drag={dragOver}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
		role="region"
		aria-label="Media grid, drop files to upload"
	>
		{#if dragOver}
			<p class="drop-hint">Drop images to upload</p>
		{/if}
		<div class="grid">
			{#each filtered as m (m.id)}
				<figure class="cell">
					<button
						type="button"
						class="thumb"
						onclick={() => (detail = m)}
						aria-label="View {m.filename}"
					>
						<img src={publicStorageUrl(m.file_path)} alt="" loading="lazy" />
					</button>
					<figcaption>
						<span class="name">{m.filename}</span>
						<span class="meta"
							>{m.source_type}{#if m.width != null && m.height != null}&nbsp;· {m.width}×{m.height}{/if}</span
						>
						<button type="button" class="del" disabled={busy} onclick={() => void del(m)}>Delete</button>
					</figcaption>
				</figure>
			{:else}
				<p class="empty">No media in this filter.</p>
			{/each}
		</div>
	</div>
</div>

{#if detail}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="lightbox" onclick={() => (detail = null)} role="presentation">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="lightbox-inner"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<button type="button" class="close" onclick={() => (detail = null)} aria-label="Close">×</button>
			<img src={publicStorageUrl(detail.file_path)} alt={detail.filename} class="full" />
			<div class="meta-block">
				<p><strong>{detail.filename}</strong></p>
				<p>Source: {detail.source_type}</p>
				{#if detail.ai_prompt}
					<p class="prompt">Prompt: {detail.ai_prompt}</p>
				{/if}
				<p>
					{#if detail.width != null && detail.height != null}
						{detail.width} × {detail.height} px
					{:else}
						Dimensions unknown
					{/if}
				</p>
				<p>Created: {new Date(detail.created_at).toLocaleString()}</p>
				<p class="id">ID: {detail.id}</p>
			</div>
		</div>
	</div>
{/if}

<AIGenerateModal
	open={aiOpen}
	{gameId}
	onClose={() => (aiOpen = false)}
	onPick={() => {
		aiOpen = false;
		onChanged();
	}}
/>

<style>
	.lib {
		padding: 1rem 1.25rem;
		color: var(--color-text);
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.filters button {
		padding: 6px 12px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
		font-size: 13px;
	}
	.filters button.active {
		border-color: var(--color-accent, #3b82f6);
		color: var(--color-accent, #3b82f6);
	}
	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.btn {
		padding: 8px 14px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
		font-size: 14px;
	}
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
	}
	.hid {
		display: none;
	}
	.drop {
		border: 2px dashed transparent;
		border-radius: 10px;
		padding: 8px;
		min-height: 120px;
		transition: border-color 0.15s, background 0.15s;
	}
	.drop.drag {
		border-color: var(--color-accent, #3b82f6);
		background: rgba(59, 130, 246, 0.08);
	}
	.drop-hint {
		text-align: center;
		padding: 12px;
		font-weight: 600;
		color: var(--color-accent, #3b82f6);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 12px;
	}
	.cell {
		margin: 0;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
		background: var(--color-surface);
	}
	.thumb {
		display: block;
		width: 100%;
		padding: 0;
		border: none;
		cursor: zoom-in;
		background: #111;
	}
	.thumb img {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
	}
	.cell figcaption {
		padding: 8px;
		font-size: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.name {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		opacity: 0.7;
		font-size: 11px;
	}
	.del {
		align-self: flex-start;
		margin-top: 4px;
		padding: 4px 8px;
		font-size: 12px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: #f87171;
		cursor: pointer;
	}
	.empty {
		grid-column: 1 / -1;
		opacity: 0.7;
		padding: 24px;
		text-align: center;
	}
	.err {
		color: #f87171;
	}
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 1100;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		overflow: auto;
	}
	.lightbox-inner {
		position: relative;
		max-width: min(960px, 100%);
		background: var(--color-surface);
		border-radius: 10px;
		padding: 16px;
		color: var(--color-text);
	}
	.close {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 36px;
		height: 36px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
		font-size: 22px;
		line-height: 1;
		cursor: pointer;
		z-index: 1;
	}
	.full {
		display: block;
		max-width: 100%;
		max-height: min(70vh, 800px);
		margin: 0 auto;
		object-fit: contain;
	}
	.meta-block {
		margin-top: 12px;
		font-size: 14px;
		line-height: 1.5;
	}
	.meta-block p {
		margin: 6px 0;
	}
	.prompt {
		white-space: pre-wrap;
		word-break: break-word;
	}
	.id {
		font-size: 11px;
		opacity: 0.7;
		font-family: ui-monospace, monospace;
	}
</style>
