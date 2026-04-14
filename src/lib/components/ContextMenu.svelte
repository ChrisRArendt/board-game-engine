<script lang="ts">
	import { browser } from '$app/environment';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import { hasAttr, pieceSupportsFlip } from '$lib/engine/pieces';
	import ArrangementControls from '$lib/components/ArrangementControls.svelte';
	import DealToDialog from '$lib/components/DealToDialog.svelte';
	import { users } from '$lib/stores/users';
	import { settings } from '$lib/stores/settings';
	import {
		activeUserId,
		getLocalPlayerColor,
		playerColorOverrides,
		playerOrder
	} from '$lib/stores/network';
	import { buildStashRoster } from '$lib/engine/stash';

	export let open = false;
	export let x = 0;
	export let y = 0;
	export let selfDisplayName = 'You';

	const MENU_W = 248;
	const MENU_H = 400;

	let dealOpen = false;

	function prefersReducedMotion(): boolean {
		if (!browser || typeof matchMedia === 'undefined') return false;
		return matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	$: stashRoster = (() => {
		$settings;
		$users;
		$playerOrder;
		$playerColorOverrides;
		if (!$activeUserId) return [];
		return buildStashRoster({
			selfUserId: $activeUserId,
			selfDisplayName,
			selfColor: getLocalPlayerColor(),
			users: $users,
			playerOrder: $playerOrder,
			playerColorOverrides: $playerColorOverrides
		});
	})();

	$: clip = (() => {
		if (!browser) return { left: x, top: y };
		const pad = 8;
		const maxL = Math.max(pad, window.innerWidth - MENU_W - pad);
		const maxT = Math.max(pad, window.innerHeight - MENU_H - pad);
		return {
			left: Math.min(Math.max(pad, x), maxL),
			top: Math.min(Math.max(pad, y), maxT)
		};
	})();

	$: sel = $game.pieces.filter((p) => $game.selectedIds.has(p.id));
	$: arrangeUnlockedCount = [...$game.selectedIds].filter((id) => {
		const p = $game.pieces.find((x) => x.id === id);
		return p != null && !p.locked;
	}).length;
	$: showFlip = sel.some((p) => pieceSupportsFlip(p));
	$: showArrange = sel.length > 1 && sel.every((p) => hasAttr(p, 'move'));
	$: showShuffle =
		sel.length > 1 &&
		sel.every((p) => hasAttr(p, 'move')) &&
		arrangeUnlockedCount >= 2;
	/** Same eligibility as Shuffle — reorder identities by piece type without moving slots. */
	$: showGroupByType = showShuffle;
	$: showDeal =
		sel.length >= 1 && sel.every((p) => hasAttr(p, 'move')) && stashRoster.length > 0;

	$: arrangeFlipCapableCount = sel.filter((p) => pieceSupportsFlip(p)).length;

	$: showSpacerAfterFlip =
		showFlip && (showShuffle || showGroupByType || showArrange || showDeal);
	$: showSpacerBeforeDeal =
		showDeal && (showFlip || showShuffle || showGroupByType || showArrange);
</script>

<DealToDialog
	open={dealOpen}
	roster={stashRoster}
	maxCards={sel.filter((p) => hasAttr(p, 'move')).length}
	reducedMotion={prefersReducedMotion()}
	onConfirm={(cardCount, rosterIndices) => {
		void g.runDealCardsToRoster(rosterIndices, cardCount, {
			reducedMotion: prefersReducedMotion()
		});
	}}
	onClose={() => (dealOpen = false)}
/>

{#if open && (showFlip || showShuffle || showGroupByType || showArrange || showDeal)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<ul
		class="ctx"
		data-bge-context-menu
		style:top="{clip.top}px"
		style:left="{clip.left}px"
		onclick={(e) => e.stopPropagation()}
		onpointerdown={(e) => e.stopPropagation()}
	>
		{#if showFlip}
			<li
				onpointerdown={() => {
					sel.forEach((p) => pieceSupportsFlip(p) && g.flipPiece(p.id));
					open = false;
				}}
			>
				{sel.filter((p) => pieceSupportsFlip(p)).length > 1 ? 'Flip all' : 'Flip'}
			</li>
		{/if}
		{#if showSpacerAfterFlip}
			<li class="spacer"></li>
		{/if}
		{#if showShuffle}
			<li
				onpointerdown={() => {
					g.runShuffleMovableSelection();
					open = false;
				}}
			>
				Shuffle
			</li>
		{/if}
		{#if showShuffle && (showGroupByType || showArrange)}
			<li class="spacer"></li>
		{/if}
		{#if showGroupByType}
			<li
				title="Same layout as now — only swaps which piece sits in which slot, ordered by piece type along the spread. Unsaved boards use size as type hint."
				onpointerdown={() => {
					g.runArrangeGroupByPieceType();
					open = false;
				}}
			>
				Sort by type
			</li>
		{/if}
		{#if showGroupByType && showArrange}
			<li class="spacer"></li>
		{/if}
		{#if showArrange}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li class="embed" onpointerdown={(e) => e.stopPropagation()}>
				<p class="embed-title">Arrange</p>
				<ArrangementControls
					compact
					contextMenu
					showNoFlipSubhint={false}
					gapPresetMode
					useSelectionUnlockedHint
					unlockedCount={arrangeUnlockedCount}
					selectedCount={$game.selectedIds.size}
					flipCapableCount={arrangeFlipCapableCount}
					onAfterApply={() => (open = false)}
				/>
			</li>
		{/if}
		{#if showSpacerBeforeDeal}
			<li class="spacer"></li>
		{/if}
		{#if showDeal}
			<li
				onpointerdown={() => {
					open = false;
					dealOpen = true;
				}}
			>
				Deal to…
			</li>
		{/if}
	</ul>
{/if}

<style>
	.ctx {
		display: block;
		position: fixed;
		list-style: none;
		background: var(--color-context-bg);
		border: 1px solid var(--color-border-strong);
		z-index: 2000000003;
		box-shadow: var(--shadow-md);
		border-radius: 3px;
		padding: 2px 0;
		margin: 0;
		min-width: 108px;
		max-width: min(280px, calc(100vw - 16px));
		font-size: 16px;
	}
	.ctx li {
		padding: 5px 10px;
		min-height: 32px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		font-size: 16px;
		line-height: 1.25;
		color: var(--color-text);
		cursor: pointer;
	}
	.ctx li:not(.embed):not(.spacer):hover {
		background: var(--color-ctx-hover-bg);
		color: #fff;
	}
	.ctx li.embed {
		flex-direction: column;
		align-items: stretch;
		cursor: default;
		padding: 4px 6px 6px;
		min-height: unset;
	}
	.embed-title {
		margin: 0 0 3px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}
	/* Divider only: .ctx li min-height would otherwise force a tall blank “row” */
	.ctx li.spacer {
		min-height: 0;
		height: 0;
		padding: 0;
		margin: 2px 0;
		overflow: hidden;
		flex: 0 0 auto;
		align-self: stretch;
		border: none;
		border-top: 1px solid var(--color-border);
		cursor: default;
		pointer-events: none;
	}
</style>
