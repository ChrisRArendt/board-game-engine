<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import {
		customGameCoverPublicUrl,
		DEFAULT_CUSTOM_GAME_COVER_URL,
		insertCustomBoardGame,
		listMyCustomGames
	} from '$lib/customGames';
	import type { GameDataJson } from '$lib/engine/types';
	import type { PageData } from './$types';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import type { Database } from '$lib/supabase/database.types';

	export let data: PageData;

	const supabase = createSupabaseBrowserClient();

	type GameRow = Database['public']['Tables']['custom_board_games']['Row'];

	let games: GameRow[] = [];
	let loading = true;
	let err = '';
	let creating = false;

	const emptyGame = (): GameDataJson => ({
		table: { size: { w: 3000, h: 3000 } },
		pieces: []
	});

	function uid() {
		const s = data.session;
		if (!s?.user?.id) throw new Error('Not signed in');
		return s.user.id;
	}

	function coverUrl(g: GameRow): string {
		return g.cover_image_path
			? customGameCoverPublicUrl(PUBLIC_SUPABASE_URL, g.cover_image_path)
			: DEFAULT_CUSTOM_GAME_COVER_URL;
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

<div class="editor-hub">
	<header class="hub-header">
		<h1>Editor - Open Project</h1>
		<p class="subnav">
			<a href="/lobby">Lobbies</a>
			<span class="muted">— host games you’ve built here.</span>
		</p>
	</header>

	{#if err}
		<p class="err">{err}</p>
	{/if}

	<p class="lead">
		Create and edit board layout, piece templates, and media. Open a project below or start a new one.
	</p>

	<button type="button" class="btn primary" disabled={creating || loading} onclick={createGame}>
		{creating ? 'Creating…' : 'New game'}
	</button>

	<section class="projects" aria-labelledby="projects-h">
		<h2 id="projects-h" class="sr-only">Your projects</h2>
		{#if loading}
			<div class="tile-grid" aria-busy="true">
				{#each [1, 2, 3] as _}
					<div class="tile skeleton"></div>
				{/each}
			</div>
		{:else if games.length === 0}
			<p class="empty">No projects yet — use <strong>New game</strong> to create one.</p>
		{:else}
			<div class="tile-grid">
				{#each games as g (g.id)}
					<a class="tile" href="/editor/{g.id}">
						<div
							class="tile-bg"
							style:background-image="url({coverUrl(g)})"
						></div>
						<div class="tile-scrim"></div>
						<div class="tile-footer">
							<span class="tile-label">{g.title}</span>
							<span class="tile-meta">{g.game_key}</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.editor-hub {
		max-width: 1120px;
		margin: 0 auto;
		padding: 1.25rem 1.5rem 2rem;
		font-family: Roboto, system-ui, sans-serif;
		color: var(--color-text);
	}
	.hub-header h1 {
		margin-top: 0;
		margin-bottom: 0.25rem;
		font-size: 1.75rem;
		color: var(--color-text);
	}
	.subnav {
		margin: 0 0 1rem;
		font-size: 0.95rem;
	}
	.subnav a {
		color: var(--color-accent, #3b82f6);
	}
	.subnav .muted {
		color: var(--color-text-muted);
	}
	.lead {
		color: var(--color-text-muted);
		margin: 0 0 1rem;
		line-height: 1.45;
		font-size: 0.95rem;
	}
	.btn {
		padding: 0.5rem 1rem;
		border-radius: 8px;
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface-muted);
		color: var(--color-text);
		cursor: pointer;
		font: inherit;
		font-weight: 500;
		margin-bottom: 1.5rem;
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.btn:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.btn.primary {
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		border-color: var(--color-accent-hover, var(--color-accent));
	}
	.tile-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.75rem;
	}
	.tile {
		position: relative;
		display: block;
		aspect-ratio: 16 / 10;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--color-border);
		text-decoration: none;
		color: #f8fafc;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}
	@media (prefers-reduced-motion: reduce) {
		.tile {
			transition: none;
		}
	}
	.tile:hover {
		transform: scale(1.02);
		box-shadow: 0 0 0 2px var(--color-accent);
	}
	.tile:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 3px;
	}
	.tile-bg {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		background-color: #1e293b;
	}
	.tile-scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, color-mix(in oklab, #0f172a 88%, transparent), transparent 60%);
		pointer-events: none;
	}
	.tile-footer {
		position: absolute;
		left: 0.55rem;
		right: 0.55rem;
		bottom: 0.45rem;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.tile-label {
		font-size: 0.88rem;
		font-weight: 600;
		text-shadow: 0 1px 3px color-mix(in oklab, #000 55%, transparent);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tile-meta {
		font-size: 0.65rem;
		font-family: ui-monospace, monospace;
		color: color-mix(in oklab, #e2e8f0 88%, transparent);
		text-shadow: 0 1px 2px color-mix(in oklab, #000 50%, transparent);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.empty {
		margin: 0;
		font-size: 0.92rem;
		color: var(--color-text-muted);
		line-height: 1.45;
	}
	.err {
		color: var(--color-danger);
	}
	.skeleton {
		aspect-ratio: 16 / 10;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		background: linear-gradient(
			110deg,
			var(--color-surface-muted) 0%,
			color-mix(in oklab, var(--color-text) 8%, var(--color-surface-muted)) 45%,
			var(--color-surface-muted) 90%
		);
		background-size: 200% 100%;
		animation: shimmer 1.2s ease-in-out infinite;
	}
	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
		}
	}
	@keyframes shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
</style>
