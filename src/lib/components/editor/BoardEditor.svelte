<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Board from '$lib/components/Board.svelte';
	import PieceTypeList from './PieceTypeList.svelte';
	import BoardObjectInspector from './BoardObjectInspector.svelte';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import type { GameDataJson } from '$lib/engine/types';
	import type { PieceInstance } from '$lib/engine/types';
	import { piecesToGameDataJson } from '$lib/editor/serializeBoard';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import type { CardForBoardPiece } from '$lib/editor/types';

	export let gameId: string;
	export let userId: string;
	export let gameKey: string;
	export let assetBaseUrl: string | null;
	export let initialGameData: GameDataJson;
	export let cardsForBoard: CardForBoardPiece[] = [];
	export let onSaved: (() => void) | undefined = undefined;

	const supabase = createSupabaseBrowserClient();

	let saving = false;
	let errMsg = '';

	function onEditorKeydown(e: KeyboardEvent) {
		const el = e.target as HTMLElement | null;
		if (el?.closest('input, textarea, select, [contenteditable]')) return;
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
			if ($game.selectedIds.size === 0 || $game.editorTableSelected) return;
			e.preventDefault();
			g.duplicateSelectedForEditor();
		}
	}

	onMount(() => {
		g.loadGameData(initialGameData, { curGame: gameKey, assetBaseUrl });
		g.centerCamToVP();
		window.addEventListener('keydown', onEditorKeydown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', onEditorKeydown);
		g.resetGameToEmpty();
	});

	async function saveBoard() {
		saving = true;
		errMsg = '';
		try {
			const st = $game;
			const json = piecesToGameDataJson(st.pieces, st.table, {
				table_bg: st.assetBaseUrl ? st.tableBgFilename : undefined
			});
			const { error } = await supabase
				.from('custom_board_games')
				.update({ game_data: json as never, updated_at: new Date().toISOString() })
				.eq('id', gameId);
			if (error) throw error;
			onSaved?.();
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Save failed';
		}
		saving = false;
	}

	function addPiece() {
		const st = $game;
		const id = st.nextPieceId;
		const p: PieceInstance = {
			id,
			bg: 'piece.png',
			classes: `piece_${id}`,
			attributes: ['select', 'move'],
			x: 200,
			y: 200,
			zIndex: id,
			flipped: false,
			initial_size: { w: 120, h: 160 }
		};
		g.addPieceInstance(p);
	}

	/** Storage path is `{userId}/{gameId}/cards/{id}.png` → bg is `cards/{id}.png` */
	function addPieceFromCard(card: CardForBoardPiece) {
		if (!card.rendered_image_path) return;
		const st = $game;
		const id = st.nextPieceId;
		const rel = `cards/${card.id}.png`;
		const p: PieceInstance = {
			id,
			bg: rel,
			classes: `card_${card.name.replace(/\W+/g, '_').slice(0, 40) || id}`,
			attributes: ['select', 'move'],
			x: 220,
			y: 220,
			zIndex: id,
			flipped: false,
			initial_size: { w: card.canvas_width, h: card.canvas_height }
		};
		g.addPieceInstance(p);
	}

	async function uploadTableBg(file: File) {
		const raw = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? 'jpg';
		const ext = raw === 'jpeg' ? 'jpg' : raw;
		const safe = ['png', 'jpg', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
		const filename = `table-bg.${safe}`;
		const path = `${userId}/${gameId}/${filename}`;
		const { error } = await supabase.storage.from('custom-game-assets').upload(path, file, {
			upsert: true,
			contentType: file.type || `image/${safe === 'jpg' ? 'jpeg' : safe}`
		});
		if (error) {
			errMsg = error.message;
			return;
		}
		errMsg = '';
		g.game.update((s) => ({
			...s,
			tableBgFilename: filename,
			tableBgRev: s.tableBgRev + 1
		}));
	}
</script>

<div class="bed">
	<header class="top">
		<div class="tb">
			<button
				type="button"
				class="secondary"
				disabled={$game.selectedIds.size === 0 || $game.editorTableSelected}
				title="Duplicate selected pieces (⌘D / Ctrl+D)"
				onclick={() => g.duplicateSelectedForEditor()}
			>
				Duplicate
			</button>
			<button type="button" class="primary" disabled={saving} onclick={saveBoard}>
				{saving ? 'Saving…' : 'Save board'}
			</button>
		</div>
		{#if errMsg}
			<p class="err">{errMsg}</p>
		{/if}
		<p class="hint">
			Canvas shows the <strong>real layout</strong> saved for play. Add pieces from the left. Use
			<strong>Settings</strong> / <strong>Templates</strong> / <strong>Pieces</strong> / <strong>Media</strong> for
			other editor sections.
		</p>
	</header>
	<div class="main">
		<aside class="left">
			<h3>Pieces</h3>
			<PieceTypeList
				{gameId}
				pieces={$game.pieces}
				selectedIds={$game.selectedIds}
				onSelect={(id, shift) => g.clickSelect(id, shift)}
				onAddPiece={addPiece}
				{cardsForBoard}
				onAddFromCard={addPieceFromCard}
			/>
		</aside>
		<div class="canvas">
			<Board
				editorMode={true}
				selfUserId={userId}
				selfDisplayName="Editor"
				zoomWithScroll={true}
				panScreenEdge={false}
				replayMode={true}
			/>
		</div>
		<aside class="right">
			<h3>Properties</h3>
			<BoardObjectInspector {gameId} {userId} onUploadTableBg={uploadTableBg} />
		</aside>
	</div>
</div>

<style>
	.bed {
		display: flex;
		flex-direction: column;
		height: 100vh;
		min-height: 0;
		background: var(--color-bg);
		color: var(--color-text);
	}
	.top {
		flex-shrink: 0;
		padding: 10px 16px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.tb {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: flex-end;
	}
	.secondary {
		padding: 8px 14px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}
	.secondary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.primary {
		padding: 8px 16px;
		border-radius: 6px;
		border: none;
		background: var(--color-accent, #3b82f6);
		color: #fff;
		cursor: pointer;
	}
	.err {
		color: #f87171;
		margin: 8px 0 0;
		font-size: 13px;
	}
	.hint {
		margin: 8px 0 0;
		font-size: 12px;
		color: var(--color-text-muted);
		max-width: 72ch;
		line-height: 1.4;
	}
	.main {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 220px 1fr 260px;
	}
	.left,
	.right {
		overflow: auto;
		padding: 12px;
		border-right: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.right {
		border-right: none;
		border-left: 1px solid var(--color-border);
	}
	h3 {
		margin: 0 0 10px;
		font-size: 14px;
	}
	.canvas {
		position: relative;
		min-height: 0;
		min-width: 0;
	}
</style>
