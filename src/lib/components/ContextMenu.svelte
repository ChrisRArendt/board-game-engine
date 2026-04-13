<script lang="ts">
	import { browser } from '$app/environment';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import { hasAttr } from '$lib/engine/pieces';

	export let open = false;
	export let x = 0;
	export let y = 0;

	const MENU_W = 200;
	const MENU_H = 220;

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
	$: showSpacer = (showFlip || showShuf) && (showFan || showStack);
</script>

{#if open && (showFlip || showShuf || showFan || showStack)}
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
