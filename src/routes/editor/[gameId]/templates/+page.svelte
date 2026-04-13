<script lang="ts">
	import { goto } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { inToPx } from '$lib/editor/units';
	import type { PageData } from './$types';

	export let data: PageData;

	const supabase = createSupabaseBrowserClient();

	let busy = false;

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
</script>

<div class="page">
	<h1>Card templates</h1>
	<button type="button" class="btn primary" disabled={busy} onclick={createTemplate}>New template</button>
	<ul class="list">
		{#each data.templates as t}
			<li>
				<a href="/editor/{data.game.id}/templates/{t.id}">{t.name}</a>
				<span class="muted">{t.canvas_width}×{t.canvas_height}px</span>
			</li>
		{:else}
			<li class="muted">No templates yet.</li>
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
		gap: 12px;
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
