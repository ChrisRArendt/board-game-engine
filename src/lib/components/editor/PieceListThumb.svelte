<script lang="ts">
	/**
	 * Square preview for the pieces list: centered artwork with padding.
	 * Legacy horizontal sprites (front|back in one file) show the right half only (front face).
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

	type Mode = 'loading' | 'sprite' | 'fit';
	let mode = $state<Mode>('loading');

	$effect(() => {
		const u = url;
		mode = 'loading';
		const img = new Image();
		img.onload = () => {
			const w = img.naturalWidth;
			const h = img.naturalHeight;
			if (h < 8 || w < 8) {
				mode = 'fit';
				return;
			}
			// Legacy horizontal sprite (two portrait faces side by side) — ratio often ~1.4–1.5 (e.g. 600×420).
			const r = w / h;
			const likelySprite = r >= 1.33 && r <= 2.45 && w >= 120;
			mode = likelySprite ? 'sprite' : 'fit';
		};
		img.onerror = () => {
			mode = 'fit';
		};
		img.src = u;
		return () => {
			img.onload = null;
			img.onerror = null;
		};
	});
</script>

<div class="piece-list-thumb" aria-hidden="true">
	{#if mode === 'loading'}
		<div class="thumb-loading"></div>
	{:else if mode === 'sprite'}
		<div class="thumb-inner thumb-sprite" style:background-image="url({url})"></div>
	{:else}
		<div class="thumb-inner thumb-fit" style:background-image="url({url})"></div>
	{/if}
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
	}
	/* Right half = front (matches legacy composeFrontBackSprite). */
	.thumb-sprite {
		background-size: 200% 100%;
		background-position: 100% 50%;
	}
	.thumb-fit {
		background-size: contain;
		background-position: center;
		padding: 6px;
	}
	.thumb-loading {
		width: 100%;
		height: 100%;
		min-height: 72px;
		background: linear-gradient(90deg, #2a2a30 0%, #1e1e24 50%, #2a2a30 100%);
		background-size: 200% 100%;
		animation: shimmer 1.1s ease-in-out infinite;
	}
	@keyframes shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
</style>
