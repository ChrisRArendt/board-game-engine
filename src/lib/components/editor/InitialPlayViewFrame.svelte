<script lang="ts">
	import { game } from '$lib/stores/game';
	import { maxZIndex } from '$lib/engine/pieces';
	import type { InitialPlayViewState } from '$lib/engine/types';

	/** Saved world rect (table coords) shown as the gold frame. */
	export let view: InitialPlayViewState;
	/** Table size in world px (SVG viewBox). */
	export let tableW: number;
	export let tableH: number;

	$: r = view.world_rect;
	$: topStack = Math.max(
		$game.pieces.length ? maxZIndex($game.pieces) : 0,
		$game.widgets.length ? Math.max(...$game.widgets.map((w) => w.zIndex)) : 0
	);
	/** Above pieces/widgets, below selected resize handles (zIndex + 100000). */
	$: frameZ = Math.max(999990, topStack + 10);
</script>

<svg
	class="initial-play-view-frame"
	width={tableW}
	height={tableH}
	viewBox="0 0 {tableW} {tableH}"
	aria-hidden="true"
	style:z-index={frameZ}
>
	<rect
		x={r.x}
		y={r.y}
		width={r.w}
		height={r.h}
		fill="rgba(250, 204, 21, 0.06)"
		stroke="rgba(250, 204, 21, 0.95)"
		stroke-width="3"
		stroke-dasharray="14 8"
	/>
</svg>

<style>
	.initial-play-view-frame {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: none;
		overflow: visible;
	}
</style>
