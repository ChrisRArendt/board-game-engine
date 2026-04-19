<script lang="ts">
	import type { PlayableGameOption } from '$lib/customGames';

	export let games: PlayableGameOption[] = [];
	export let loading = false;
	export let disabled = false;
	export let creatingKey: string | null = null;
	export let onPick: (gameKey: string) => void = () => {};
</script>

<section class="section catalog" aria-labelledby="catalog-h">
	<div class="section-head">
		<h2 id="catalog-h">Start a new lobby</h2>
		<p class="hint">Pick a game — you’ll open a private lobby you can rename and share.</p>
	</div>
	{#if loading}
		<div class="tile-grid" aria-busy="true">
			{#each [1, 2, 3] as _}
				<div class="tile skeleton"></div>
			{/each}
		</div>
	{:else}
		<div class="tile-grid">
			{#each games as g (g.key)}
				<button
					type="button"
					class="tile"
					class:busy={creatingKey === g.key}
					disabled={disabled || creatingKey !== null}
					on:click={() => onPick(g.key)}
				>
					<div
						class="tile-bg"
						style:background-image={g.coverUrl ? `url(${g.coverUrl})` : 'none'}
					></div>
					<div class="tile-scrim"></div>
					<span class="tile-label">{g.label}</span>
					{#if creatingKey === g.key}
						<span class="spinner" aria-hidden="true"></span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</section>

<style>
	.section-head h2 {
		margin: 0 0 0.35rem;
		font-size: 1.1rem;
		font-weight: 600;
	}
	.hint {
		margin: 0 0 0.85rem;
		font-size: 0.85rem;
		color: var(--color-text-muted);
		line-height: 1.4;
	}
	.tile-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.75rem;
	}
	.tile {
		position: relative;
		display: block;
		aspect-ratio: 16 / 10;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--color-border);
		cursor: pointer;
		padding: 0;
		text-align: left;
		font: inherit;
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
	.tile:hover:not(:disabled) {
		transform: scale(1.02);
		box-shadow: 0 0 0 2px var(--color-accent);
	}
	.tile:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 3px;
	}
	.tile:disabled {
		opacity: 0.65;
		cursor: not-allowed;
		transform: none;
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
	.tile-label {
		position: absolute;
		left: 0.55rem;
		right: 0.55rem;
		bottom: 0.45rem;
		z-index: 1;
		font-size: 0.88rem;
		font-weight: 600;
		text-shadow: 0 1px 3px color-mix(in oklab, #000 55%, transparent);
	}
	.tile.busy .tile-label {
		opacity: 0.85;
	}
	.spinner {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 1.5rem;
		height: 1.5rem;
		margin: -0.75rem 0 0 -0.75rem;
		border: 2px solid color-mix(in oklab, #fff 35%, transparent);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		z-index: 2;
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
			border-top-color: color-mix(in oklab, #fff 70%, transparent);
		}
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.skeleton {
		aspect-ratio: 16 / 10;
		border-radius: 10px;
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
