<script lang="ts">
	import ArrangementControls from '$lib/components/ArrangementControls.svelte';
	import GameMediaImageTools from './GameMediaImageTools.svelte';
	import LabelWidgetInspector from './LabelWidgetInspector.svelte';
	import PieceProperties from './PieceProperties.svelte';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import type { BoardWidget } from '$lib/engine/types';

	export let gameId: string;
	export let userId: string;
	export let tableMediaId: string | null;
	export let envMediaId: string | null;
	export let mediaUrls: Record<string, string>;
	export let onTableMediaIdChange: (id: string | null) => void | Promise<void>;
	export let onEnvMediaIdChange: (id: string | null) => void | Promise<void>;
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
		$game.selectedIds.size === 1 && $game.selectedWidgetIds.size === 0
			? ($game.pieces.find((p) => $game.selectedIds.has(p.id)) ?? null)
			: null;
	$: pieceCardId = pieceSel ? cardInstanceIdFromPieceBg(pieceSel.bg) : null;
	$: multiPiece = $game.selectedIds.size > 1 && $game.selectedWidgetIds.size === 0;
	$: widgetSel =
		$game.selectedWidgetIds.size === 1 && $game.selectedIds.size === 0
			? ($game.widgets.find((w) => $game.selectedWidgetIds.has(w.id)) ?? null)
			: null;

	function patchWidget(next: BoardWidget) {
		g.replaceWidgetInstance(next);
		onAfterEdit?.();
	}

	$: arrangeUnlockedCount = [...$game.selectedIds].filter((id) => {
		const p = $game.pieces.find((x) => x.id === id);
		return p != null && !p.locked;
	}).length;

	/** Legacy table image not linked to `game_media` — still show preview. */
	$: tableFallbackThumb =
		tableMediaId == null && $game.assetBaseUrl && $game.tableBgFilename
			? `${$game.assetBaseUrl}${$game.tableBgFilename}?v=${$game.tableBgRev}`
			: null;
	/** Legacy env image not linked to `game_media` — still show preview. */
	$: envFallbackThumb =
		envMediaId == null && $game.assetBaseUrl && $game.envBgFilename
			? `${$game.assetBaseUrl}${$game.envBgFilename}?v=${$game.envBgRev}`
			: null;
</script>

