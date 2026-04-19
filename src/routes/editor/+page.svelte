<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import {
		customGameCoverPublicUrl,
		DEFAULT_CUSTOM_GAME_COVER_URL,
		duplicateCustomGame,
		insertCustomBoardGame,
		listMyCustomGames,
		type DuplicateGameProgress
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
	/** Which project card’s “⋯” menu is open (at most one). */
	let menuOpenForId: string | null = null;
	/** Game id currently being duplicated (shows busy on that card). */
	let duplicatingId: string | null = null;
	/** Wide progress banner while a duplicate is running. */
	let dupBanner: (DuplicateGameProgress & { sourceTitle: string }) | null = null;

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

	function closeProjectMenu() {
		menuOpenForId = null;
	}

	function onGlobalPointerDown(e: PointerEvent) {
		if (menuOpenForId === null) return;
		const el = e.target;
		if (el instanceof Node && (el as HTMLElement).closest?.('[data-project-menu-root]')) return;
		closeProjectMenu();
	}

	function onGlobalKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeProjectMenu();
	}

	async function toggleProjectMenu(gameId: string, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		menuOpenForId = menuOpenForId === gameId ? null : gameId;
		await tick();
	}

	async function duplicateProject(gameId: string) {
		if (duplicatingId) return;
		err = '';
		duplicatingId = gameId;
		closeProjectMenu();
		const sourceTitle = games.find((g) => g.id === gameId)?.title ?? 'Project';
		dupBanner = {
			sourceTitle,
			stage: 'Starting',
			detail: 'Preparing…',
			completed: 0,
			total: 1,
			percent: 0
		};
		try {
			const { id } = await duplicateCustomGame(supabase, gameId, {
				onProgress: (p) => {
					dupBanner = { ...p, sourceTitle };
				}
			});
			dupBanner = null;
			duplicatingId = null;
			await goto(`/editor/${id}`);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Duplicate failed';
			dupBanner = null;
			duplicatingId = null;
		}
	}

	onMount(refresh);
</script>

<svelte:window onpointerdown={onGlobalPointerDown} onkeydown={onGlobalKeydown} />

<div class="editor-hub editor-page-scroll">
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

	<button type="button" class="btn primary" disabled={creating || loading || dupBanner !== null} onclick={createGame}>
		{creating ? 'Creating…' : 'New game'}
	</button>

	<section class="projects" aria-labelledby="projects-h">
		<h2 id="projects-h" class="sr-only">Your projects</h2>
		{#if dupBanner}
			<div class="dup-banner" role="status" aria-live="polite" aria-busy="true">
				<div class="dup-banner-top">
					<span class="dup-heading">Duplicating “{dupBanner.sourceTitle}”</span>
					<span class="dup-count"
						>{dupBanner.completed}/{dupBanner.total} · {dupBanner.percent}%</span
					>
				</div>
				<p class="dup-detail"><span class="dup-stage">{dupBanner.stage}:</span> {dupBanner.detail}</p>
				<div
					class="dup-bar"
					role="progressbar"
					aria-valuenow={dupBanner.percent}
					aria-valuemin="0"
					aria-valuemax="100"
				>
					<div class="dup-bar-fill" style:width={`${dupBanner.percent}%`}></div>
				</div>
			</div>
		{/if}
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
					<div class="tile">
						<a class="tile-main" href="/editor/{g.id}">
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
						<div class="tile-actions" data-project-menu-root>
							<button
								type="button"
								class="tile-menu-btn"
								aria-label="Project options"
								aria-haspopup="menu"
								aria-expanded={menuOpenForId === g.id}
								disabled={dupBanner !== null}
								onclick={(e) => toggleProjectMenu(g.id, e)}
							>
								⋯
							</button>
							{#if menuOpenForId === g.id}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<ul class="tile-menu" role="menu" onclick={(e) => e.stopPropagation()}>
									<li role="none">
										<button
											type="button"
											class="tile-menu-item"
											role="menuitem"
											disabled={dupBanner !== null}
											onclick={() => duplicateProject(g.id)}
										>
											{duplicatingId === g.id ? 'Duplicating…' : 'Duplicate'}
										</button>
									</li>
								</ul>
							{/if}
						</div>
					</div>
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
	.dup-banner {
		margin: 0 0 1rem;
		padding: 0.65rem 1rem;
		border-radius: 10px;
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface-muted);
		max-width: 100%;
		box-sizing: border-box;
	}
	.dup-banner-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 0.35rem;
	}
	.dup-heading {
		font-weight: 600;
		font-size: 0.92rem;
		color: var(--color-text);
	}
	.dup-count {
		font-size: 0.78rem;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
		white-space: nowrap;
	}
	.dup-detail {
		margin: 0 0 0.5rem;
		font-size: 0.82rem;
		line-height: 1.4;
		color: var(--color-text-muted);
	}
	.dup-stage {
		color: var(--color-text);
		font-weight: 500;
	}
	.dup-bar {
		height: 6px;
		border-radius: 999px;
		background: color-mix(in oklab, var(--color-text) 12%, var(--color-surface));
		overflow: hidden;
	}
	.dup-bar-fill {
		height: 100%;
		border-radius: 999px;
		background: var(--color-accent);
		transition: width 0.2s ease;
	}
	@media (prefers-reduced-motion: reduce) {
		.dup-bar-fill {
			transition: none;
		}
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
		overflow: visible;
		border: 1px solid var(--color-border);
		color: #f8fafc;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}
	.tile-main {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: block;
		border-radius: 10px;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
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
	.tile-main:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 3px;
	}
	.tile-actions {
		position: absolute;
		top: 6px;
		right: 6px;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}
	.tile-menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid color-mix(in oklab, #fff 22%, transparent);
		border-radius: 8px;
		background: color-mix(in oklab, #0f172a 82%, transparent);
		color: #f8fafc;
		font-size: 1.15rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	.tile:hover .tile-menu-btn,
	.tile:focus-within .tile-menu-btn,
	.tile-menu-btn:focus-visible {
		opacity: 1;
	}
	@media (hover: none) and (pointer: coarse) {
		.tile-menu-btn {
			opacity: 0.88;
		}
	}
	.tile-menu-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.tile-menu {
		list-style: none;
		margin: 0;
		padding: 4px 0;
		min-width: 11rem;
		border-radius: 8px;
		border: 1px solid var(--color-border-strong);
		background: var(--color-context-bg, var(--color-surface));
		box-shadow: var(--shadow-md);
		font-size: 0.9rem;
	}
	.tile-menu-item {
		display: block;
		width: 100%;
		padding: 8px 12px;
		border: none;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.tile-menu-item:hover:not(:disabled),
	.tile-menu-item:focus-visible:not(:disabled) {
		background: var(--color-ctx-hover-bg, rgba(100, 120, 200, 0.25));
		color: #fff;
	}
	.tile-menu-item:disabled {
		opacity: 0.7;
		cursor: not-allowed;
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
