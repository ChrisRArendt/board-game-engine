<script lang="ts">
	import PieceProperties from './PieceProperties.svelte';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';

	export let gameId: string;
	export let userId: string;
	export let onUploadTableBg: (file: File) => Promise<void>;

	function applyTableDims(w: number, h: number) {
		g.game.update((s) => ({
			...s,
			table: { w: Math.max(500, Math.round(w)), h: Math.max(500, Math.round(h)) }
		}));
	}

	$: pieceSel =
		!$game.editorTableSelected && $game.selectedIds.size === 1
			? ($game.pieces.find((p) => $game.selectedIds.has(p.id)) ?? null)
			: null;
</script>

<div class="inspector">
	{#if $game.editorTableSelected}
		<h4>Table</h4>
		<div class="props">
			<label class="row">
				<span>Width</span>
				<input
					type="number"
					min="500"
					value={$game.table.w}
					oninput={(e) =>
						applyTableDims(
							parseFloat((e.currentTarget as HTMLInputElement).value) || 500,
							$game.table.h
						)}
				/>
			</label>
			<label class="row">
				<span>Height</span>
				<input
					type="number"
					min="500"
					value={$game.table.h}
					oninput={(e) =>
						applyTableDims(
							$game.table.w,
							parseFloat((e.currentTarget as HTMLInputElement).value) || 500
						)}
				/>
			</label>
			<label class="row file">
				<span>Table background</span>
				<input
					type="file"
					accept="image/*"
					onchange={(e) => {
						const f = (e.currentTarget as HTMLInputElement).files?.[0];
						if (f) void onUploadTableBg(f);
					}}
				/>
			</label>
			<p class="hint">
				Click the <strong>table</strong> to resize it or change the background. Hold <strong>Space</strong> and
				drag to pan the view.
			</p>
		</div>
	{:else if pieceSel}
		<h4>Piece</h4>
		<PieceProperties
			piece={pieceSel}
			{gameId}
			{userId}
			onChange={(p) => g.replacePieceInstance(p)}
		/>
	{:else}
		<p class="muted">Select the table or a piece on the canvas to edit properties.</p>
		<p class="hint subtle">
			<strong>Space</strong>+drag pans. Click empty table area to select the table surface.
		</p>
	{/if}
</div>

<style>
	.inspector {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 13px;
	}
	h4 {
		margin: 0;
		font-size: 12px;
		text-transform: uppercase;
		color: var(--color-text-muted);
		letter-spacing: 0.04em;
	}
	.props {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.row input[type='number'] {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.file input[type='file'] {
		max-width: 100%;
		font-size: 12px;
	}
	.hint {
		margin: 0;
		font-size: 12px;
		line-height: 1.45;
		color: var(--color-text-muted);
	}
	.hint.subtle {
		margin-top: 4px;
	}
	.muted {
		margin: 0;
		color: var(--color-text-muted);
	}
</style>
