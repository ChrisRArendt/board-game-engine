<script lang="ts">
	import { browser } from '$app/environment';
	import type { PieceFieldStyle } from '$lib/editor/fieldBindings';
	import type { CardBackground, CardLayer, ImageLayer, ShapeLayer, TextLayer } from '$lib/editor/types';
	import { ensureGoogleFontsForLayers } from '$lib/editor/googleFontsLoader';
	import {
		cardFaceBackgroundCss,
		resolveImageMediaId,
		resolveTextContent,
		shapeFillStyle,
		sortLayers
	} from '$lib/editor/layerRenderer';

	type Props = {
		width: number;
		height: number;
		borderRadius?: number;
		/** Inset frame border (px); drawn inside width×height (box-sizing border-box). */
		frameBorderWidth?: number;
		frameBorderColor?: string;
		/**
		 * Corner radius (px) for clipping layers inside the frame.
		 * Omit/null = max(0, borderRadius − frameBorderWidth). Set explicitly for a custom inner curve.
		 */
		frameInnerRadius?: number | null;
		background: CardBackground;
		layers: CardLayer[];
		/** fieldName -> string value for bound fields */
		fieldValues?: Record<string, string>;
		/** Per-field text / layer background overrides (piece editor). */
		fieldStyles?: Record<string, PieceFieldStyle>;
		/** Optional: scale entire card for display (1 = actual px size) */
		displayScale?: number;
		/** When true, no CSS transform scale on the root (better for html2canvas: frame border + crisp edges). */
		flattenLayout?: boolean;
		/** Template editor only: show bounds + filler when text/image content is empty (not used for export). */
		showEmptyPlaceholders?: boolean;
		/** game_media.id -> public URL */
		mediaUrls?: Record<string, string>;
	};

	let {
		width,
		height,
		borderRadius = 0,
		frameBorderWidth = 0,
		frameBorderColor = '#000000',
		frameInnerRadius = null,
		background,
		layers,
		fieldValues = {},
		fieldStyles = {},
		displayScale = 1,
		showEmptyPlaceholders = false,
		mediaUrls = {},
		flattenLayout = false
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
		if (!id) return '';
		return mediaUrls[id] ?? '';
	}

	function effectiveFontSizePx(T: TextLayer, fieldName: string | undefined): number {
		const st = styleForField(fieldName);
		if (st?.fontSize != null && Number.isFinite(st.fontSize) && st.fontSize > 0) {
			return st.fontSize;
		}
		return T.fontSize;
	}

	function textStripeHeightPx(T: TextLayer, fontSizePx: number): number {
		return Math.max(4, fontSizePx * (T.lineHeight || 1.2));
	}

	function styleForField(fieldName: string | undefined): PieceFieldStyle | undefined {
		if (!fieldName) return undefined;
		return fieldStyles[fieldName];
	}

	const sorted = $derived(sortLayers(layers.filter((l) => l.visible)));

	/** Border is on `.card-face` (border-box); padding box is already inside the frame — do not inset again. */
	const contentClipRadius = $derived(
		frameInnerRadius != null && Number.isFinite(frameInnerRadius)
			? Math.max(0, Math.min(frameInnerRadius, borderRadius ?? 0))
			: Math.max(0, (borderRadius ?? 0) - (frameBorderWidth ?? 0))
	);

	$effect(() => {
		if (!browser) return;
		ensureGoogleFontsForLayers(layers);
	});
</script>

<div
	class="card-root"
	class:card-root--flat={flattenLayout}
	style:width="{flattenLayout ? width : width * displayScale}px"
	style:height="{flattenLayout ? height : height * displayScale}px"
	style:transform={flattenLayout ? 'none' : `scale(${displayScale})`}
	style:transform-origin="top left"
>
	<div
		class="card-face"
		style:width="{width}px"
		style:height="{height}px"
		style:border-radius="{borderRadius}px"
		style:border={frameBorderWidth > 0
			? `${frameBorderWidth}px solid ${frameBorderColor}`
			: 'none'}
		style:background={cardFaceBackgroundCss(background, mediaUrls)}
	>
		<div
			class="card-content"
			style:inset="0"
			style:border-radius="{contentClipRadius}px"
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
				{@const multiline = T.fieldBinding?.fieldType === 'textarea'}
				{@const showTextPh = showEmptyPlaceholders && !resolved.trim()}
				{@const st = styleForField(T.fieldBinding?.fieldName)}
				{@const fsPx = effectiveFontSizePx(T, T.fieldBinding?.fieldName)}
				{@const textColor = showTextPh
					? 'transparent'
					: st?.textColor?.trim()
						? st.textColor
						: T.color}
				<div
					class="layer text"
					class:text-ph={showTextPh}
					class:multiline={multiline}
					class:text-v-center={T.verticalAlign === 'center'}
					class:text-v-bottom={T.verticalAlign === 'bottom'}
					style={layerStyle(T)}
					style:font-family={T.fontFamily}
					style:font-size="{fsPx}px"
					style:font-weight={T.fontWeight}
					style:font-style={T.fontStyle ?? 'normal'}
					style:color={textColor}
					style:background-color={st?.backgroundColor?.trim() ? st.backgroundColor : 'transparent'}
					style:text-align={T.textAlign}
					style:line-height={T.lineHeight}
					style:letter-spacing="{T.letterSpacingPx ? `${T.letterSpacingPx}px` : '0'}"
					style:text-decoration={T.textDecoration ?? 'none'}
					style:text-transform={T.textTransform ?? 'none'}
					style:text-shadow={T.textShadow?.trim() ? T.textShadow : 'none'}
					style:--text-stripe="{textStripeHeightPx(T, fsPx)}px"
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
							style:object-position={I.objectPosition?.trim() ? I.objectPosition : 'center'}
						/>
					{:else if showImgPh}
						<div class="img-ph-inner" aria-hidden="true"></div>
					{/if}
				</div>
			{/if}
		{/each}
		</div>
	</div>
</div>

<style>
	.card-root {
		position: relative;
		overflow: visible;
	}
	.card-root--flat {
		display: inline-block;
		vertical-align: top;
	}
	.card-face {
		position: relative;
		overflow: hidden;
		box-sizing: border-box;
	}
	.card-content {
		position: absolute;
		z-index: 1;
		box-sizing: border-box;
		overflow: hidden;
		pointer-events: auto;
	}
	.layer {
		position: absolute;
		box-sizing: border-box;
	}
	.layer.text {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		overflow: hidden;
		word-break: break-word;
	}
	.layer.text.text-v-center {
		justify-content: center;
	}
	.layer.text.text-v-bottom {
		justify-content: flex-end;
	}
	.layer.text.multiline {
		white-space: pre-wrap;
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
