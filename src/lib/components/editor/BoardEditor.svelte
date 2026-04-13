<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import Board from '$lib/components/Board.svelte';
	import PieceLibrary from './PieceLibrary.svelte';
	import BoardLayerList from './BoardLayerList.svelte';
	import BoardObjectInspector from './BoardObjectInspector.svelte';
	import BoardToolbar from './BoardToolbar.svelte';
	import BoardMinimap from './BoardMinimap.svelte';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import type { GameDataJson } from '$lib/engine/types';
	import type { PieceInstance } from '$lib/engine/types';
	import type { PlacementLayout } from '$lib/engine/types';
	import { piecesToGameDataJson } from '$lib/editor/serializeBoard';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import type { CardForBoardPiece } from '$lib/editor/types';
	import { computePlacementPositions, type PlacementSpacingMode } from '$lib/editor/placementLayouts';
	import { EditorHistory, type BoardEditorSnapshot } from '$lib/editor/editorHistory';
	import { maxZIndex } from '$lib/engine/pieces';
	import { isTypingInField } from '$lib/engine/input';

	export let gameId: string;
	export let userId: string;
	export let gameKey: string;
	export let assetBaseUrl: string | null;
	export let initialGameData: GameDataJson;
	export let cardsForBoard: CardForBoardPiece[] = [];
	export let onSaved: (() => void) | undefined = undefined;

	const supabase = createSupabaseBrowserClient();
	const history = new EditorHistory();
	const PANEL_KEY = 'boardEditor.panelWidths.v1';

	let saving = false;
	let errMsg = '';

	let leftW = 280;
	let rightW = 300;
	let dragPanel: 'left' | 'right' | null = null;
	let dragStartX = 0;
	let dragStartW = 0;

	let canvasW = 800;
	let canvasH = 600;

	function loadPanelWidths() {
		if (typeof localStorage === 'undefined') return;
		try {
			const raw = localStorage.getItem(PANEL_KEY);
			if (!raw) return;
			const j = JSON.parse(raw) as { left?: number; right?: number };
			if (typeof j.left === 'number' && j.left >= 200 && j.left <= 520) leftW = j.left;
			if (typeof j.right === 'number' && j.right >= 220 && j.right <= 520) rightW = j.right;
		} catch {
			/* ignore */
		}
	}

	function savePanelWidths() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(PANEL_KEY, JSON.stringify({ left: leftW, right: rightW }));
	}

	function snapshotFromGame(): BoardEditorSnapshot {
		const s = get(game);
		return {
			pieces: s.pieces.map((p) => ({ ...p, attributes: [...p.attributes], initial_size: { ...p.initial_size } })),
			table: { ...s.table },
			tableBgFilename: s.tableBgFilename,
			tableBgRev: s.tableBgRev,
			pieceColorPalette: [...s.pieceColorPalette],
			nextPieceId: s.nextPieceId
		};
	}

	function commitHistory() {
		history.pushAfterMutate(snapshotFromGame());
	}

	let canvasCtxMenu: { x: number; y: number; pieceId: number } | null = null;

	function closeCanvasMenu() {
		canvasCtxMenu = null;
	}

	function onEditorPieceContextMenu(e: MouseEvent, pieceId: number) {
		e.preventDefault();
		e.stopPropagation();
		const s = get(game);
		if (!s.selectedIds.has(pieceId)) {
			g.selectPieceForEditor(pieceId, false);
		}
		canvasCtxMenu = { x: e.clientX, y: e.clientY, pieceId };
	}

	function deleteSelectionFromCanvasMenu() {
		const s = get(game);
		if (s.selectedIds.size === 0 || s.editorTableSelected) return;
		g.removePiecesForEditor([...s.selectedIds]);
		commitHistory();
		closeCanvasMenu();
	}

	function deleteOnePieceFromCanvasMenu(id: number) {
		g.removePiecesForEditor([id]);
		commitHistory();
		closeCanvasMenu();
	}

	function clientToWorld(clientX: number, clientY: number) {
		const s = get(game);
		return { x: (clientX - s.panX) / s.zoom, y: (clientY - s.panY) / s.zoom };
	}

	function addPiece() {
		const st = get(game);
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
		commitHistory();
	}

	function addPiecesFromCard(
		card: CardForBoardPiece,
		opts: {
			quantity: number;
			layout: PlacementLayout;
			offset: number;
			baseX: number;
			baseY: number;
			spacingMode: PlacementSpacingMode;
			gridCols?: number;
		}
	) {
		if (!card.rendered_image_path) return;
		const st = get(game);
		const rel = `cards/${card.id}.png`;
		const positions = computePlacementPositions({
			layout: opts.layout,
			count: opts.quantity,
			baseX: opts.baseX,
			baseY: opts.baseY,
			offset: opts.offset,
			spacingMode: opts.spacingMode,
			pieceW: card.canvas_width,
			pieceH: card.canvas_height,
			cols: opts.layout === 'grid' ? opts.gridCols : undefined
		});
		let nextId = st.nextPieceId;
		let z = maxZIndex(st.pieces) + 1;
		const newPieces: PieceInstance[] = [];
		for (const pos of positions) {
			const id = nextId++;
			z += 1;
			newPieces.push({
				id,
				bg: rel,
				classes: `card_${card.name.replace(/\W+/g, '_').slice(0, 40) || id}`,
				attributes: ['select', 'move'],
				x: pos.x,
				y: pos.y,
				zIndex: z,
				flipped: false,
				initial_size: { w: card.canvas_width, h: card.canvas_height }
			});
		}
		g.game.update((s) => ({
			...s,
			pieces: [...s.pieces, ...newPieces],
			nextPieceId: nextId,
			selectedIds: new Set(newPieces.map((p) => p.id)),
			editorTableSelected: false
		}));
		commitHistory();
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
		commitHistory();
	}

	async function saveBoard() {
		saving = true;
		errMsg = '';
		try {
			const st = get(game);
			const json = piecesToGameDataJson(st.pieces, st.table, {
				table_bg: st.assetBaseUrl ? st.tableBgFilename : undefined,
				piece_color_palette: st.pieceColorPalette
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

	function onKeyup(e: KeyboardEvent) {
		if (e.key === ' ' || e.code === 'Space') {
			g.setSpacePanHeld(false);
			g.endPanPointer();
		}
	}

	function onWindowBlur() {
		g.setSpacePanHeld(false);
		g.endPanPointer();
	}

	function onKeydown(e: KeyboardEvent) {
		const el = e.target as HTMLElement | null;
		if (el?.closest('input, textarea, select, [contenteditable]')) return;

		if (e.key === ' ' || e.code === 'Space') {
			if (isTypingInField(e.target)) return;
			e.preventDefault();
			if (!e.repeat) g.setSpacePanHeld(true);
			return;
		}

		const meta = e.metaKey || e.ctrlKey;

		if (meta && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			if (e.shiftKey) {
				const snap = history.redo();
				if (snap) g.restoreBoardEditorSnapshot(snap);
			} else {
				const snap = history.undo();
				if (snap) g.restoreBoardEditorSnapshot(snap);
			}
			return;
		}

		if (meta && e.key.toLowerCase() === 'a') {
			e.preventDefault();
			g.selectAllPiecesForEditor();
			return;
		}

		if (meta && e.key.toLowerCase() === 'd') {
			if (get(game).selectedIds.size === 0 || get(game).editorTableSelected) return;
			e.preventDefault();
			g.duplicateSelectedForEditor();
			commitHistory();
			return;
		}

		if (e.key === 'Escape') {
			g.deselectAll();
			return;
		}

		if (e.key === 'Delete' || e.key === 'Backspace') {
			const s = get(game);
			if (s.selectedIds.size === 0 || s.editorTableSelected) return;
			e.preventDefault();
			g.removePiecesForEditor([...s.selectedIds]);
			commitHistory();
			return;
		}

		const nudge = e.shiftKey ? 10 : 1;
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			g.nudgeSelectedPieces(-nudge, 0);
			commitHistory();
			return;
		}
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			g.nudgeSelectedPieces(nudge, 0);
			commitHistory();
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			g.nudgeSelectedPieces(0, -nudge);
			commitHistory();
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			g.nudgeSelectedPieces(0, nudge);
			commitHistory();
			return;
		}

		if (e.key === '[') {
			const s = get(game);
			if (s.selectedIds.size !== 1) return;
			e.preventDefault();
			if (meta) g.sendToBack([...s.selectedIds][0]);
			else g.sendBackward([...s.selectedIds][0]);
			commitHistory();
			return;
		}
		if (e.key === ']') {
			const s = get(game);
			if (s.selectedIds.size !== 1) return;
			e.preventDefault();
			if (meta) g.bringToFront([...s.selectedIds][0]);
			else g.bringForward([...s.selectedIds][0]);
			commitHistory();
			return;
		}
	}

	function onPanelMove(e: PointerEvent) {
		if (!dragPanel) return;
		const dx = e.clientX - dragStartX;
		if (dragPanel === 'left') {
			leftW = Math.max(200, Math.min(520, dragStartW + dx));
		} else {
			rightW = Math.max(220, Math.min(520, dragStartW - dx));
		}
	}

	function onPanelUp() {
		if (dragPanel) savePanelWidths();
		dragPanel = null;
		if (browser) {
			window.removeEventListener('pointermove', onPanelMove);
			window.removeEventListener('pointerup', onPanelUp);
		}
	}

	function startPanelDrag(which: 'left' | 'right', e: PointerEvent) {
		dragPanel = which;
		dragStartX = e.clientX;
		dragStartW = which === 'left' ? leftW : rightW;
		if (browser) {
			window.addEventListener('pointermove', onPanelMove);
			window.addEventListener('pointerup', onPanelUp);
		}
	}

	onMount(() => {
		loadPanelWidths();
		g.loadGameData(initialGameData, {
			curGame: gameKey,
			assetBaseUrl,
			ensureEditorPieceAttrs: true
		});
		g.centerCamToVP();
		g.setEditorBoardSnap(true);
		g.setEditorGridSnap(false, 20);
		history.seed(snapshotFromGame());
		window.addEventListener('keydown', onKeydown);
		window.addEventListener('keyup', onKeyup);
		window.addEventListener('blur', onWindowBlur);
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('keyup', onKeyup);
			window.removeEventListener('blur', onWindowBlur);
			g.setSpacePanHeld(false);
			g.endPanPointer();
		}
		g.setEditorBoardSnap(false);
		g.resetGameToEmpty();
	});
</script>

<svelte:window onclick={closeCanvasMenu} />

<div class="bed">
	<header class="top">
		<div class="tb">
			<button
				type="button"
				class="secondary"
				disabled={$game.selectedIds.size === 0 || $game.editorTableSelected}
				title="Duplicate selected pieces (⌘D / Ctrl+D)"
				onclick={() => {
					g.duplicateSelectedForEditor();
					commitHistory();
				}}
			>
				Duplicate
			</button>
			<button type="button" class="primary" disabled={saving} onclick={() => saveBoard()}>
				{saving ? 'Saving…' : 'Save board'}
			</button>
		</div>
		{#if errMsg}
			<p class="err">{errMsg}</p>
		{/if}
	</header>
	<div class="main" style:grid-template-columns="{leftW}px 8px 1fr 8px {rightW}px">
		<aside class="left" style:width="{leftW}px">
			<h3>Library</h3>
			<PieceLibrary
				{cardsForBoard}
				onAddBlank={addPiece}
				{clientToWorld}
				onDropCard={addPiecesFromCard}
			/>
			<BoardLayerList {assetBaseUrl} onAfterEdit={commitHistory} />
		</aside>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="gutter"
			role="separator"
			aria-orientation="vertical"
			onpointerdown={(e) => startPanelDrag('left', e)}
		></div>
		<div class="canvas" bind:clientWidth={canvasW} bind:clientHeight={canvasH} data-board-editor-canvas>
			<BoardToolbar />
			<div class="board-wrap">
				<Board
					editorMode={true}
					embeddedEditor={true}
					selfUserId={userId}
					selfDisplayName="Editor"
					zoomWithScroll={true}
					panScreenEdge={false}
					replayMode={false}
					showGridOverlay={false}
					gridSize={20}
					onEditorPieceContextMenu={onEditorPieceContextMenu}
				/>
				<BoardMinimap viewportW={canvasW} viewportH={canvasH} />
			</div>
		</div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="gutter"
			role="separator"
			aria-orientation="vertical"
			onpointerdown={(e) => startPanelDrag('right', e)}
		></div>
		<aside class="right" style:width="{rightW}px">
			<h3>Properties</h3>
			<BoardObjectInspector {gameId} {userId} onUploadTableBg={uploadTableBg} onAfterEdit={commitHistory} />
		</aside>
	</div>

	{#if canvasCtxMenu}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="canvas-ctx"
			style:left="{canvasCtxMenu.x}px"
			style:top="{canvasCtxMenu.y}px"
			onclick={(e) => e.stopPropagation()}
			role="menu"
			tabindex="-1"
		>
			{#if $game.selectedIds.size > 1}
				<button type="button" onclick={() => deleteSelectionFromCanvasMenu()}>
					Delete all ({$game.selectedIds.size})
				</button>
				<button type="button" onclick={() => deleteOnePieceFromCanvasMenu(canvasCtxMenu!.pieceId)}>
					Delete this piece
				</button>
			{:else}
				<button type="button" onclick={() => deleteSelectionFromCanvasMenu()}>Delete</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.bed {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		width: 100%;
		height: 100%;
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
	.main {
		flex: 1;
		min-height: 0;
		display: grid;
		align-items: stretch;
	}
	.gutter {
		cursor: col-resize;
		background: var(--color-border);
		flex-shrink: 0;
	}
	.gutter:hover {
		background: var(--editor-selection, #3b82f6);
		opacity: 0.35;
	}
	.left,
	.right {
		overflow: auto;
		padding: 12px;
		border-right: 1px solid var(--color-border);
		background: var(--color-surface);
		min-width: 0;
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
		display: flex;
		flex-direction: column;
	}
	.board-wrap {
		flex: 1;
		min-height: 0;
		position: relative;
	}
	.canvas-ctx {
		position: fixed;
		z-index: 200001;
		min-width: 160px;
		padding: 4px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.canvas-ctx button {
		text-align: left;
		padding: 8px 10px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		border-radius: 4px;
		font-size: 13px;
	}
	.canvas-ctx button:hover {
		background: rgba(59, 130, 246, 0.15);
	}
</style>
