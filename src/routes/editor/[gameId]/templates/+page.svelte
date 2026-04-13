<script lang="ts">
	import { goto } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { inToPx } from '$lib/editor/units';
	import type { PageData } from './$types';

	export let data: PageData;

	const supabase = createSupabaseBrowserClient();

	let busy = false;
	let duplicatingId: string | null = null;

	async function createTemplate() {
		busy = true;
		try {
			const { data: row, error } = await supabase
				.from('card_templates')
				.insert({
					game_id: data.game.id,
					name: 'New template',
					canvas_width: inToPx(2.5),
					canvas_height: inToPx(3.5),
					border_radius: 8,
					background: { type: 'solid', color: '#1e293b' },
					layers: []
				})
				.select('id')
				.single();
			if (error) throw error;
			await goto(`/editor/${data.game.id}/templates/${row.id}`);
		} catch (e) {
			console.error(e);
		}
		busy = false;
	}

	async function duplicateTemplate(sourceId: string) {
		if (busy || duplicatingId) return;
		duplicatingId = sourceId;
		try {
			const { data: row, error: fetchErr } = await supabase
				.from('card_templates')
				.select('*')
				.eq('id', sourceId)
				.eq('game_id', data.game.id)
				.single();
			if (fetchErr || !row) throw fetchErr ?? new Error('Template not found');

			const baseName = row.name?.trim() || 'Template';
			const { data: inserted, error: insErr } = await supabase
				.from('card_templates')
				.insert({
					game_id: data.game.id,
					name: `${baseName} (copy)`,
					canvas_width: row.canvas_width,
					canvas_height: row.canvas_height,
					border_radius: row.border_radius,
					frame_border_width: row.frame_border_width,
					frame_border_color: row.frame_border_color,
					frame_inner_radius: row.frame_inner_radius,
					background: row.background,
					layers: row.layers,
					back_background: row.back_background ?? null,
					back_layers: row.back_layers ?? null
				})
				.select('id')
				.single();
			if (insErr || !inserted) throw insErr ?? new Error('Duplicate failed');
			await goto(`/editor/${data.game.id}/templates/${inserted.id}`);
		} catch (e) {
			console.error(e);
		} finally {
			duplicatingId = null;
		}
	}
</script>

<div class="page editor-page-scroll">
	<h1>Piece templates</h1>
	<button type="button" class="btn primary" disabled={busy || duplicatingId !== null} onclick={createTemplate}>
		New template
	</button>
	<ul class="list">
		{#each data.templates as t}
			<li>
				<div class="row-main">
					<a href="/editor/{data.game.id}/templates/{t.id}">{t.name}</a>
					<span class="muted">{t.canvas_width}×{t.canvas_height}px</span>
				</div>
				<button
					type="button"
					class="btn dup"
					disabled={busy || duplicatingId !== null}
					onclick={() => duplicateTemplate(t.id)}
				>
					{duplicatingId === t.id ? 'Duplicating…' : 'Duplicate'}
				</button>
			</li>
		{:else}
			<li class="muted">No piece templates yet.</li>
		{/each}
	</ul>
</div>

<style>
	.page {
		padding: 1.25rem 1.5rem;
		max-width: 640px;
		color: var(--color-text);
	}
	h1 {
		margin-top: 0;
	}
	.btn {
		padding: 8px 16px;
		margin-bottom: 1rem;
		border-radius: 6px;
		border: none;
		background: var(--color-accent, #3b82f6);
		color: #fff;
		cursor: pointer;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.list li {
		padding: 10px 0;
		border-bottom: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.row-main {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
	}
	.btn.dup {
		padding: 6px 12px;
		font-size: 13px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
		flex-shrink: 0;
	}
	.btn.dup:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.list a {
		color: var(--color-accent, #3b82f6);
		font-weight: 500;
	}
	.muted {
		font-size: 13px;
		opacity: 0.75;
	}
</style>
