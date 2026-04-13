<script lang="ts">
	import { ZOOM_DEFAULT } from '$lib/engine/geometry';

	export let rect: { x: number; y: number; w: number; h: number };
	/** Board zoom scale; lower = zoomed out → thicker screen-space border. */
	export let zoom = ZOOM_DEFAULT;

	/** ~1px at default zoom; up to ~4px at min zoom (0.15). */
	$: borderPx = Math.min(4, Math.max(1, ZOOM_DEFAULT / zoom));
</script>

<div
	class="selectbox"
	style:left="{rect.x}px"
	style:top="{rect.y}px"
	style:width="{rect.w}px"
	style:height="{rect.h}px"
	style:--bw="{borderPx}px"
></div>

<style>
	.selectbox {
		position: fixed;
		background-color: rgba(200, 200, 200, 0.2);
		border-top: var(--bw) solid rgba(180, 180, 180, 0.6);
		border-right: var(--bw) solid rgba(180, 180, 180, 0.6);
		border-bottom: var(--bw) solid rgba(220, 220, 220, 0.55);
		border-left: var(--bw) solid rgba(220, 220, 220, 0.55);
		z-index: 1999999999;
		pointer-events: none;
	}
</style>
