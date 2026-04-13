<script lang="ts">
	import { browser } from '$app/environment';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import { hasAttr } from '$lib/engine/pieces';
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

	const MENU_W = 280;
	const MENU_H = 520;

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
	$: showFlip = sel.some((p) => hasAttr(p, 'flip'));
	$: showArrange = sel.length > 1 && sel.every((p) => hasAttr(p, 'move'));
	$: showDeal =
		sel.length >= 1 && sel.every((p) => hasAttr(p, 'move')) && stashRoster.length > 0;

	$: arrangeUnlockedCount = [...$game.selectedIds].filter((id) => {
		const p = $game.pieces.find((x) => x.id === id);
		return p != null && !p.locked;
	}).length;

	$: arrangeFlipCapableCount = sel.filter((p) => hasAttr(p, 'flip')).length;

	$: showSpacerAfterFlip = showFlip && (showArrange || showDeal);
	$: showSpacerBeforeDeal = showDeal && (showFlip || showArrange);
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

{#if open && (showFlip || showArrange || showDeal)}
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
					sel.forEach((p) => hasAttr(p, 'flip') && g.flipPiece(p.id));
					open = false;
				}}
			>
				{sel.filter((p) => hasAttr(p, 'flip')).length > 1 ? 'Flip all' : 'Flip'}
			</li>
		{/if}
		{#if showSpacerAfterFlip}
			<li class="spacer"></li>
		{/if}
		{#if showArrange}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li class="embed" onpointerdown={(e) => e.stopPropagation()}>
				<p class="embed-title">Arrangement</p>
				<ArrangementControls
					compact
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
		border-radius: 4px;
		padding: 4px 0;
		margin: 0;
		min-width: 120px;
		max-width: min(320px, calc(100vw - 16px));
	}
	.ctx li {
		padding: 12px 20px;
		min-height: 44px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		font-size: 14px;
		color: var(--color-text);
		cursor: pointer;
	}
	.ctx li:not(.embed):hover {
		background: var(--color-ctx-hover-bg);
		color: #fff;
	}
	.ctx li.embed {
		flex-direction: column;
		align-items: stretch;
		cursor: default;
		padding: 10px 14px 14px;
		min-height: unset;
	}
	.embed-title {
		margin: 0 0 8px;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}
	.spacer {
		height: 0;
		border-top: 1px solid var(--color-border);
		margin: 5px 0;
		padding: 0;
		cursor: default;
	}
</style>
