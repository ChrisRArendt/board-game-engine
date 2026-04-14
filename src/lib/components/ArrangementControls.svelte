<script lang="ts">
	import type { PlacementLayout } from '$lib/engine/types';
	import { ARRANGEMENT_GAP_PRESET } from '$lib/editor/arrangementGapPresets';
	import { arrangementPrefs, patchArrangementPrefs } from '$lib/stores/arrangementPrefs';
	import * as g from '$lib/stores/game';
	import { get } from 'svelte/store';

	/** Piece library: quantity for multi-drop (bind from parent when `showQuantity`). */
	export let quantity = 1;
	export let showQuantity = false;

	export let showApplyButton = true;
	/** Piece library: show Face up/down without an Apply button (preference used when dropping cards). */
	export let showFaceControl = false;
	/** In-game context menu: small/medium/large gap presets (30 / 90 / 270 px) instead of a numeric offset. */
	export let gapPresetMode = false;
	/** Tighter padding and type for context menu. */
	export let compact = false;
	/** With `compact`: 16px body type in the context menu (still dense layout). */
	export let contextMenu = false;
	/** Show “only flip-capable pieces…” when none selected (inspector); hide in context menu. */
	export let showNoFlipSubhint = true;
	/** Editor / menu: warn when fewer than two unlocked pieces in selection. */
	export let useSelectionUnlockedHint = false;
	export let unlockedCount = 0;
	export let selectedCount = 0;
	/** Selected pieces with the flip attribute — used for optional hints when no flip-capable selection. */
	export let flipCapableCount = 0;

	export let onAfterApply: (() => void) | undefined = undefined;

	type GapPreset = keyof typeof ARRANGEMENT_GAP_PRESET;

	function nearestGapPreset(v: number): GapPreset {
		let best: GapPreset = 'medium';
		let bestDist = Infinity;
		for (const k of Object.keys(ARRANGEMENT_GAP_PRESET) as GapPreset[]) {
			const d = Math.abs(v - ARRANGEMENT_GAP_PRESET[k]);
			if (d < bestDist) {
				bestDist = d;
				best = k;
			}
		}
		return best;
	}

	function setGapPreset(p: GapPreset) {
		patchArrangementPrefs({ offset: ARRANGEMENT_GAP_PRESET[p] });
	}

	async function apply() {
		const { layout, spacingMode, cols, offset, arrangeFaceUp } = get(arrangementPrefs);
		const ok = await g.applyPlacementArrangementToSelection(
			layout,
			spacingMode,
			cols,
			offset,
			arrangeFaceUp
		);
		if (ok) onAfterApply?.();
	}

	const LAYOUT_CHOICES: { id: PlacementLayout; label: string }[] = [
		{ id: 'stack', label: 'Stack' },
		{ id: 'grid', label: 'Grid' },
		{ id: 'honeycomb', label: 'Honey' },
		{ id: 'fan', label: 'Fan' },
		{ id: 'pile', label: 'Pile' }
	];
</script>

