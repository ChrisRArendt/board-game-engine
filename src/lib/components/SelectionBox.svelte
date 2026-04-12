<script lang="ts">
	export let rect: { x: number; y: number; w: number; h: number };
</script>

<div
	class="selectbox"
	style:left="{rect.x}px"
	style:top="{rect.y}px"
	style:width="{rect.w}px"
	style:height="{rect.h}px"
></div>

<style>
	.selectbox {
		position: fixed;
		background-color: rgba(200, 200, 200, 0.2);
		border-top: 1px solid rgba(180, 180, 180, 0.4);
		border-right: 1px solid rgba(180, 180, 180, 0.4);
		border-bottom: 1px solid rgba(220, 220, 220, 0.4);
		border-left: 1px solid rgba(220, 220, 220, 0.4);
		z-index: 1999999999;
		pointer-events: none;
	}
</style>
