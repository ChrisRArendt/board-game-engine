<script lang="ts">
	/**
	 * Square preview for the pieces list: centered artwork with padding.
	 * Renders use separate `cards/{id}.png` files (front only); no sprite cropping — avoids
	 * browser-specific half-image heuristics.
	 */
	let {
		src,
		cacheKey = ''
	}: {
		src: string;
		/** Bust browser cache when the file updates (e.g. card updated_at). */
		cacheKey?: string;
	} = $props();

	const url = $derived(
		cacheKey
			? `${src}${src.includes('?') ? '&' : '?'}v=${encodeURIComponent(cacheKey)}`
			: src
	);
</script>

<div class="piece-list-thumb" aria-hidden="true">
	<div class="thumb-inner" style:background-image="url({url})"></div>
</div>

<style>
	.piece-list-thumb {
		width: 100%;
		height: 100%;
		min-height: 0;
		box-sizing: border-box;
	}
	.thumb-inner {
		width: 100%;
		height: 100%;
		min-height: 0;
		box-sizing: border-box;
		background-repeat: no-repeat;
		background-size: contain;
		background-position: center;
		padding: 6px;
	}
</style>