<div class="inspector">
	{#if $game.selectedIds.size === 0 && $game.selectedWidgetIds.size === 0}
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
			<div class="row table-bg-tools">
				<span>Environment (repeating)</span>
				<p class="subhint">
					Tiles under the table and everything on it; moves and zooms with the board. Clear to remove.
				</p>
				<GameMediaImageTools
					compact
					{gameId}
					mediaId={envMediaId}
					{mediaUrls}
					fallbackThumbUrl={envFallbackThumb}
					onMediaIdChange={onEnvMediaIdChange}
					onMergeUrls={onMergeTableMediaUrls}
					onAfterPick={onAfterTableMediaPick}
				/>
			</div>
		</div>
	{:else if multiPiece}
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
		<div class="arrange-block">
			<h5 class="arrange-title">Arrange selection</h5>
			<p class="subhint">
				Reposition selected pieces like library placement. Order follows layer order (back → front). Locked
				pieces are skipped.
			</p>
			<ArrangementControls
				useSelectionUnlockedHint
				unlockedCount={arrangeUnlockedCount}
				selectedCount={$game.selectedIds.size}
				onAfterApply={onAfterEdit}
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
			{onPalettePersist}
			onChange={(p) => {
				g.replacePieceInstance(p);
				onAfterEdit?.();
			}}
		/>
	{:else if $game.selectedWidgetIds.size > 1 && $game.selectedIds.size === 0}
		<h4>Widgets ({$game.selectedWidgetIds.size})</h4>
		<p class="hint">Use the layers list to reorder, hide, or lock.</p>
	{:else if widgetSel}
		<h4>Widget ({widgetSel.type})</h4>
		<div class="props">
			<label class="row">
				<span>Caption</span>
				<input
					type="text"
					value={widgetSel.label ?? ''}
					placeholder="Optional label above widget"
					oninput={(e) =>
						patchWidget({
							...widgetSel!,
							label: (e.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<div class="row grid2">
				<label>
					<span>X</span>
					<input
						type="number"
						value={Math.round(widgetSel.x)}
						oninput={(e) =>
							patchWidget({
								...widgetSel!,
								x: parseFloat((e.currentTarget as HTMLInputElement).value) || 0
							})}
					/>
				</label>
				<label>
					<span>Y</span>
					<input
						type="number"
						value={Math.round(widgetSel.y)}
						oninput={(e) =>
							patchWidget({
								...widgetSel!,
								y: parseFloat((e.currentTarget as HTMLInputElement).value) || 0
							})}
					/>
				</label>
			</div>
			<div class="row grid2">
				<label>
					<span>Width</span>
					<input
						type="number"
						min="40"
						value={Math.round(widgetSel.w)}
						oninput={(e) =>
							patchWidget({
								...widgetSel!,
								w: Math.max(40, parseFloat((e.currentTarget as HTMLInputElement).value) || 40)
							})}
					/>
				</label>
				<label>
					<span>Height</span>
					<input
						type="number"
						min="24"
						value={Math.round(widgetSel.h)}
						oninput={(e) =>
							patchWidget({
								...widgetSel!,
								h: Math.max(24, parseFloat((e.currentTarget as HTMLInputElement).value) || 24)
							})}
					/>
				</label>
			</div>
			{#if widgetSel.type === 'counter'}
				<div class="row grid3">
					<label>
						<span>Min</span>
						<input
							type="number"
							value={Number(widgetSel.config.min ?? 0)}
							oninput={(e) =>
								patchWidget({
									...widgetSel!,
									config: {
										...widgetSel!.config,
										min: parseFloat((e.currentTarget as HTMLInputElement).value) || 0
									}
								})}
						/>
					</label>
					<label>
						<span>Max</span>
						<input
							type="number"
							value={Number(widgetSel.config.max ?? 999)}
							oninput={(e) =>
								patchWidget({
									...widgetSel!,
									config: {
										...widgetSel!.config,
										max: parseFloat((e.currentTarget as HTMLInputElement).value) || 999
									}
								})}
						/>
					</label>
					<label>
						<span>Step</span>
						<input
							type="number"
							min="1"
							value={Number(widgetSel.config.step ?? 1)}
							oninput={(e) =>
								patchWidget({
									...widgetSel!,
									config: {
										...widgetSel!.config,
										step: Math.max(1, parseFloat((e.currentTarget as HTMLInputElement).value) || 1)
									}
								})}
						/>
					</label>
				</div>
				<label class="row">
					<span>Default value</span>
					<input
						type="number"
						value={typeof widgetSel.value === 'number' ? widgetSel.value : 0}
						oninput={(e) =>
							patchWidget({
								...widgetSel!,
								value: parseFloat((e.currentTarget as HTMLInputElement).value) || 0
							})}
					/>
				</label>
			{:else if widgetSel.type === 'label'}
				<LabelWidgetInspector
					widget={widgetSel}
					{patchWidget}
					{onPalettePersist}
				/>
			{:else if widgetSel.type === 'textbox'}
				<label class="row">
					<span>Placeholder</span>
					<input
						type="text"
						value={String(widgetSel.config.placeholder ?? '')}
						oninput={(e) =>
							patchWidget({
								...widgetSel!,
								config: {
									...widgetSel!.config,
									placeholder: (e.currentTarget as HTMLInputElement).value
								}
							})}
					/>
				</label>
				<label class="row">
					<span>Max length</span>
					<input
						type="number"
						min="1"
						value={Number(widgetSel.config.maxLength ?? 4000)}
						oninput={(e) =>
							patchWidget({
								...widgetSel!,
								config: {
									...widgetSel!.config,
									maxLength: Math.max(
										1,
										parseInt((e.currentTarget as HTMLInputElement).value, 10) || 4000
									)
								}
							})}
					/>
				</label>
			{:else if widgetSel.type === 'dice'}
				<div class="row grid2">
					<label>
						<span>Sides</span>
						<input
							type="number"
							min="2"
							value={Number(widgetSel.config.sides ?? 6)}
							oninput={(e) =>
								patchWidget({
									...widgetSel!,
									config: {
										...widgetSel!.config,
										sides: Math.max(2, parseInt((e.currentTarget as HTMLInputElement).value, 10) || 6)
									}
								})}
						/>
					</label>
					<label>
						<span>Dice count</span>
						<input
							type="number"
							min="1"
							max="20"
							value={Number(widgetSel.config.count ?? 1)}
							oninput={(e) =>
								patchWidget({
									...widgetSel!,
									config: {
										...widgetSel!.config,
										count: Math.min(
											20,
											Math.max(1, parseInt((e.currentTarget as HTMLInputElement).value, 10) || 1)
										)
									}
								})}
						/>
					</label>
				</div>
			{:else if widgetSel.type === 'toggle'}
				<label class="row">
					<span>On label</span>
					<input
						type="text"
						value={String(widgetSel.config.onText ?? 'On')}
						oninput={(e) =>
							patchWidget({
								...widgetSel!,
								config: {
									...widgetSel!.config,
									onText: (e.currentTarget as HTMLInputElement).value
								}
							})}
					/>
				</label>
				<label class="row">
					<span>Off label</span>
					<input
						type="text"
						value={String(widgetSel.config.offText ?? 'Off')}
						oninput={(e) =>
							patchWidget({
								...widgetSel!,
								config: {
									...widgetSel!.config,
									offText: (e.currentTarget as HTMLInputElement).value
								}
							})}
					/>
				</label>
				<label class="row">
					<span>Default on</span>
					<input
						type="checkbox"
						checked={widgetSel.value === true}
						onchange={(e) =>
							patchWidget({
								...widgetSel!,
								value: (e.currentTarget as HTMLInputElement).checked
							})}
					/>
				</label>
			{/if}
		</div>
	{:else}
		<p class="muted">Clear selection (click empty space or Escape) for table settings, or pick a piece or widget.</p>
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
	.row input[type='number'],
	.row input[type='text'] {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.grid3 {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 8px;
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
	.arrange-block {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.arrange-title {
		margin: 0;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}
	.arrange-block > .subhint {
		margin: 0;
		font-size: 11px;
		color: var(--color-text-muted);
		line-height: 1.35;
	}
</style>
