<script lang="ts">
	import { browser } from '$app/environment';
	import { cubicOut } from 'svelte/easing';
	import { tweened } from 'svelte/motion';
	import type { PieceInstance } from '$lib/engine/types';
	import { backPngUrlFromFrontUrl, hasAttr, pieceSupportsFlip } from '$lib/engine/pieces';

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
	/** Board editor: right-click on piece (browser context menu suppressed). */
	export let onEditorContextMenu: ((e: MouseEvent, pieceId: number) => void) | undefined = undefined;
	/** Play mode: glide toward networked positions instead of jumping (local drag uses raw coords). */
	export let smoothPosition = false;
	/** When set (e.g. arrangement animation), overrides default glide duration (ms). */
	export let smoothDurationMs: number | undefined = undefined;
	/** Arrangement apply: smooth flip via CSS on background-position. */
	export let arrangeAnimating = false;
	/** Board view zoom (world scale); thickens selection ring when zoomed in. */
	export let boardZoom = 1;

	const posX = tweened(0);
	const posY = tweened(0);
	/** Additive ° after drop — eases to 0 for a little “settle” wobble. */
	const settleDragRot = tweened(0);
	const POS_SMOOTH_MS = 120;

	let lastPieceId = -1;
	let liftJitterDeg = 0;
	let prevDragging = false;

	function settleDropDurationMs(): number {
		if (!browser) return 380;
		return matchMedia('(prefers-reduced-motion: reduce)').matches ? 72 : 380;
	}

	/** Small random tilt for each flip so motion isn’t a perfect 2D turn (deg). */
	let flipRx = 0;
	let flipRy = 0;
	let flipRz = 0;
	let prevPieceIdForFlip = -1;
	let prevFlipped = false;

	$: bgUrlFront = assetBaseUrl
		? `${assetBaseUrl}${piece.bg}`
		: `/data/${curGame}/images/${piece.bg}`;
	$: bgUrlBack = piece.bg ? backPngUrlFromFrontUrl(bgUrlFront, piece) : bgUrlFront;
	$: canFlip = pieceSupportsFlip(piece);
	$: {
		const idChanged = piece.id !== lastPieceId;
		if (idChanged) {
			lastPieceId = piece.id;
			settleDragRot.set(0, { duration: 0 });
			liftJitterDeg = 0;
		}
		const snap = dragging || !smoothPosition || idChanged;
		const dur = snap ? 0 : smoothDurationMs ?? POS_SMOOTH_MS;
		const easing = snap ? undefined : smoothDurationMs != null ? cubicOut : undefined;
		posX.set(piece.x, { duration: dur, easing });
		posY.set(piece.y, { duration: dur, easing });
	}

	$: if (dragging !== prevDragging) {
		if (dragging) {
			settleDragRot.set(0, { duration: 0 });
			liftJitterDeg = (Math.random() - 0.5) * 5;
		} else {
			liftJitterDeg = 0;
			const kick = (Math.random() - 0.5) * 7;
			settleDragRot.set(kick, { duration: 0 });
			settleDragRot.set(0, { duration: settleDropDurationMs(), easing: cubicOut });
		}
		prevDragging = dragging;
	}

	$: {
		if (piece.id !== prevPieceIdForFlip) {
			prevPieceIdForFlip = piece.id;
			prevFlipped = piece.flipped;
		} else if (canFlip && piece.flipped !== prevFlipped) {
			prevFlipped = piece.flipped;
			/* ~30% softer than original tilt ranges */
			flipRx = (Math.random() - 0.5) * 5;
			flipRy = (Math.random() - 0.5) * 4;
			flipRz = (Math.random() - 0.5) * 3;
		}
	}

	$: bgUrl = canFlip && piece.flipped ? bgUrlBack : bgUrlFront;
	$: showFace = !faceHidden;
	$: rot = piece.rotation ?? 0;
	$: dragInteractRot = rot + (dragging ? liftJitterDeg : $settleDragRot);
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
	class:can-flip={canFlip}
	class:flip-depth={canFlip && showFace}
	class:arrange-anim={arrangeAnimating}
	data-piece-id={piece.id}
	title={faceHidden ? 'Hidden — private area' : undefined}
	style:z-index={piece.zIndex}
	style:width="{piece.initial_size.w}px"
	style:height="{piece.initial_size.h}px"
	style:transform-origin="center center"
	style:--board-zoom={boardZoom}
	style:transform={dragging
		? `translate3d(${piece.x}px, ${piece.y}px, 0) rotate(${dragInteractRot}deg) scale(1.05)`
		: `translate3d(${Math.round($posX)}px, ${Math.round($posY)}px, 0) rotate(${dragInteractRot}deg)`}
	style:background-color={showFace && piece.bg_color ? piece.bg_color : undefined}
	style:background-image={showFace && !canFlip ? `url(${bgUrl})` : undefined}
	/* outline (not border): border shrinks content with border-box + background-clip: content-box */
	style:outline={remoteColor ? `3px dashed ${remoteColor}` : undefined}
	style:background-position={showFace && canFlip ? undefined : '0 0'}
	style:background-size={showFace && canFlip ? undefined : '100% 100%'}
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
	oncontextmenu={(e) => {
		if (replayMode || !editorMode || !onEditorContextMenu) return;
		e.preventDefault();
		e.stopPropagation();
		onEditorContextMenu(e, piece.id);
	}}
