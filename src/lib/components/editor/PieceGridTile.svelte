<script lang="ts">
	import PieceListThumb from './PieceListThumb.svelte';

	export type RenderPhase = 'idle' | 'running' | 'done' | 'error';

	type CardRow = {
		id: string;
		name: string | null;
		rendered_image_path: string | null;
		render_stale: boolean | null;
		updated_at: string | null;
		template_id: string;
	};

	let {
		gameId,
		card,
		sublinkTemplateId,
		showTemplateLabel = false,
		templateLabel = '',
		selected = false,
		renderPhase = 'idle',
		thumbUrl,
		onToggleSelect
	}: {
		gameId: string;
		card: CardRow;
		sublinkTemplateId: string;
		showTemplateLabel?: boolean;
		templateLabel?: string;
		selected?: boolean;
		renderPhase?: RenderPhase;
		thumbUrl: string;
		onToggleSelect: (e: MouseEvent) => void;
	} = $props();
</script>

<article
	class="piece-tile"
	class:piece-tile--selected={selected}
	class:piece-tile--rendering={renderPhase === 'running'}
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<label
		class="piece-tile-check"
		title="Select — Shift+click another to select a range"
		onclick={(e) => {
			e.preventDefault();
			e.stopPropagation();
			onToggleSelect(e);
		}}
	>
		<input type="checkbox" checked={selected} tabindex="-1" />
		<span class="visually-hidden">Select {card.name ?? 'piece'}</span>
	</label>

	<div class="piece-tile-media">
		{#if renderPhase === 'running'}
			<div class="piece-tile-overlay" aria-live="polite">
				<span class="spinner"></span>
				<span class="overlay-label">Rendering…</span>
			</div>
		{:else if renderPhase === 'done'}
			<div class="piece-tile-overlay piece-tile-overlay--ok" aria-live="polite">
				<span class="overlay-label">Updated</span>
			</div>
		{:else if renderPhase === 'error'}
			<div class="piece-tile-overlay piece-tile-overlay--err" aria-live="polite">
				<span class="overlay-label">Failed</span>
			</div>
		{/if}
		<a href="/editor/{gameId}/pieces/{card.id}" class="piece-tile-thumb">
			{#if card.rendered_image_path}
				<PieceListThumb src={thumbUrl} cacheKey={card.updated_at ?? ''} />
			{:else}
				<div class="ph">No render</div>
			{/if}
		</a>
	</div>
	<div class="piece-tile-body">
		<a href="/editor/{gameId}/pieces/{card.id}" class="piece-tile-name" title="Edit piece">{card.name}</a>
		{#if showTemplateLabel}
			<span class="tmpl-tag">{templateLabel}</span>
		{/if}
		<a class="piece-tile-sublink" href="/editor/{gameId}/templates/{sublinkTemplateId}">Edit type</a>
		{#if card.render_stale}<span class="stale">Stale</span>{/if}
	</div>
</article>

<style>
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
	.piece-tile {
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		background: var(--color-surface-muted, rgba(255, 255, 255, 0.04));
		overflow: hidden;
		transition:
			box-shadow 0.15s ease,
			border-color 0.15s ease;
	}
	.piece-tile--selected {
		border-color: var(--color-accent, #3b82f6);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
	}
	.piece-tile:hover:not(.piece-tile--selected) {
		border-color: rgba(59, 130, 246, 0.45);
	}
	.piece-tile-check {
		position: absolute;
		top: 6px;
		right: 6px;
		z-index: 4;
		margin: 0;
		padding: 4px;
		background: rgba(0, 0, 0, 0.45);
		border-radius: 6px;
		cursor: pointer;
		line-height: 0;
	}
	.piece-tile-check input {
		width: 18px;
		height: 18px;
		margin: 0;
		cursor: pointer;
		pointer-events: none;
		accent-color: var(--color-accent, #3b82f6);
	}
	.piece-tile-media {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		background: #1a1a1f;
		flex-shrink: 0;
	}
	.piece-tile-overlay {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: rgba(15, 15, 20, 0.72);
		pointer-events: none;
	}
	.piece-tile-thumb {
		position: absolute;
		inset: 0;
		display: block;
		overflow: hidden;
		line-height: 0;
	}
	.piece-tile-thumb :global(.piece-list-thumb) {
		position: absolute;
		inset: 0;
	}
	.ph {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #222;
		font-size: 11px;
		color: #888;
	}
	.spinner {
		width: 28px;
		height: 28px;
		border: 3px solid rgba(255, 255, 255, 0.2);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.overlay-label {
		font-size: 12px;
		font-weight: 600;
		color: #e2e8f0;
	}
	.piece-tile-overlay--ok {
		background: rgba(21, 128, 61, 0.82);
	}
	.piece-tile-overlay--err {
		background: rgba(185, 28, 28, 0.82);
	}
	.piece-tile-body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 8px 10px;
		min-width: 0;
	}
	.piece-tile-name {
		font-weight: 600;
		font-size: 13px;
		line-height: 1.25;
		color: var(--color-accent, #3b82f6);
		text-decoration: none;
		word-break: break-word;
	}
	.piece-tile-name:hover {
		text-decoration: underline;
	}
	.piece-tile-sublink {
		font-size: 11px;
		color: var(--color-accent, #3b82f6);
		text-decoration: none;
		opacity: 0.9;
	}
	.piece-tile-sublink:hover {
		text-decoration: underline;
	}
	.tmpl-tag {
		font-size: 11px;
		color: var(--color-text-muted);
	}
	.stale {
		font-size: 11px;
		color: #fbbf24;
	}
</style>
