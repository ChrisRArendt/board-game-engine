<script lang="ts">
	import GameMediaImageTools from './GameMediaImageTools.svelte';
	import PieceProperties from './PieceProperties.svelte';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';

	export let gameId: string;
	export let userId: string;
	export let tableMediaId: string | null;
	export let mediaUrls: Record<string, string>;
	export let onTableMediaIdChange: (id: string | null) => void | Promise<void>;
	export let onMergeTableMediaUrls: (urls: Record<string, string>) => void;
	export let onAfterTableMediaPick: () => void;
	export let onPalettePersist: ((cols: string[]) => void) | undefined = undefined;
	export let onAfterEdit: (() => void) | undefined = undefined;

	function cardInstanceIdFromPieceBg(bg: string): string | null {
		const m = /^cards\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.png$/i.exec(bg);
		return m ? m[1] : null;
	}

	function applyTableDims(w: number, h: number) {
		g.game.update((s) => ({
			...s,
			table: { w: Math.max(500, Math.round(w)), h: Math.max(500, Math.round(h)) }
		}));
		onAfterEdit?.();
	}

	$: pieceSel =
		$game.selectedIds.size === 1
			? ($game.pieces.find((p) => $game.selectedIds.has(p.id)) ?? null)
			: null;
	$: pieceCardId = pieceSel ? cardInstanceIdFromPieceBg(pieceSel.bg) : null;
	$: multiSel = $game.selectedIds.size > 1;

	/** Legacy table image not linked to `game_media` — still show preview. */
	$: tableFallbackThumb =
		tableMediaId == null && $game.assetBaseUrl && $game.tableBgFilename
			? `${$game.assetBaseUrl}${$game.tableBgFilename}?v=${$game.tableBgRev}`
			: null;
</script>

<div class="inspector">
	{#if $game.selectedIds.size === 0}
		<h4>Table &amp; board</h4>
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
			<div class="row table-bg-tools">
				<span>Table background</span>
				<p class="subhint">Upload, pick from library, or generate — same as card backgrounds.</p>
				<GameMediaImageTools
					compact
					{gameId}
					mediaId={tableMediaId}
					{mediaUrls}
					fallbackThumbUrl={tableFallbackThumb}
					onMediaIdChange={onTableMediaIdChange}
					onMergeUrls={onMergeTableMediaUrls}
					onAfterPick={onAfterTableMediaPick}
				/>
			</div>
		</div>
	{:else if multiSel}
		<h4>Pieces ({$game.selectedIds.size})</h4>
		<p class="hint">Use the toolbar to align and distribute. Toggle attributes for all selected:</p>
		<div class="props">
			{#each ['select', 'move', 'flip', 'shuffle', 'roundcorners'] as a}
				<label class="check">
					<input
						type="checkbox"
						checked={$game.pieces
							.filter((p) => $game.selectedIds.has(p.id))
							.every((p) => p.attributes.includes(a))}
						onchange={(e) => {
							const on = (e.currentTarget as HTMLInputElement).checked;
							for (const id of $game.selectedIds) {
								const cur = $game.pieces.find((x) => x.id === id);
								if (!cur) continue;
								const set = new Set(cur.attributes);
								if (on) set.add(a);
								else set.delete(a);
								g.replacePieceInstance({ ...cur, attributes: [...set] });
							}
							onAfterEdit?.();
						}}
					/>
					<span>{a}</span>
				</label>
			{/each}
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
			{onPalettePersist}
			onChange={(p) => {
				g.replacePieceInstance(p);
				onAfterEdit?.();
			}}
		/>
	{:else}
		<p class="muted">Clear selection (click empty space or Escape) for table settings, or pick a piece.</p>
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
	.table-bg-tools .subhint {
		margin: 0 0 6px;
		font-size: 11px;
		color: var(--color-text-muted);
		line-height: 1.35;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
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
	.hint {
		font-size: 0.85em;
		color: var(--color-text-muted);
		margin: 0 0 8px;
	}
	.muted {
		color: var(--color-text-muted);
		font-size: 0.95em;
	}
</style>
