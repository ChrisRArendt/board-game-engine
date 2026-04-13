<script lang="ts">
	import type { PieceInstance } from '$lib/engine/types';
	import { hasAttr } from '$lib/engine/pieces';

	export let piece: PieceInstance;
	export let curGame: string;
	/** When set, image URL is `${assetBaseUrl}${piece.bg}` (include trailing slash in base). */
	export let assetBaseUrl: string | null = null;
	export let replayMode = false;
	/** True when this piece is in another player's private zone — show card back only. */
	export let faceHidden = false;
	export let selected = false;
	export let dragging = false;
	export let pressing = false;
	export let remoteColor: string | undefined = undefined;
	export let onpointerdown: ((e: PointerEvent) => void) | undefined = undefined;
	/** Local-only enlarged viewer (double-click); not synced to other players */
	export let onpiecedblclick: ((id: number) => void) | undefined = undefined;
	export let editorMode = false;

	$: canFlip = hasAttr(piece, 'flip');
	$: rot = piece.rotation ?? 0;
	$: bgUrl = assetBaseUrl
		? `${assetBaseUrl}${piece.bg}`
		: `/data/${curGame}/images/${piece.bg}`;
	$: showFace = !faceHidden;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="piece"
	class:selected
	class:dragging
	class:pressing
	class:replay={replayMode}
	class:face-hidden={faceHidden}
	class:editor-locked={editorMode && piece.locked}
	data-piece-id={piece.id}
	title={faceHidden ? 'Hidden — private area' : undefined}
	style:z-index={piece.zIndex}
	style:width="{piece.initial_size.w}px"
	style:height="{piece.initial_size.h}px"
	style:transform-origin="center center"
	style:transform={dragging
		? `translate3d(${piece.x}px, ${piece.y}px, 0) rotate(${rot}deg) scale(1.05)`
		: `translate3d(${piece.x}px, ${piece.y}px, 0) rotate(${rot}deg)`}
	style:background-color={showFace && piece.bg_color ? piece.bg_color : undefined}
	style:background-image={showFace ? `url(${bgUrl})` : undefined}
	/* outline (not border): border shrinks content with border-box + background-clip: content-box */
	style:outline={remoteColor ? `3px dashed ${remoteColor}` : undefined}
	style:background-position={showFace && canFlip
		? piece.flipped
			? '0px 0px'
			: `${-piece.initial_size.w}px 0px`
		: '0 0'}
	style:background-size={showFace && canFlip ? '200% 100%' : '100% 100%'}
	style:border-radius={hasAttr(piece, 'roundcorners') ? '8px' : undefined}
	onpointerdown={(e) => {
		if (replayMode) return;
		e.stopPropagation();
		onpointerdown?.(e);
	}}
	ondblclick={(e) => {
		if (replayMode) return;
		e.stopPropagation();
		onpiecedblclick?.(piece.id);
	}}
></div>
{#if editorMode && piece.locked}
	<div
		class="lock-badge"
		style:left="{piece.x + piece.initial_size.w - 18}px"
		style:top="{piece.y + 4}px"
		style:z-index={piece.zIndex + 1}
		aria-hidden="true"
	>🔒</div>
{/if}

<style>
	.piece {
		background-size: 100% 100%;
		position: absolute;
		background-repeat: no-repeat;
		background-clip: content-box;
		touch-action: none;
		transition:
			box-shadow 150ms ease,
			filter 150ms ease;
	}
	.piece.dragging {
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		filter: brightness(1.05);
		z-index: 999999 !important;
	}
	.piece.pressing:not(.dragging) {
		filter: brightness(1.08);
	}
	.piece.selected {
		outline: 3px solid #3af;
	}
	.piece.replay {
		pointer-events: none;
	}
	.lock-badge {
		position: absolute;
		font-size: 12px;
		pointer-events: none;
		filter: drop-shadow(0 0 2px #000);
	}
	.piece.editor-locked {
		outline-style: dashed;
	}
	.piece.face-hidden {
		background-image: repeating-linear-gradient(
			135deg,
			#2a2d3a,
			#2a2d3a 5px,
			#1e2129 5px,
			#1e2129 10px
		) !important;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
	}
</style>
