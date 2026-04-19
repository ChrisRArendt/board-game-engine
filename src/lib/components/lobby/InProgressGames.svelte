<script lang="ts">
	import type { LobbyRow } from '$lib/lobby';

	export let games: LobbyRow[] = [];
	export let loading = false;
	export let coverUrlForGame: (gameKey: string) => string | null = () => null;
	export let currentUserId: string;
	export let onEnd: (lobby: LobbyRow) => void = () => {};
</script>

<section class="section in-progress" aria-labelledby="in-progress-h">
	<div class="section-head">
		<h2 id="in-progress-h">Games in progress</h2>
	</div>
	{#if loading}
		<ul class="card-grid" aria-busy="true">
			{#each [1, 2] as _}
				<li class="game-card skeleton"></li>
			{/each}
		</ul>
	{:else if games.length === 0}
		<p class="empty">No games in progress — start a lobby below and press <strong>Start game</strong>.</p>
	{:else}
		<ul class="card-grid">
			{#each games as G (G.id)}
				<li class="game-card">
					<a class="card-link" href="/play/{G.id}">
						<div
							class="card-bg"
							style:background-image={coverUrlForGame(G.game_key)
								? `url(${coverUrlForGame(G.game_key)})`
								: 'none'}
						></div>
						<div class="card-scrim"></div>
						<div class="card-body">
							<span class="card-title">{G.name}</span>
							<span class="card-sub">{G.game_key}</span>
						</div>
					</a>
					{#if G.host_id === currentUserId}
						<button
							type="button"
							class="end-btn"
							title="End this game"
							aria-label="End game {G.name}"
							on:click|stopPropagation|preventDefault={() => onEnd(G)}
						>
							End
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.section {
		margin-bottom: 0;
	}
	.section-head h2 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--color-text);
	}
	.empty {
		margin: 0;
		font-size: 0.92rem;
		color: var(--color-text-muted);
		line-height: 1.45;
	}
	.card-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.75rem;
	}
	.game-card {
		position: relative;
		border-radius: 10px;
		overflow: hidden;
		min-height: 112px;
		border: 1px solid var(--color-border);
		background: var(--color-surface-muted);
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}
	@media (prefers-reduced-motion: reduce) {
		.game-card {
			transition: none;
		}
	}
	.game-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px color-mix(in oklab, var(--color-text) 12%, transparent);
	}
	.card-link {
		display: block;
		position: relative;
		height: 100%;
		min-height: 112px;
		color: inherit;
		text-decoration: none;
	}
	.card-bg {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		background-color: #1e293b;
	}
	.card-scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			color-mix(in oklab, #0f172a 92%, transparent) 0%,
			transparent 55%
		);
		pointer-events: none;
	}
	.card-body {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 0.5rem 0.65rem;
		z-index: 1;
	}
	.card-title {
		display: block;
		font-weight: 600;
		font-size: 0.9rem;
		color: #f8fafc;
		text-shadow: 0 1px 2px color-mix(in oklab, #000 60%, transparent);
	}
	.card-sub {
		display: block;
		font-size: 0.72rem;
		color: color-mix(in oklab, #e2e8f0 85%, transparent);
		margin-top: 0.15rem;
		font-family: ui-monospace, monospace;
	}
	.end-btn {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		z-index: 2;
		font-size: 0.72rem;
		padding: 0.2rem 0.45rem;
		border-radius: 6px;
		border: 1px solid color-mix(in oklab, #fff 25%, transparent);
		background: color-mix(in oklab, #0f172a 75%, transparent);
		color: #f1f5f9;
		cursor: pointer;
	}
	.end-btn:hover {
		background: color-mix(in oklab, var(--color-danger) 85%, #0f172a);
		border-color: transparent;
	}
	.end-btn:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.skeleton {
		min-height: 112px;
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
</style>