<div class="arrangement-controls" class:compact class:context-menu={contextMenu}>
	{#if showQuantity}
		<label class="row">
			<span>Quantity</span>
			<input type="number" min="1" max="99" bind:value={quantity} />
		</label>
	{/if}

	<div class="row layout-row">
		<span>Layout</span>
		<div class="layout-grid" role="group" aria-label="Layout">
			{#each LAYOUT_CHOICES as L}
				<button
					type="button"
					class="layout-btn"
					class:active={$arrangementPrefs.layout === L.id}
					aria-pressed={$arrangementPrefs.layout === L.id}
					onclick={() => patchArrangementPrefs({ layout: L.id })}
				>
					{#if L.id === 'stack'}
						<svg class="layout-icon" viewBox="0 0 24 24" aria-hidden="true">
							<rect
								x="5"
								y="13"
								width="11"
								height="7"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/>
							<rect
								x="6.5"
								y="9"
								width="11"
								height="7"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/>
							<rect
								x="8"
								y="5"
								width="11"
								height="7"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/>
						</svg>
					{:else if L.id === 'grid'}
						<svg class="layout-icon" viewBox="0 0 24 24" aria-hidden="true">
							<rect
								x="3"
								y="3"
								width="7"
								height="7"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/>
							<rect
								x="14"
								y="3"
								width="7"
								height="7"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/>
							<rect
								x="3"
								y="14"
								width="7"
								height="7"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/>
							<rect
								x="14"
								y="14"
								width="7"
								height="7"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/>
						</svg>
					{:else if L.id === 'honeycomb'}
						<svg class="layout-icon" viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M12 4l4 2.5v5L12 14l-4-2.5v-5L12 4z"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linejoin="round"
							/>
							<path
								d="M6 10l4 2.5v5L6 20l-4-2.5v-5L6 10z"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linejoin="round"
							/>
							<path
								d="M18 10l4 2.5v5L18 20l-4-2.5v-5L18 10z"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linejoin="round"
							/>
						</svg>
					{:else if L.id === 'fan'}
						<svg class="layout-icon" viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M5 18 Q12 7 19 18"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
							/>
							<rect
								x="3"
								y="13"
								width="7"
								height="7"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								transform="rotate(-28 6.5 16.5)"
							/>
							<rect
								x="8.5"
								y="6"
								width="7"
								height="7"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/>
							<rect
								x="14"
								y="13"
								width="7"
								height="7"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								transform="rotate(28 17.5 16.5)"
							/>
						</svg>
					{:else}
						<!-- pile -->
						<svg class="layout-icon" viewBox="0 0 24 24" aria-hidden="true">
							<rect
								x="4"
								y="10"
								width="10"
								height="8"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/>
							<rect
								x="6"
								y="7"
								width="10"
								height="8"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/>
							<rect
								x="8"
								y="4"
								width="10"
								height="8"
								rx="1"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/>
						</svg>
					{/if}
					<span class="layout-label">{L.label}</span>
				</button>
			{/each}
		</div>
	</div>
	{#if $arrangementPrefs.layout === 'grid' || $arrangementPrefs.layout === 'honeycomb'}
		<label class="row">
			<span>Columns</span>
			<input
				type="number"
				min="1"
				max="99"
				value={$arrangementPrefs.cols}
				oninput={(e) =>
					patchArrangementPrefs({
						cols: parseInt((e.currentTarget as HTMLInputElement).value, 10) || 1
					})}
			/>
		</label>
	{/if}
	{#if $arrangementPrefs.layout !== 'pile'}
		<label class="row toggle-row">
			<span>Spacing</span>
			<div class="segmented" role="group" aria-label="Arrangement spacing">
				<button
					type="button"
					class:active={$arrangementPrefs.spacingMode === 'overlap'}
					onclick={() => patchArrangementPrefs({ spacingMode: 'overlap' })}
				>
					Overlap
				</button>
				<button
					type="button"
					class:active={$arrangementPrefs.spacingMode === 'separate'}
					onclick={() => patchArrangementPrefs({ spacingMode: 'separate' })}
				>
					Separate
				</button>
			</div>
		</label>
		{#if gapPresetMode}
			<label class="row toggle-row">
				<span>{$arrangementPrefs.spacingMode === 'separate' ? 'Gap' : 'Offset'}</span>
				<div class="segmented gap-presets" role="group" aria-label="Gap size">
					<button
						type="button"
						class:active={nearestGapPreset($arrangementPrefs.offset) === 'small'}
						onclick={() => setGapPreset('small')}
					>
						Small
					</button>
					<button
						type="button"
						class:active={nearestGapPreset($arrangementPrefs.offset) === 'medium'}
						onclick={() => setGapPreset('medium')}
					>
						Medium
					</button>
					<button
						type="button"
						class:active={nearestGapPreset($arrangementPrefs.offset) === 'large'}
						onclick={() => setGapPreset('large')}
					>
						Large
					</button>
				</div>
			</label>
		{:else}
			<label class="row">
				<span>{$arrangementPrefs.spacingMode === 'separate' ? 'Gap (px)' : 'Offset (px)'}</span>
				<input
					type="number"
					min={$arrangementPrefs.spacingMode === 'separate' ? 0 : 1}
					max="500"
					value={$arrangementPrefs.offset}
					oninput={(e) =>
						patchArrangementPrefs({
							offset: parseFloat((e.currentTarget as HTMLInputElement).value) || 0
						})}
				/>
			</label>
		{/if}
	{/if}
	{#if showApplyButton || showFaceControl}
		<label class="row toggle-row">
			<span>Face</span>
			<div class="segmented" role="group" aria-label="Card face after arrange">
				<button
					type="button"
					class:active={$arrangementPrefs.arrangeFaceUp}
					onclick={() => patchArrangementPrefs({ arrangeFaceUp: true })}
				>
					Up
				</button>
				<button
					type="button"
					class:active={!$arrangementPrefs.arrangeFaceUp}
					onclick={() => patchArrangementPrefs({ arrangeFaceUp: false })}
				>
					Down
				</button>
			</div>
		</label>
		{#if showNoFlipSubhint && showApplyButton && flipCapableCount === 0}
			<p class="subhint">Only pieces with the flip attribute change face when arranged.</p>
		{:else if showFaceControl}
			<p class="subhint">For drops, only double-sided cards (with a back) use this.</p>
		{/if}
	{/if}
	{#if showApplyButton}
		<button
			type="button"
			class="arrange-apply"
			disabled={useSelectionUnlockedHint && unlockedCount < 2}
			onclick={apply}
		>
			{compact ? 'Apply' : 'Apply arrangement'}
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
		gap: 5px;
		font-size: 11px;
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.compact .row {
		gap: 2px;
	}
	/* Direct child only — not .layout-label inside layout buttons */
	.row > span {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}
	.compact .row > span {
		font-size: 9px;
		letter-spacing: 0.05em;
	}
	.row input[type='number'] {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.compact .row input[type='number'] {
		padding: 3px 5px;
		font-size: 11px;
		border-radius: 3px;
	}
	.layout-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.compact .layout-grid {
		gap: 3px;
	}
	.layout-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 6px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text-muted);
		cursor: pointer;
		font: inherit;
	}
	.layout-btn:not(.active):hover {
		background: var(--color-ctx-hover-bg, rgba(255, 255, 255, 0.06));
		color: var(--color-text);
	}
	.layout-btn.active {
		background: var(--color-accent, #3b82f6);
		border-color: var(--color-accent, #3b82f6);
		color: #fff;
	}
	.layout-btn.active .layout-label {
		color: #fff;
	}
	.layout-icon {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
	}
	.compact .layout-icon {
		width: 18px;
		height: 18px;
	}
	.layout-label {
		font-size: 11px;
		font-weight: 500;
		line-height: 1.15;
		text-transform: none;
		letter-spacing: normal;
		color: inherit;
	}
	.compact .layout-btn {
		padding: 3px 2px;
		gap: 2px;
		border-radius: 4px;
	}
	.compact .layout-label {
		font-size: 9px;
		line-height: 1.1;
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
		padding: 3px 5px;
		font-size: 10px;
	}
	.compact .toggle-row .segmented {
		border-radius: 4px;
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
		padding: 4px 8px;
		font-size: 11px;
		border-radius: 4px;
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
	.compact .subhint {
		font-size: 9px;
		line-height: 1.3;
	}
	.arrangement-controls.compact.context-menu {
		font-size: 16px;
	}
	.compact.context-menu .row > span {
		font-size: 12px;
	}
	.compact.context-menu .row input[type='number'] {
		font-size: 16px;
		padding: 4px 6px;
	}
	.compact.context-menu .layout-label {
		font-size: 14px;
	}
	.compact.context-menu .layout-icon {
		width: 22px;
		height: 22px;
	}
	.compact.context-menu .segmented button {
		font-size: 16px;
		padding: 5px 6px;
	}
	.compact.context-menu .arrange-apply {
		font-size: 16px;
		padding: 6px 10px;
	}
	.compact.context-menu .subhint {
		font-size: 14px;
	}
	.subhint.warn {
		color: #f87171;
	}
</style>
