<script lang="ts">
	import PieceProperties from './PieceProperties.svelte';
	import PieceColorPaletteEditor from './PieceColorPaletteEditor.svelte';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';

	export let gameId: string;
	export let userId: string;
	export let onUploadTableBg: (file: File) => Promise<void>;

	function cardInstanceIdFromPieceBg(bg: string): string | null {
		const m = /^cards\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.png$/i.exec(bg);
		return m ? m[1] : null;
	}

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
	$: pieceCardId = pieceSel ? cardInstanceIdFromPieceBg(pieceSel.bg) : null;
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
			<PieceColorPaletteEditor
				palette={$game.pieceColorPalette}
				onChange={(cols) => g.setPieceColorPalette(cols)}
			/>
		</div>
	{:else if pieceSel}
		<h4>Piece</h4>
		{#if pieceCardId}
			<p class="piece-edit-link">
				<a href="/editor/{gameId}/pieces/{pieceCardId}">Edit piece</a>
			</p>
		{/if}
		<PieceProperties
			piece={pieceSel}
			{gameId}
			{userId}
			onChange={(p) => g.replacePieceInstance(p)}
		/>
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
	.piece-edit-link {
		margin: 0 0 10px;
		font-size: 12px;
	}
	.piece-edit-link a {
		color: var(--color-accent, #3b82f6);
		text-decoration: none;
	}
	.piece-edit-link a:hover {
		text-decoration: underline;
	}
</style>
