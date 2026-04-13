<script lang="ts">
	import { browser } from '$app/environment';
	import type { PieceFieldStyle } from '$lib/editor/fieldBindings';
	import type { CardBackground, CardLayer, ImageLayer, ShapeLayer, TextLayer } from '$lib/editor/types';
	import {
		backgroundStyle,
		resolveImageMediaId,
		resolveTextContent,
		shapeFillStyle,
		sortLayers
	} from '$lib/editor/layerRenderer';

	type Props = {
		width: number;
		height: number;
		borderRadius?: number;
		background: CardBackground;
		layers: CardLayer[];
		/** fieldName -> string value for bound fields */
		fieldValues?: Record<string, string>;
		/** Per-field text / layer background overrides (piece editor). */
		fieldStyles?: Record<string, PieceFieldStyle>;
		/** Optional: scale entire card for display (1 = actual px size) */
		displayScale?: number;
		/** Template editor only: show bounds + filler when text/image content is empty (not used for export). */
		showEmptyPlaceholders?: boolean;
		/** game_media.id -> public URL */
		mediaUrls?: Record<string, string>;
	};

	let {
		width,
		height,
		borderRadius = 0,
		background,
		layers,
		fieldValues = {},
		fieldStyles = {},
		displayScale = 1,
		showEmptyPlaceholders = false,
		mediaUrls = {}
	}: Props = $props();

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

	function imageUrlResolved(layer: ImageLayer): string {
		const id = resolveImageMediaId(layer, fieldValues);
		const url = id ? (mediaUrls[id] ?? '') : '';
		// #region agent log
		if (browser) {
			const fn = layer.fieldBinding?.fieldName;
			const fv = fn != null ? fieldValues[fn] : undefined;
			if (id && !url) {
				fetch('http://localhost:7278/ingest/b8376de9-9c29-4e05-bd62-1d6be57bcdc1', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a428b6' },
					body: JSON.stringify({
						sessionId: 'a428b6',
						location: 'CardPreview:imageUrlResolved',
						message: 'resolved id but empty url (mediaUrls miss)',
						data: {
							layerId: layer.id,
							fieldName: fn,
							resolvedId: id,
							mediaKeysCount: Object.keys(mediaUrls).length
						},
						timestamp: Date.now(),
						hypothesisId: 'A'
					})
				}).catch(() => {});
			}
			if (layer.fieldBinding && !id && fv != null && String(fv).trim() !== '') {
				fetch('http://localhost:7278/ingest/b8376de9-9c29-4e05-bd62-1d6be57bcdc1', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a428b6' },
					body: JSON.stringify({
						sessionId: 'a428b6',
						location: 'CardPreview:imageUrlResolved',
						message: 'field value present but resolveImageMediaId empty',
						data: { layerId: layer.id, fieldName: fn, fvPreview: String(fv).slice(0, 40) },
						timestamp: Date.now(),
						hypothesisId: 'B'
					})
				}).catch(() => {});
			}
		}
		// #endregion
		if (!id) return '';
		return url;
	}

	function textStripeHeightPx(T: TextLayer): number {
		return Math.max(4, T.fontSize * (T.lineHeight || 1.2));
	}

	function styleForField(fieldName: string | undefined): PieceFieldStyle | undefined {
		if (!fieldName) return undefined;
		return fieldStyles[fieldName];
	}

	const sorted = $derived(sortLayers(layers.filter((l) => l.visible)));

	$effect(() => {
		if (!browser) return;
		const imgs = layers.filter((l): l is ImageLayer => l.type === 'image');
		// #region agent log
		fetch('http://localhost:7278/ingest/b8376de9-9c29-4e05-bd62-1d6be57bcdc1', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a428b6' },
			body: JSON.stringify({
				sessionId: 'a428b6',
				location: 'CardPreview:layersSnapshot',
				message: 'image layers + visibility',
				data: {
					imgs: imgs.map((L) => ({
						id: L.id,
						visible: L.visible,
						z: L.zIndex,
						fn: L.fieldBinding?.fieldName
					})),
					sortedCount: sorted.length,
					fieldValueKeys: Object.keys(fieldValues),
					mediaKeysCount: Object.keys(mediaUrls).length
				},
				timestamp: Date.now(),
				hypothesisId: 'C'
			})
		}).catch(() => {});
		// #endregion
	});
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
				{@const resolved = resolveTextContent(T, fieldValues)}
				{@const showTextPh = showEmptyPlaceholders && !resolved.trim()}
				{@const st = styleForField(T.fieldBinding?.fieldName)}
				{@const textColor = showTextPh
					? 'transparent'
					: st?.textColor?.trim()
						? st.textColor
						: T.color}
				<div
					class="layer text"
					class:text-ph={showTextPh}
					style={layerStyle(T)}
					style:font-family={T.fontFamily}
					style:font-size="{T.fontSize}px"
					style:font-weight={T.fontWeight}
					style:color={textColor}
					style:background-color={st?.backgroundColor?.trim() ? st.backgroundColor : 'transparent'}
					style:text-align={T.textAlign}
					style:line-height={T.lineHeight}
					style:--text-stripe="{textStripeHeightPx(T)}px"
				>
					{#if showTextPh}
						<span class="text-ph-fill" aria-hidden="true"></span>
					{:else}
						{resolved}
					{/if}
				</div>
			{:else if L.type === 'image'}
				{@const I = L as ImageLayer}
				{@const imgUrl = imageUrlResolved(I)}
				{@const showImgPh = showEmptyPlaceholders && !imgUrl}
				{@const ist = styleForField(I.fieldBinding?.fieldName)}
				<div
					class="layer img"
					class:img-ph={showImgPh}
					style={layerStyle(I)}
					style:background-color={ist?.backgroundColor?.trim() ? ist.backgroundColor : 'transparent'}
				>
					{#if imgUrl}
						<img
							src={imgUrl}
							alt=""
							style:width="100%"
							style:height="100%"
							style:object-fit={I.objectFit}
						/>
					{:else if showImgPh}
						<div class="img-ph-inner" aria-hidden="true"></div>
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
	.layer.text.text-ph {
		color: transparent;
	}
	.text-ph-fill {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 100%;
		box-sizing: border-box;
		background: repeating-linear-gradient(
			to bottom,
			rgba(255, 255, 255, 0) 0,
			rgba(255, 255, 255, 0) calc(var(--text-stripe, 18px) - 1px),
			rgba(255, 255, 255, 0.1) calc(var(--text-stripe, 18px) - 1px),
			rgba(255, 255, 255, 0.1) var(--text-stripe, 18px)
		);
		border-radius: 2px;
		outline: 1px dashed rgba(255, 255, 255, 0.18);
		outline-offset: -1px;
	}
	.layer.img {
		overflow: hidden;
	}
	.layer.img.img-ph {
		background: rgba(30, 30, 36, 0.85);
	}
	.img-ph-inner {
		width: 100%;
		height: 100%;
		min-height: 100%;
		box-sizing: border-box;
		background: repeating-conic-gradient(#2a2a32 0% 25%, #1e1e24 0% 50%) 50% / 12px 12px;
		opacity: 0.85;
		border: 1px dashed rgba(255, 255, 255, 0.2);
	}
	.layer.img img {
		display: block;
		pointer-events: none;
	}
</style>
