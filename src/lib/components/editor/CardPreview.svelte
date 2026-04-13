<script lang="ts">
	import type { CardBackground, CardLayer, ImageLayer, ShapeLayer, TextLayer } from '$lib/editor/types';
	import {
		backgroundStyle,
		resolveImageMediaId,
		resolveTextContent,
		shapeFillStyle,
		sortLayers
	} from '$lib/editor/layerRenderer';
	export let width: number;
	export let height: number;
	export let borderRadius = 0;
	export let background: CardBackground;
	export let layers: CardLayer[];
	/** fieldName -> string value for bound fields */
	export let fieldValues: Record<string, string> = {};
	/** Optional: scale entire card for display (1 = actual px size) */
	export let displayScale = 1;

	function layerStyle(L: CardLayer): string {
		const o = L.opacity ?? 1;
		const parts = [
			`left:${L.x}px`,
			`top:${L.y}px`,
			`width:${L.width}px`,
			`height:${L.height}px`,
			`opacity:${o}`,
			`z-index:${L.zIndex}`
		];
		return parts.join(';');
	}

	/** game_media.id -> public URL */
	export let mediaUrls: Record<string, string> = {};

	function imageUrlResolved(layer: ImageLayer): string {
		const id = resolveImageMediaId(layer, fieldValues);
		if (!id) return '';
		return mediaUrls[id] ?? '';
	}

	$: sorted = sortLayers(layers.filter((l) => l.visible));
</script>

<div
	class="card-root"
	style:width="{width * displayScale}px"
	style:height="{height * displayScale}px"
	style:transform="scale({displayScale})"
	style:transform-origin="top left"
>
	<div
		class="card-face"
		style:width="{width}px"
		style:height="{height}px"
		style:border-radius="{borderRadius}px"
		style:background={backgroundStyle(background)}
	>
		{#each sorted as L (L.id)}
			{#if L.type === 'shape'}
				{@const S = L as ShapeLayer}
				<div
					class="layer shape"
					style={layerStyle(S)}
					style:background={shapeFillStyle(S.fill)}
					style:border-radius="{S.borderRadius}px"
				></div>
			{:else if L.type === 'text'}
				{@const T = L as TextLayer}
				<div
					class="layer text"
					style={layerStyle(T)}
					style:font-family={T.fontFamily}
					style:font-size="{T.fontSize}px"
					style:font-weight={T.fontWeight}
					style:color={T.color}
					style:text-align={T.textAlign}
					style:line-height={T.lineHeight}
				>
					{resolveTextContent(T, fieldValues)}
				</div>
			{:else if L.type === 'image'}
				{@const I = L as ImageLayer}
				<div class="layer img" style={layerStyle(I)}>
					{#if imageUrlResolved(I)}
						<img
							src={imageUrlResolved(I)}
							alt=""
							style:width="100%"
							style:height="100%"
							style:object-fit={I.objectFit}
						/>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	.card-root {
		position: relative;
		overflow: visible;
	}
	.card-face {
		position: relative;
		overflow: hidden;
		box-sizing: border-box;
	}
	.layer {
		position: absolute;
		box-sizing: border-box;
	}
	.layer.text {
		overflow: hidden;
		word-break: break-word;
	}
	.layer.img img {
		display: block;
		pointer-events: none;
	}
</style>
