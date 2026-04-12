<script lang="ts">
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import { hasAttr } from '$lib/engine/pieces';
	import { browser } from '$app/environment';
	import { getViewportSize } from '$lib/engine/geometry';

	export let curGame = 'bsg_1';

	function focalCenter() {
		const vp = getViewportSize();
		if (!browser) return { left: 0, top: 0 };
		return { left: vp.w / 2 + window.scrollX, top: vp.h / 2 + window.scrollY };
	}

	$: sel = $game.pieces.filter((p) => $game.selectedIds.has(p.id));
	$: showDup = sel.length > 0 && sel.every((p) => hasAttr(p, 'duplicate'));
	$: showFlip = sel.length > 0 && sel.every((p) => hasAttr(p, 'flip'));
	$: showDest = sel.length > 0 && sel.every((p) => hasAttr(p, 'destroy'));
	$: showShuf = sel.length > 1 && sel.every((p) => hasAttr(p, 'shuffle'));
	$: showFan = sel.length > 1;
	$: showStack = sel.length > 1;

	/** Not named onRoller — Svelte 5 treats `on` + PascalCase as event syntax, not props. */
	export let roller: () => void;
	export let viewer: () => void;
	export let openSettings: () => void;
	export let openConnection: () => void;
</script>

<ul class="controls">
	<li class="spacer"></li>
	<li class="zoomout"><p on:pointerdown={() => g.adjustZoom(-1, focalCenter())}>-</p></li>
	<li class="zoomin"><p on:pointerdown={() => g.adjustZoom(1, focalCenter())}>+</p></li>
	<li class="spacer double"></li>
	<li class="origin"><p on:pointerdown={() => g.resetPan()}>O</p></li>
	<li class="rulebook">
		<p
			on:pointerdown={() => {
				if (browser) window.open(`/data/${curGame}/rules.pdf`, '_blank');
			}}
		>
			Rules
		</p>
	</li>
	<li class="spacer double"></li>
	<li class="textbox"><p on:pointerdown={roller}>Roller</p></li>
	<li class="textbox"><p on:pointerdown={viewer}>Viewer</p></li>
	{#if showDup}
		<li class="dup"><p on:pointerdown={() => sel.forEach((p) => g.duplicatePiece(p.id))}>Duplicate</p></li>
	{/if}
	{#if showDest}
		<li class="dest"><p on:pointerdown={() => sel.forEach((p) => g.destroyPiece(p.id))}>Destroy</p></li>
	{/if}
	{#if showFlip}
		<li class="flip"><p on:pointerdown={() => sel.forEach((p) => g.flipPiece(p.id))}>Flip</p></li>
	{/if}
	{#if showShuf}
		<li class="shuf"><p on:pointerdown={() => g.runShuffleSelected()}>Shuffle</p></li>
	{/if}
	{#if showFan}
		<li class="fan"><p on:pointerdown={() => g.runArrangeFanned()}>Fan</p></li>
	{/if}
	{#if showStack}
		<li class="stack">
			<p
				on:pointerdown={() => {
					g.runShuffleStackToolbar();
				}}
			>
				Stack
			</p>
		</li>
	{/if}
	<li class="right">
		<ul>
			<li class="settings"><p on:pointerdown={openSettings}>Settings</p></li>
			<li class="connection"><p on:pointerdown={openConnection}>Connection</p></li>
			<li class="spacer"></li>
		</ul>
	</li>
</ul>

<style>
	.controls {
		width: 100%;
		position: fixed;
		top: 0;
		left: 0;
		font-size: 0;
		list-style: none;
		z-index: 2000000001;
		background: linear-gradient(to bottom, rgba(255, 255, 255, 0.9), rgba(230, 230, 230, 0.9));
		box-shadow: 0 6px 10px rgba(0, 0, 0, 0.35);
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
	}
	.controls > li {
		height: 22px;
		display: inline-flex;
		align-items: center;
		vertical-align: top;
		cursor: pointer;
	}
	.controls p {
		padding: 0 10px;
		line-height: 22px;
		font-size: 15px;
		color: #333;
		margin: 0;
		user-select: none;
	}
	.controls li:hover p {
		background: linear-gradient(to bottom, #aaa, #777);
		color: #fff;
	}
	.spacer {
		width: 8px;
		cursor: default;
	}
	.spacer.double {
		width: 1px;
		border-left: 1px solid rgba(0, 0, 0, 0.15);
		border-right: 1px solid rgba(0, 0, 0, 0.15);
		margin: 0 5px;
	}
	.right {
		margin-left: auto;
	}
	.right ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
	}
</style>
