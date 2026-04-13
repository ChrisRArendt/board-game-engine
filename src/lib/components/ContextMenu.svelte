<script lang="ts">
	import { browser } from '$app/environment';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import { hasAttr } from '$lib/engine/pieces';
	import SpreadCustomDialog from '$lib/components/SpreadCustomDialog.svelte';
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

	const MENU_W = 220;
	const MENU_H = 480;

	let spreadCustomOpen = false;
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
	$: showShuf = sel.length > 1 && sel.every((p) => hasAttr(p, 'shuffle'));
	$: showFan = sel.length > 1;
	$: showStack = sel.length > 1;
	$: showSpread = sel.length > 1 && sel.every((p) => hasAttr(p, 'move'));
	$: showDeal =
		sel.length >= 1 && sel.every((p) => hasAttr(p, 'move')) && stashRoster.length > 0;
	$: showSpacer = (showFlip || showShuf) && (showFan || showStack || showSpread);
	$: showSpacer2 = showSpread && (showFan || showStack);
	$: showSpacerBeforeDeal =
		showDeal && (showFlip || showShuf || showSpread || showFan || showStack);
</script>

<SpreadCustomDialog
	open={spreadCustomOpen}
	onApply={(gap: number, angle: number) => g.runSpreadCustom(gap, angle)}
	onClose={() => (spreadCustomOpen = false)}
/>

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

{#if open && (showFlip || showShuf || showFan || showStack || showSpread || showDeal)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<ul class="ctx" style:top="{clip.top}px" style:left="{clip.left}px">
		{#if showFlip}
			<li
				on:pointerdown={() => {
					sel.forEach((p) => hasAttr(p, 'flip') && g.flipPiece(p.id));
					open = false;
				}}
			>
				Flip
			</li>
		{/if}
		{#if showShuf}
			<li
				on:pointerdown={() => {
					g.runShuffleSelected();
					open = false;
				}}
			>
				Shuffle
			</li>
		{/if}
		{#if showSpacer}
			<li class="spacer"></li>
		{/if}
		{#if showSpread}
			<li
				on:pointerdown={() => {
					g.runSpreadHorizontal();
					open = false;
				}}
			>
				Spread horizontal
			</li>
			<li
				on:pointerdown={() => {
					g.runSpreadVertical();
					open = false;
				}}
			>
				Spread vertical
			</li>
			<li
				on:pointerdown={() => {
					open = false;
					spreadCustomOpen = true;
				}}
			>
				Spread custom…
			</li>
		{/if}
		{#if showSpacer2}
			<li class="spacer"></li>
		{/if}
		{#if showFan}
			<li
				on:pointerdown={() => {
					g.runArrangeFanned();
					open = false;
				}}
			>
				Arrange Fan
			</li>
		{/if}
		{#if showStack}
			<li
				on:pointerdown={() => {
					g.runArrangeStacked();
					open = false;
				}}
			>
				Arrange Stacked
			</li>
		{/if}
		{#if showSpacerBeforeDeal}
			<li class="spacer"></li>
		{/if}
		{#if showDeal}
			<li
				on:pointerdown={() => {
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
	.ctx li:hover {
		background: var(--color-ctx-hover-bg);
		color: #fff;
	}
	.spacer {
		height: 0;
		border-top: 1px solid var(--color-border);
		margin: 5px 0;
		padding: 0;
		cursor: default;
	}
</style>
