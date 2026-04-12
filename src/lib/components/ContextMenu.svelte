<script lang="ts">
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import { hasAttr } from '$lib/engine/pieces';

	export let open = false;
	export let x = 0;
	export let y = 0;

	$: sel = $game.pieces.filter((p) => $game.selectedIds.has(p.id));
	$: showFlip = sel.some((p) => hasAttr(p, 'flip'));
	$: showShuf = sel.length > 1 && sel.every((p) => hasAttr(p, 'shuffle'));
	$: showFan = sel.length > 1;
	$: showStack = sel.length > 1;
	$: showSpacer = (showFlip || showShuf) && (showFan || showStack);
</script>

{#if open && (showFlip || showShuf || showFan || showStack)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<ul class="ctx" style:top="{y}px" style:left="{x}px">
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
		background: #fff;
		border: 1px solid #c3c3c3;
		z-index: 2000000003;
		box-shadow: 0 7px 16px rgba(0, 0, 0, 0.4);
		border-radius: 4px;
		padding: 4px 0;
		margin: 0;
		min-width: 120px;
	}
	.ctx li {
		padding: 4px 20px;
		font-size: 14px;
		color: #333;
		cursor: pointer;
	}
	.ctx li:hover {
		background: linear-gradient(to bottom, #aaa, #777);
		color: #fff;
	}
	.spacer {
		height: 0;
		border-top: 1px solid #ddd;
		margin: 5px 0;
		padding: 0;
		cursor: default;
	}
</style>