>
	{#if showFace && canFlip}
		<div class="flip-scene">
			<div
				class="flip-inner"
				class:flipped={piece.flipped}
				style="--flip-rx:{flipRx}deg; --flip-ry:{flipRy}deg; --flip-rz:{flipRz}deg;"
			>
				<div
					class="flip-face flip-face--front"
					style:background-image="url({bgUrlFront})"
				></div>
				<div
					class="flip-face flip-face--back"
					style:background-image="url({bgUrlBack})"
				></div>
			</div>
		</div>
	{/if}
</div>
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
	/*
	  Selection ring: base + extra in world px when zoom > 1 so it stays obvious zoomed in.
	  Glow uses board-space radii (scales with the table) + a little extra from --board-zoom.
	*/
	.piece.selected {
		--sel-extra: min(
			7px,
			max(0px, calc((min(var(--board-zoom, 1), 3) - 1) * 2.25px))
		);
		--sel-glow: calc(10px + var(--sel-extra) * 1.6);
		outline: calc(3px + var(--sel-extra) * 0.65) solid rgba(110, 210, 255, 0.98);
		outline-offset: calc(1px + var(--sel-extra) * 0.2);
		box-shadow:
			0 0 0 1px rgba(0, 30, 60, 0.45),
			0 0 var(--sel-glow) rgba(70, 180, 255, 0.55),
			0 0 calc(var(--sel-glow) * 1.8) rgba(70, 180, 255, 0.22);
		transition:
			box-shadow 150ms ease,
			filter 150ms ease,
			outline-width 120ms ease;
	}
	.piece.selected.dragging {
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.38),
			0 0 0 1px rgba(0, 30, 60, 0.45),
			0 0 calc(var(--sel-glow, 14px) * 1.1) rgba(90, 195, 255, 0.5);
	}
	/* Locked (board editor): amber dashed ring — matches template layer list lock accent */
	.piece.editor-locked {
		outline: 2px dashed #fbbf24 !important;
		outline-offset: 2px;
		box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.35);
	}
	.piece.editor-locked.selected {
		box-shadow:
			0 0 0 1px rgba(251, 191, 36, 0.45),
			0 0 var(--sel-glow, 12px) rgba(90, 195, 255, 0.38);
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
	/* Apply arrangement: smooth motion tweens with brief cross-fade for flip */
	.piece.arrange-anim.can-flip {
		transition:
			box-shadow 150ms ease,
			filter 150ms ease;
	}

	.flip-scene {
		width: 100%;
		height: 100%;
		perspective: clamp(546px, 78vw, 1430px);
		border-radius: inherit;
	}
	.flip-inner {
		width: 100%;
		height: 100%;
		position: relative;
		transform-style: preserve-3d;
		border-radius: inherit;
		transition: transform 0.58s cubic-bezier(0.33, 0.11, 0.22, 1);
		transform: rotateX(var(--flip-rx, 0deg)) rotateY(var(--flip-ry, 0deg)) rotateZ(var(--flip-rz, 0deg));
	}
	.flip-inner.flipped {
		transform: rotateX(var(--flip-rx)) rotateY(calc(180deg + var(--flip-ry, 0deg))) rotateZ(var(--flip-rz));
	}
	.flip-face {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.flip-face--back {
		transform: rotateY(180deg);
	}
	@media (prefers-reduced-motion: reduce) {
		.flip-inner {
			transition-duration: 0.09s;
			transition-timing-function: linear;
		}
	}
</style>
