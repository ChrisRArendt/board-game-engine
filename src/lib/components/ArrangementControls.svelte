<script lang="ts">
	import type { PlacementLayout } from '$lib/engine/types';
	import type { PlacementSpacingMode } from '$lib/editor/placementLayouts';
	import * as g from '$lib/stores/game';

	/** Piece library: quantity for multi-drop (bind from parent when `showQuantity`). */
	export let quantity = 1;
	export let showQuantity = false;

	export let layout: PlacementLayout = 'grid';
	export let spacingMode: PlacementSpacingMode = 'overlap';
	export let cols = 3;
	export let offset = 32;

	export let showApplyButton = true;
	/** Tighter padding and type for context menu. */
	export let compact = false;
	/** Editor / menu: warn when fewer than two unlocked pieces in selection. */
	export let useSelectionUnlockedHint = false;
	export let unlockedCount = 0;
	export let selectedCount = 0;

	export let onAfterApply: (() => void) | undefined = undefined;

	function apply() {
		const ok = g.applyPlacementArrangementToSelection(layout, spacingMode, cols, offset);
		if (ok) onAfterApply?.();
	}
</script>

<div class="arrangement-controls" class:compact>
	{#if showQuantity}
		<label class="row">
			<span>Quantity</span>
			<input type="number" min="1" max="99" bind:value={quantity} />
		</label>
	{/if}

	<label class="row">
		<span>Layout</span>
		<select bind:value={layout}>
			<option value="stack">Stack</option>
			<option value="grid">Grid</option>
			<option value="honeycomb">Honeycomb</option>
		</select>
	</label>
	{#if layout === 'grid' || layout === 'honeycomb'}
		<label class="row">
			<span>Columns</span>
			<input type="number" min="1" max="99" bind:value={cols} />
		</label>
	{/if}
	<label class="row toggle-row">
		<span>Spacing</span>
		<div class="segmented" role="group" aria-label="Arrangement spacing">
			<button
				type="button"
				class:active={spacingMode === 'overlap'}
				onclick={() => (spacingMode = 'overlap')}
			>
				Overlap
			</button>
			<button
				type="button"
				class:active={spacingMode === 'separate'}
				onclick={() => (spacingMode = 'separate')}
			>
				Separate
			</button>
		</div>
	</label>
	<label class="row">
		<span>{spacingMode === 'separate' ? 'Gap (px)' : 'Offset (px)'}</span>
		<input
			type="number"
			min={spacingMode === 'separate' ? 0 : 1}
			max="500"
			bind:value={offset}
		/>
	</label>
	{#if showApplyButton}
		<button
			type="button"
			class="arrange-apply"
			disabled={useSelectionUnlockedHint && unlockedCount < 2}
			onclick={apply}
		>
			Apply arrangement
		</button>
		{#if useSelectionUnlockedHint && unlockedCount < 2 && selectedCount >= 2}
			<p class="subhint warn">Select at least two unlocked pieces to arrange.</p>
		{/if}
	{/if}
</div>

<style>
	.arrangement-controls {
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-size: 13px;
	}
	.arrangement-controls.compact {
		gap: 8px;
		font-size: 12px;
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.row span {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}
	.compact .row span {
		font-size: 10px;
	}
	.row input[type='number'],
	.row select {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.compact .row input[type='number'],
	.compact .row select {
		padding: 5px 6px;
		font-size: 12px;
	}
	.toggle-row .segmented {
		display: flex;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		overflow: hidden;
	}
	.segmented button {
		flex: 1;
		padding: 6px 8px;
		border: none;
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-size: 12px;
		cursor: pointer;
	}
	.compact .segmented button {
		padding: 5px 6px;
		font-size: 11px;
	}
	.segmented button + button {
		border-left: 1px solid var(--color-border);
	}
	.segmented button.active {
		background: var(--color-accent, #3b82f6);
		color: #fff;
	}
	.arrange-apply {
		padding: 8px 12px;
		border-radius: 6px;
		border: none;
		background: var(--color-accent, #3b82f6);
		color: #fff;
		font-size: 13px;
		cursor: pointer;
	}
	.compact .arrange-apply {
		padding: 7px 10px;
		font-size: 12px;
	}
	.arrange-apply:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.subhint {
		margin: 0;
		font-size: 11px;
		color: var(--color-text-muted);
		line-height: 1.35;
	}
	.subhint.warn {
		color: #f87171;
	}
</style>
