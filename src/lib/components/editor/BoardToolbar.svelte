<script lang="ts">
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import { getViewportSize } from '$lib/engine/geometry';
	import {
		alignPieces,
		distributePieces,
		matchSizes,
		type AlignKind
	} from '$lib/editor/alignDistribute';

	export let showGrid: boolean;
	export let gridSize: number;
	export let snapToGrid: boolean;

	function zoomToFit() {
		const s = $game;
		const vp = getViewportSize();
		const pad = 48;
		const tw = s.table.w;
		const th = s.table.h;
		const zx = (vp.w - pad * 2) / tw;
		const zy = (vp.h - pad * 2) / th;
		const z = Math.min(zx, zy, 2);
		const target = Math.max(0.1, Math.min(3, z));
		const cx = tw / 2;
		const cy = th / 2;
		g.game.update((st) => ({
			...st,
			zoom: target,
			panX: vp.w / 2 - cx * target,
			panY: vp.h / 2 - cy * target
		}));
		g.centerCamToVP();
	}

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

<div class="toolbar">
	<button type="button" class="tb" onclick={zoomToFit} title="Zoom to fit">Fit</button>
	<button
		type="button"
		class="tb"
		class:active={showGrid}
		onclick={() => (showGrid = !showGrid)}
		title="Grid overlay">Grid</button
	>
	{#if showGrid}
		<label class="gs">
			<span>Size</span>
			<input
				type="number"
				min="4"
				max="200"
				bind:value={gridSize}
			/>
		</label>
		<label class="chk">
			<input type="checkbox" bind:checked={snapToGrid} />
			Snap
		</label>
	{/if}
	{#if multi}
		<span class="sep"></span>
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
	{/if}
</div>

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
	.tb.active {
		border-color: var(--editor-selection, #3b82f6);
		background: rgba(59, 130, 246, 0.12);
	}
	.sep {
		width: 1px;
		height: 18px;
		background: var(--color-border);
		margin: 0 4px;
	}
	.gs {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.gs input {
		width: 48px;
		padding: 2px 4px;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: 4px;
	}
</style>
