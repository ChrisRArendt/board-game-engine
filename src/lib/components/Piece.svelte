<script lang="ts">
	import type { PieceInstance } from '$lib/engine/types';
	import { hasAttr } from '$lib/engine/pieces';

	export let piece: PieceInstance;
	export let curGame: string;
	export let selected = false;
	export let remoteColor: string | undefined = undefined;
	export let onpointerdown: ((e: PointerEvent) => void) | undefined = undefined;
	/** Local-only enlarged viewer (double-click); not synced to other players */
	export let onpiecedblclick: ((id: number) => void) | undefined = undefined;

	$: canFlip = hasAttr(piece, 'flip');
	$: bgUrl = `/data/${curGame}/images/${piece.bg}`;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="piece"
	class:selected
	data-piece-id={piece.id}
	style:z-index={piece.zIndex}
	style:width="{piece.initial_size.w}px"
	style:height="{piece.initial_size.h}px"
	style:transform="translate3d({piece.x}px, {piece.y}px, 0)"
	style:background-image="url({bgUrl})"
	/* outline (not border): border shrinks content with border-box + background-clip: content-box */
	style:outline={remoteColor ? `3px dashed ${remoteColor}` : undefined}
	style:background-position={canFlip
		? piece.flipped
			? '0px 0px'
			: `${-piece.initial_size.w}px 0px`
		: '0 0'}
	style:background-size={canFlip ? '200% 100%' : '100% 100%'}
	style:border-radius={hasAttr(piece, 'roundcorners') ? '8px' : undefined}
	onpointerdown={(e) => {
		e.stopPropagation();
		onpointerdown?.(e);
	}}
	ondblclick={(e) => {
		e.stopPropagation();
		onpiecedblclick?.(piece.id);
	}}
></div>

<style>
	.piece {
		background-size: 100% 100%;
		position: absolute;
		background-repeat: no-repeat;
		background-clip: content-box;
		touch-action: none;
	}
	.piece.selected {
		outline: 3px solid #3af;
	}
</style>
