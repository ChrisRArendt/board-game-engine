<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { insertCustomBoardGame, listMyCustomGames } from '$lib/customGames';
	import type { GameDataJson } from '$lib/engine/types';
	import type { PageData } from './$types';

	export let data: PageData;

	const supabase = createSupabaseBrowserClient();

	let games: Awaited<ReturnType<typeof listMyCustomGames>> = [];
	let loading = true;
	let err = '';
	let creating = false;

	const emptyGame = (): GameDataJson => ({
		table: { size: { w: 3000, h: 3000 } },
		/** Table background is the full-bleed surface; pieces are added separately (no duplicate “board” on top). */
		pieces: []
	});

	function uid() {
		const s = data.session;
		if (!s?.user?.id) throw new Error('Not signed in');
		return s.user.id;
	}

	async function refresh() {
		loading = true;
		err = '';
		try {
			games = await listMyCustomGames(supabase, uid());
		} catch (e) {
			err = e instanceof Error ? e.message : 'Error';
		}
		loading = false;
	}

	async function createGame() {
		creating = true;
		err = '';
		try {
			const row = await insertCustomBoardGame(supabase, {
				creatorId: uid(),
				title: 'Untitled game',
				description: '',
				gameData: emptyGame()
			});
			await goto(`/editor/${row.id}`);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Create failed';
		}
		creating = false;
	}

	onMount(refresh);
</script>

<div class="page editor-page-scroll">
	<h1>Board games</h1>
	<p class="lead">Create and edit games, board layout, piece templates, and media.</p>
	{#if err}
		<p class="err">{err}</p>
	{/if}
	<button type="button" class="btn primary" disabled={creating || loading} onclick={createGame}>
		{creating ? 'Creating…' : 'New game'}
	</button>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else}
		<ul class="list">
			{#each games as g}
				<li>
					<a href="/editor/{g.id}">{g.title}</a>
					<span class="muted">{g.game_key}</span>
				</li>
			{:else}
				<li class="muted">No custom games yet.</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 1.5rem;
		color: var(--color-text);
	}
	h1 {
		margin-top: 0;
	}
	.lead {
		color: var(--color-text-muted);
		margin-bottom: 1rem;
	}
	.btn {
		padding: 0.6rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		cursor: pointer;
		margin-bottom: 1.5rem;
	}
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
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
		align-items: baseline;
	}
	.list a {
		font-weight: 500;
		color: var(--color-accent, #3b82f6);
	}
	.muted {
		opacity: 0.7;
		font-size: 0.9rem;
	}
	.err {
		color: #f87171;
	}
</style>
