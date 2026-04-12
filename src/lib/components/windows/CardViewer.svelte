<script lang="ts">
	import { game } from '$lib/stores/game';

	export let targetPieceId: number | null = null;

	$: piece =
		targetPieceId === null ? null : ($game.pieces.find((p) => p.id === targetPieceId) ?? null);
	$: bg = piece && piece.bg ? `/data/${$game.curGame}/images/${piece.bg}` : '';
	$: w = piece ? piece.initial_size.w * 2 : 0;
	$: h = piece ? piece.initial_size.h * 2 : 0;
</script>

<div class="viewer" style:width="{w}px" style:min-height="{h}px">
	{#if piece}
		<div
			class="img"
			style:width="100%"
			style:height="{h}px"
			style:background-image="url({bg})"
			style:background-size={piece.attributes.includes('flip') ? 'auto 100%' : '100% 100%'}
			style:background-position={piece.attributes.includes('flip')
				? piece.flipped
					? '0 0'
					: '100% 0'
				: '0 0'}
			style:background-repeat="no-repeat"
		></div>
	{:else}
		<p class="empty">No card</p>
	{/if}
</div>

<style>
	.viewer {
		min-width: 150px;
	}
	.img {
		background-repeat: no-repeat;
	}
	.empty {
		padding: 8px;
		color: #888;
	}
</style>
