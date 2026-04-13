<script lang="ts">
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import {
		alignPieces,
		distributePieces,
		matchSizes,
		type AlignKind
	} from '$lib/editor/alignDistribute';

	function align(kind: AlignKind) {
		const s = $game;
		const u = alignPieces(s.pieces, s.selectedIds, kind);
		const map = new Map<number, { x: number; y: number }>();
		for (const [id, pos] of u) map.set(id, pos);
		g.applyPiecePositionUpdates(map);
	}

	function distribute(kind: 'horizontal' | 'vertical') {
		const s = $game;
		const u = distributePieces(s.pieces, s.selectedIds, kind);
		const map = new Map<number, { x: number; y: number }>();
		for (const [id, pos] of u) map.set(id, pos);
		g.applyPiecePositionUpdates(map);
	}

	function match(kind: 'width' | 'height') {
		const s = $game;
		const u = matchSizes(s.pieces, s.selectedIds, kind);
		g.applyPiecePatches(u);
	}

	$: multi = $game.selectedIds.size >= 2;
</script>

{#if multi}
	<div class="toolbar">
		<button type="button" class="tb" onclick={() => align('left')} title="Align left">⟸</button>
		<button type="button" class="tb" onclick={() => align('centerH')} title="Align center H">↔</button>
		<button type="button" class="tb" onclick={() => align('right')} title="Align right">⟹</button>
		<button type="button" class="tb" onclick={() => align('top')} title="Align top">⟰</button>
		<button type="button" class="tb" onclick={() => align('centerV')} title="Align center V">↕</button>
		<button type="button" class="tb" onclick={() => align('bottom')} title="Align bottom">⟱</button>
		<button type="button" class="tb" onclick={() => distribute('horizontal')} title="Distribute H">⇄</button>
		<button type="button" class="tb" onclick={() => distribute('vertical')} title="Distribute V">⇅</button>
		<button type="button" class="tb" onclick={() => match('width')} title="Match width">W</button>
		<button type="button" class="tb" onclick={() => match('height')} title="Match height">H</button>
	</div>
{/if}

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		font-size: 12px;
	}
	.tb {
		padding: 4px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
		cursor: pointer;
	}
</style>
