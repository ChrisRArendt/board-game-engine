<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import Piece from './Piece.svelte';
	import BoardWidgetRenderer from './BoardWidgetRenderer.svelte';
	import SelectionBox from './SelectionBox.svelte';
	import PlayerSlotScore from './PlayerSlotScore.svelte';
	import ResizeHandles from '$lib/components/editor/ResizeHandles.svelte';
	import PlayerZonesEditorOverlay from '$lib/components/editor/PlayerZonesEditorOverlay.svelte';
	import InitialPlayViewFrame from '$lib/components/editor/InitialPlayViewFrame.svelte';
	import * as g from '$lib/stores/game';
	import { game, ARRANGEMENT_ANIM_MOVE_MS } from '$lib/stores/game';
	import { ZOOM_DEFAULT, type ViewportFitInset } from '$lib/engine/geometry';
	import { PointerEngine } from '$lib/engine/pointer';
	import { users } from '$lib/stores/users';
	import {
		emit,
		getLocalPlayerColor,
		playerColorOverrides,
		playerOrder,
		turnHighlightUserIds
	} from '$lib/stores/network';
	import { settings } from '$lib/stores/settings';
	import type { BoardWidget, PieceInstance } from '$lib/engine/types';
	import {
		buildStashRoster,
		canSelectPieceForViewer,
		dealRectForRosterIndex,
		scoreRectForRosterIndex,
		isPieceFaceHiddenFromPeers,
		playerSlotColor,
		PLAYER_SLOT_MAX,
		safeRectForRosterIndex
	} from '$lib/engine/stash';
	import { dragPerfHud, initDragPerfFromEnv, destroyDragPerf } from '$lib/debug/dragPerf';
	import { boardPointerBlocked } from '$lib/stores/boardPointerBlock';
	import { dealDialog } from '$lib/stores/dealDialog';

	function boardInputBlocked(): boolean {
		return get(boardPointerBlocked) || get(dealDialog).open;
	}

	/** Topmost element at (x,y); works even if pointer-events / store state disagree. */
	function isPointerOverDealUi(clientX: number, clientY: number): boolean {
		if (!browser || typeof document === 'undefined') return false;
		const el = document.elementFromPoint(clientX, clientY);
		return Boolean(el?.closest?.('[data-bge-deal-dialog]'));
	}

	/** When true, wheel pans; when false (default), wheel zooms. */
	export let scrollWheelPans = false;
	export let panScreenEdge = false;
	export let replayMode = false;
	export let onOpenViewer: ((pieceId: number) => void) | undefined = undefined;
	export let onViewerFollowPiece: ((pieceId: number) => void) | undefined = undefined;
	export let selfUserId: string;
	export let selfDisplayName = 'You';
	/** Long-press on touch: open context menu at (x,y) in client coords */
	export let onOpenContextMenu: ((clientX: number, clientY: number) => void) | undefined = undefined;
	/** Board layout editor: no stash, all pieces/widgets selectable, no realtime emits */
	export let editorMode = false;
	/** Editor: fill parent instead of 100vw/100vh */
	export let embeddedEditor = false;
	export let showGridOverlay = false;
	export let gridSize = 20;
	/** Board editor: right-click on a piece (supplies client coords + piece id). */
	export let onEditorPieceContextMenu: ((e: MouseEvent, pieceId: number) => void) | undefined = undefined;
	/** Board editor: interactive safe/deal rects when `playerSlots` is set. */
	export let showEditorPlayerZonesPreview = false;
	/** Called after drag/resize of player zones (e.g. commit undo history). */
	export let onPlayerZonesEdited: (() => void) | undefined = undefined;
	/** Board editor: show frame for saved initial play viewport. */
	export let showInitialPlayViewFrame = false;
	/** Play: inset from viewport edges when fitting `initial_play_view` (e.g. fixed toolbar above the board). */
	export let initialPlayFitInset: ViewportFitInset | undefined = undefined;

	let viewportEl: HTMLDivElement | undefined;
	let viewportW = 0;
	let viewportH = 0;
	let cameraEl: HTMLDivElement | undefined;
	let mouseEl: HTMLDivElement | undefined;
	let tableEl: HTMLDivElement | undefined;

	let mouseTx = 0;
	let mouseTy = 0;

	let edgeTimer: ReturnType<typeof setInterval> | null = null;

	let pointerEngine: PointerEngine | null = null;
	let pressingPieceId: number | null = null;
	/** Coalesce drag sync to one `piece_moves_batch` per animation frame (not N messages per frame). */
	let dragMoveEmitRaf: number | null = null;

	function emitDragMovesBatch() {
		const st = get(game);
		const moves: Array<{ id: number; x: number; y: number }> = [];
		for (const p of st.pieces) {
			if (st.selectedIds.has(p.id) && p.attributes.includes('move')) {
				moves.push({ id: p.id, x: p.x, y: p.y });
			}
		}
		if (moves.length > 0) emit('piece_moves_batch', { moves });
	}

	let zoomHudVisible = false;
	let zoomHudTimer: ReturnType<typeof setTimeout> | null = null;
	let lastHudZoom = -1;

	let rotDrag: {
		pid: number;
		startAngle: number;
		startRot: number;
		cx: number;
		cy: number;
	} | null = null;

	/**
	 * When this string changes (saved world rect or game id), play mode re-fits pan/zoom.
	 * Intentionally does not depend on pan — avoids resetting the camera while playing.
	 */
	$: initialPlayFitKey = $game.initialPlayView
		? `${$game.curGame}|${JSON.stringify($game.initialPlayView.world_rect)}|${JSON.stringify(initialPlayFitInset ?? null)}`
		: '';
	let lastInitialPlayFitKey = '';

	$: if (!initialPlayFitKey) lastInitialPlayFitKey = '';

	$: if (
		browser &&
		!editorMode &&
		initialPlayFitKey &&
		viewportW > 8 &&
		viewportH > 8 &&
		initialPlayFitKey !== lastInitialPlayFitKey
	) {
		lastInitialPlayFitKey = initialPlayFitKey;
		g.applyInitialPlayViewToViewport(viewportW, viewportH, { inset: initialPlayFitInset });
	}

	$: if (browser && viewportW > 8 && viewportH > 8) {
		g.setBoardViewportForCapture(viewportW, viewportH);
	}

	function worldFromClient(clientX: number, clientY: number) {
		const st = get(game);
		return { x: (clientX - st.panX) / st.zoom, y: (clientY - st.panY) / st.zoom };
	}

	function onRotHandleDown(p: PieceInstance, e: PointerEvent) {
		if (!editorMode || p.locked) return;
		e.preventDefault();
		e.stopPropagation();
		const w = worldFromClient(e.clientX, e.clientY);
		const cx = p.x + p.initial_size.w / 2;
		const cy = p.y + p.initial_size.h / 2;
		const startAngle = (Math.atan2(w.y - cy, w.x - cx) * 180) / Math.PI;
		const startRot = p.rotation ?? 0;
		rotDrag = { pid: p.id, startAngle, startRot, cx, cy };
		window.addEventListener('pointermove', onRotMove);
		window.addEventListener('pointerup', onRotUp);
	}

	function onRotMove(e: PointerEvent) {
		const rd = rotDrag;
		if (!rd) return;
		const w = worldFromClient(e.clientX, e.clientY);
		const angleNow = (Math.atan2(w.y - rd.cy, w.x - rd.cx) * 180) / Math.PI;
		let delta = angleNow - rd.startAngle;
		while (delta > 180) delta -= 360;
		while (delta < -180) delta += 360;
		let newRot = rd.startRot + delta;
		if (e.shiftKey) newRot = Math.round(newRot / 45) * 45;
		newRot = ((newRot % 360) + 360) % 360;
		const cur = get(game).pieces.find((x) => x.id === rd.pid);
		if (!cur) return;
		g.replacePieceInstance({ ...cur, rotation: newRot });
	}

	function onRotUp() {
		rotDrag = null;
		window.removeEventListener('pointermove', onRotMove);
		window.removeEventListener('pointerup', onRotUp);
	}

	function prefersReducedMotion(): boolean {
		if (!browser || typeof matchMedia === 'undefined') return false;
		return matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function docOffset(el: HTMLElement) {
		const r = el.getBoundingClientRect();
		return {
			left: r.left + window.scrollX,
			top: r.top + window.scrollY
		};
	}

	function stashRosterNow() {
		return buildStashRoster({
			selfUserId,
			selfDisplayName,
			selfColor: getLocalPlayerColor(),
			users: get(users),
			playerOrder: get(playerOrder),
			playerColorOverrides: get(playerColorOverrides)
		});
	}

	function canViewerSelectPiece(piece: PieceInstance): boolean {
		if (editorMode) return true;
		return canSelectPieceForViewer(
			piece,
			stashRosterNow(),
			selfUserId,
			replayMode,
			get(game).playerSlots
		);
	}

	function onPointerMoveGlobal(e: PointerEvent) {
		if (replayMode) return;
		const st = get(game);
		const zm = st.zoom;
		mouseTx = Math.floor((-st.panX + e.clientX) * (1 / zm));
		mouseTy = Math.floor((-st.panY + e.clientY) * (1 / zm));

		/* Piece drag / pan / selection box are driven by PointerEngine to avoid duplicate updates */

		if (panScreenEdge && !st.handscroll && !st.moveDrag) {
			const vp = { w: window.innerWidth, h: window.innerHeight };
			const margin = { x: vp.h * 0.1, y: vp.h * 0.1 };
			const speed = 20;
			let tx = 0,
				ty = 0;
			if (vp.w - margin.x < e.clientX)
				tx = (-speed * (e.clientX - (vp.w - margin.x))) / margin.x;
			else if (e.clientX < margin.x) tx = (speed * (margin.x - e.clientX)) / margin.x;
			if (vp.h - margin.y < e.clientY)
				ty = (-speed * (e.clientY - (vp.h - margin.y))) / margin.y;
			else if (e.clientY < 30 + margin.y && e.clientY > 30)
				ty = (speed * (margin.y + 30 - e.clientY)) / margin.y;
			g.setEdgePan(tx, ty);
		}
	}

	onMount(() => {
		initDragPerfFromEnv();
		pointerEngine = new PointerEngine({
			prefersReducedMotion,
			onPanStart: (x, y) => {
				g.startPanPointer(x, y);
			},
			onPanMove: (x, y) => {
				g.movePanPointer(x, y);
			},
			onPanEnd: () => {
				g.endPanPointer();
			},
			onPanInertia: (vx, vy) => {
				g.startPanInertia(vx, vy);
			},
			onPinch: (newZoom, midX, midY, pinchStart) => {
				g.setPinchZoomAtMid(newZoom, midX, midY, pinchStart);
			},
			onPieceMouseDown: async (pieceId, e) => {
				if (replayMode) return;
				e.stopPropagation();
				const st = get(game);
				if (st.spacePanHeld) {
					g.startPanPointer(e.clientX, e.clientY);
					return;
				}
				const piece = st.pieces.find((p) => p.id === pieceId);
				if (!piece) return;
				if (!canViewerSelectPiece(piece)) return;
				if (piece.attributes.includes('select')) {
					g.clickSelect(piece.id, st.shiftDown);
					await tick();
				}
				const st2 = get(game);
				if (piece.attributes.includes('move')) {
					g.startMoveDrag(piece.id, e.clientX, e.clientY, st2.panX, st2.panY);
				}
				onViewerFollowPiece?.(piece.id);
			},
			onWidgetMouseDown: async (widgetId, e) => {
				if (replayMode || !editorMode) return;
				e.stopPropagation();
				const st = get(game);
				if (st.spacePanHeld) {
					g.startPanPointer(e.clientX, e.clientY);
					return;
				}
				g.selectWidgetForEditor(widgetId, st.shiftDown);
				await tick();
				const st2 = get(game);
				const w = st2.widgets.find((x) => x.id === widgetId);
				if (!w || w.locked) return;
				g.beginMoveDrag(e.clientX, e.clientY, st2.panX, st2.panY);
			},
			onPieceTouchPressing: (pieceId, pressing) => {
				pressingPieceId = pressing ? pieceId : null;
			},
			onPieceTouchTap: (pieceId, shift) => {
				const p = get(game).pieces.find((x) => x.id === pieceId);
				if (!p) return;
				if (!canViewerSelectPiece(p)) return;
				if (p.attributes.includes('select')) {
					g.clickSelect(pieceId, shift);
				}
				onViewerFollowPiece?.(pieceId);
			},
			onPieceTouchDragStart: (pieceId, clientX, clientY) => {
				const st = get(game);
				const piece = st.pieces.find((p) => p.id === pieceId);
				if (!piece?.attributes.includes('move')) return;
				if (!canViewerSelectPiece(piece)) return;
				const st2 = get(game);
				g.startMoveDrag(pieceId, clientX, clientY, st2.panX, st2.panY);
				onViewerFollowPiece?.(pieceId);
			},
			isPieceSelectedForTouchDrag: (pieceId: number) => {
				const st = get(game);
				const piece = st.pieces.find((p) => p.id === pieceId);
				if (!piece?.attributes.includes('move')) return false;
				if (!canViewerSelectPiece(piece)) return false;
				if (!piece.attributes.includes('select')) return true;
				return st.selectedIds.has(pieceId);
			},
			onPieceDragMove: (x, y) => {
				g.moveDragTo(x, y);
				if (editorMode) return;
				if (dragMoveEmitRaf != null) cancelAnimationFrame(dragMoveEmitRaf);
				dragMoveEmitRaf = requestAnimationFrame(() => {
					dragMoveEmitRaf = null;
					emitDragMovesBatch();
				});
			},
			onPieceDragEnd: () => {
				if (dragMoveEmitRaf != null) {
					cancelAnimationFrame(dragMoveEmitRaf);
					dragMoveEmitRaf = null;
				}
				emitDragMovesBatch();
				g.endMoveDrag();
			},
			onPieceDragCancel: () => {
				if (dragMoveEmitRaf != null) {
					cancelAnimationFrame(dragMoveEmitRaf);
					dragMoveEmitRaf = null;
				}
				emitDragMovesBatch();
				g.cancelMoveDrag();
			},
			onLongPress: (pieceId, x, y) => {
				const piece = get(game).pieces.find((p) => p.id === pieceId);
				if (!piece || !canViewerSelectPiece(piece)) return;
				onOpenContextMenu?.(x, y);
			},
			onTapEmpty: () => {
				g.deselectAll();
			},
			onMouseTableDown: (direct, clientX, clientY, shift) => {
				if (!direct) return;
				if (isPointerOverDealUi(clientX, clientY)) return;
				const st = get(game);
				if (st.spacePanHeld) {
					g.startPanPointer(clientX, clientY);
					return;
				}
				/** Board editor: drag on the table = marquee (RTS-style). Hold Space to pan instead. Shift = add to current selection. */
				if (editorMode) {
					if (!shift) {
						g.deselectAll();
					}
					g.startSelectionBox(clientX, clientY);
					return;
				}
				if (shift) {
					g.startSelectionBox(clientX, clientY);
					return;
				}
				g.deselectAll();
				g.startPanPointer(clientX, clientY);
			},
			onSelectionBoxMove: (x, y) => {
				const rects = new Map<number, { x: number; y: number; w: number; h: number }>();
				const widgetRects = new Map<number, { x: number; y: number; w: number; h: number }>();
				if (browser) {
					document.querySelectorAll<HTMLElement>('[data-piece-id]').forEach((el) => {
						const id = parseInt(el.dataset.pieceId ?? '', 10);
						if (Number.isNaN(id)) return;
						const r = el.getBoundingClientRect();
						rects.set(id, { x: r.left, y: r.top, w: r.width, h: r.height });
					});
					/** Play mode: marquee selects pieces only (widgets are not interactable on the board). */
					if (editorMode) {
						document.querySelectorAll<HTMLElement>('[data-board-widget-id]').forEach((el) => {
							const id = parseInt(el.dataset.boardWidgetId ?? '', 10);
							if (Number.isNaN(id)) return;
							const r = el.getBoundingClientRect();
							widgetRects.set(id, { x: r.left, y: r.top, w: r.width, h: r.height });
						});
					}
				}
				g.updateSelectionBox(x, y, rects, {
					canSelectPiece: canViewerSelectPiece,
					widgetRects: editorMode ? widgetRects : undefined
				});
			},
			onSelectionBoxEnd: () => {
				g.endSelectionBox();
			},
			onSecondPointerDuringDrag: () => {
				g.cancelMoveDrag();
			},
			getZoom: () => get(game).zoom,
			getPan: () => ({ panX: get(game).panX, panY: get(game).panY }),
			getSpacePan: () => get(game).spacePanHeld,
			getShift: () => get(game).shiftDown,
			getMoveDrag: () => get(game).moveDrag != null,
			getPanPointerActive: () => get(game).panPointerStart != null,
			getSelectingBox: () => get(game).selectingBox
		});
		pointerEngine.attachWindowListeners();

		window.addEventListener('pointermove', onPointerMoveGlobal);
		edgeTimer = setInterval(() => {
			const st = get(game);
			if (panScreenEdge && (st.edgePan.x !== 0 || st.edgePan.y !== 0)) {
				g.applyEdgePanStep();
			}
		}, 1000 / 30);
	});

	onDestroy(() => {
		if (!browser) return;
		destroyDragPerf();
		pointerEngine?.destroy();
		pointerEngine = null;
		window.removeEventListener('pointermove', onPointerMoveGlobal);
		if (edgeTimer) clearInterval(edgeTimer);
		if (zoomHudTimer) clearTimeout(zoomHudTimer);
	});

	function onViewportPointerDown(e: PointerEvent) {
		if (replayMode) return;
		if (isPointerOverDealUi(e.clientX, e.clientY)) return;
		const blocked = boardInputBlocked();
		const target = e.target as HTMLElement;
		const dealHit = !!target.closest?.('[data-bge-deal-dialog]');
		if (blocked) return;
		if (dealHit) return;
		if (target.closest('.table')) return;
		if (target.closest('[data-piece-id]')) return;
		if (target.closest('[data-board-widget-id]')) return;
		if (target.closest('.zoom-hud')) return;
		if (target.closest('.editor-resize-layer')) return;
		if (e.pointerType === 'touch') {
			pointerEngine?.handlePointerDown(e, { kind: 'viewport' });
			return;
		}
		const st = get(game);
		if (st.spacePanHeld) {
			pointerEngine?.handlePointerDown(e, { kind: 'viewport' });
			return;
		}
		if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
			pointerEngine?.handlePointerDown(e, { kind: 'viewport' });
		}
	}

	function onTablePointerDown(e: PointerEvent) {
		if (replayMode) return;
		if (isPointerOverDealUi(e.clientX, e.clientY)) return;
		if (boardInputBlocked()) return;
		if ((e.target as HTMLElement).closest?.('[data-bge-deal-dialog]')) return;
		const direct = e.target === e.currentTarget;
		pointerEngine?.handlePointerDown(e, { kind: 'table', direct });
	}

	function onWheel(e: WheelEvent) {
		if (replayMode) return;
		if (isPointerOverDealUi(e.clientX, e.clientY)) return;
		if (boardInputBlocked()) return;
		e.preventDefault();
		const st = get(game);
		if (scrollWheelPans) {
			g.applyPanDelta(e.deltaX, e.deltaY);
		} else {
			const el = mouseEl ?? cameraEl;
			const focal = el
				? {
						x: el.getBoundingClientRect().left + el.clientWidth / 2,
						y: el.getBoundingClientRect().top + el.clientHeight / 2
					}
				: { x: window.innerWidth / 2, y: window.innerHeight / 2 };
			g.adjustZoomWheel(e.deltaY, focal);
		}
	}

	async function onPiecePointerDown(piece: PieceInstance, e: PointerEvent) {
		if (replayMode) return;
		if (isPointerOverDealUi(e.clientX, e.clientY)) return;
		if (boardInputBlocked()) return;
		e.stopPropagation();
		if (e.pointerType === 'touch') {
			pointerEngine?.handlePointerDown(e, { kind: 'piece', pieceId: piece.id });
			return;
		}
		/* mouse / pen: engine handles via window */
		pointerEngine?.handlePointerDown(e, { kind: 'piece', pieceId: piece.id });
	}

	function zoomLabel(z: number) {
		if (Math.abs(z - 1) < 0.02) return '100%';
		if (z < 1) return `${Math.round(z * 100)}%`;
		return `${z.toFixed(2)}×`;
	}

	function onZoomHudClick() {
		const vp = { w: window.innerWidth, h: window.innerHeight };
		g.resetZoomAtFocal({ x: vp.w / 2, y: vp.h / 2 });
	}

	$: {
		const z = $game.zoom;
		if (lastHudZoom < 0) {
			lastHudZoom = z;
		} else if (z !== lastHudZoom) {
			lastHudZoom = z;
			zoomHudVisible = true;
			if (zoomHudTimer) clearTimeout(zoomHudTimer);
			zoomHudTimer = setTimeout(() => {
				zoomHudVisible = false;
				zoomHudTimer = null;
			}, 1500);
		}
	}

	$: stashRoster = (() => {
		$users;
		$playerOrder;
		$playerColorOverrides;
		$settings;
		return buildStashRoster({
			selfUserId,
			selfDisplayName,
			selfColor: getLocalPlayerColor(),
			users: $users,
			playerOrder: $playerOrder,
			playerColorOverrides: $playerColorOverrides
		});
	})();

	$: zm = $game.zoom;
	$: bgTable = $game.assetBaseUrl
		? `${$game.assetBaseUrl}${$game.tableBgFilename}?v=${$game.tableBgRev}`
		: `/data/${$game.curGame}/images/${$game.tableBgFilename}`;
	$: bgEnv =
		$game.envBgFilename?.trim() &&
		($game.assetBaseUrl
			? `${$game.assetBaseUrl}${$game.envBgFilename}?v=${$game.envBgRev}`
			: `/data/${$game.curGame}/images/${$game.envBgFilename}?v=${$game.envBgRev}`);
	/** World-space bounds for the repeating env layer around the table. Anchored to the table only — do not grow from piece/widget positions or the plane shifts and the tiled background appears to slide when cards move past the table edge. */
	$: envPlaneRect = (() => {
		const tw = $game.table.w;
		const th = $game.table.h;
		const pad = 8000;
		return {
			x: -pad,
			y: -pad,
			w: tw + pad * 2,
			h: th + pad * 2
		};
	})();
	/** Single selected piece in board editor — show handles (disabled when locked so state is obvious). */
	$: editorResizeTarget =
		editorMode && $game.selectedIds.size === 1 && $game.selectedWidgetIds.size === 0
			? $game.pieces.find((p) => $game.selectedIds.has(p.id)) ?? null
			: null;
	$: editorResizeWidget =
		editorMode && $game.selectedWidgetIds.size === 1 && $game.selectedIds.size === 0
			? $game.widgets.find((w) => $game.selectedWidgetIds.has(w.id)) ?? null
			: null;

	function onWidgetValueChange(id: number, value: string | number | boolean) {
		g.setWidgetValue(id, value);
		if (!editorMode) {
			emit('widget_value_change', { widgetId: id, value });
		}
	}

	$: boardLayerItems = (() => {
		type Row =
			| { k: 'p'; piece: PieceInstance; z: number }
			| { k: 'w'; widget: BoardWidget; z: number };
		const rows: Row[] = [];
		for (const p of $game.pieces) rows.push({ k: 'p', piece: p, z: p.zIndex });
		for (const w of $game.widgets) rows.push({ k: 'w', widget: w, z: w.zIndex });
		rows.sort((a, b) => a.z - b.z);
		return rows;
	})();
	$: viewportCursor = replayMode
		? 'default'
		: $game.spacePanHeld && $game.handscroll
			? 'grabbing'
			: $game.spacePanHeld
				? 'grab'
				: $game.handscroll
					? 'grabbing'
					: $game.moveDrag &&
						  ($game.selectedIds.size > 0 || $game.selectedWidgetIds.size > 0)
						? 'move'
						: 'default';
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="viewport"
	class:embedded-editor={embeddedEditor}
	class:space-pan={$game.spacePanHeld}
	class:handscroll={$game.handscroll}
	class:replay-mode={replayMode}
	class:dragging-piece={$game.moveDrag != null}
	class:deal-modal-suspend={$dealDialog.open}
	style:cursor={viewportCursor}
	bind:this={viewportEl}
	bind:clientWidth={viewportW}
	bind:clientHeight={viewportH}
	data-board-editor-canvas
	onpointerdown={onViewportPointerDown}
	onwheel={onWheel}
>
	{#if $dragPerfHud}
		<div class="drag-perf-hud" aria-live="polite">
			<span class="drag-perf-title">Drag perf</span>
			<span class="drag-perf-line">
				last {$dragPerfHud.lastMs.toFixed(2)}ms · avg {$dragPerfHud.avgMs} · max {$dragPerfHud.maxMs} · min
				{$dragPerfHud.minMs} · n={$dragPerfHud.samples}
			</span>
			<span class="drag-perf-line">
				board pieces {$dragPerfHud.boardPieces} · selected (move) {$dragPerfHud.selectedMoving}
				{#if $dragPerfHud.editorSnap} · editor snap{/if}
			</span>
		</div>
	{/if}
	<div class="game" class:will-move={$game.handscroll || $game.panPointerStart != null} style:transform="translate3d({$game.panX}px, {$game.panY}px, 0)">
		<div
			class="pieces-layer"
			style:transform="scale({zm})"
			style:transform-origin="0 0"
		>
			{#if bgEnv}
				<div
					class="env-plane"
					style:left="{envPlaneRect.x}px"
					style:top="{envPlaneRect.y}px"
					style:width="{envPlaneRect.w}px"
					style:height="{envPlaneRect.h}px"
					style:background-image="url({bgEnv})"
					aria-hidden="true"
				></div>
			{/if}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="table"
				bind:this={tableEl}
				style:width="{$game.table.w}px"
				style:height="{$game.table.h}px"
				style:background-image="url({bgTable})"
				onpointerdown={onTablePointerDown}
			>
				{#if editorMode && showGridOverlay}
					<svg
						class="grid-overlay"
						width={$game.table.w}
						height={$game.table.h}
						aria-hidden="true"
					>
						<defs>
							<pattern
								id="bedGrid"
								width={gridSize}
								height={gridSize}
								patternUnits="userSpaceOnUse"
							>
								<path
									d="M {gridSize} 0 L 0 0 0 {gridSize}"
									fill="none"
									stroke="rgba(255,255,255,0.08)"
									stroke-width="1"
								/>
							</pattern>
						</defs>
						<rect width="100%" height="100%" fill="url(#bedGrid)" />
					</svg>
				{/if}
			</div>

			{#if editorMode && showInitialPlayViewFrame && $game.initialPlayView}
				<InitialPlayViewFrame
					view={$game.initialPlayView}
					tableW={$game.table.w}
					tableH={$game.table.h}
				/>
			{/if}

			{#if !editorMode}
				<!-- Your private zone: under pieces so you see your own tokens clearly on top. -->
				<div class="user-stashes user-stashes-mine" aria-hidden="true">
					{#each stashRoster as user, i (user.id)}
						{#if user.id === selfUserId}
							{@const safe = safeRectForRosterIndex(i, $game.playerSlots)}
							<div
								class="stash-slot"
								class:stash-turn={$turnHighlightUserIds.includes(user.id)}
								style:transform="translate3d({safe.x}px, {safe.y}px, 0)"
								style:width="{safe.w}px"
							>
								<div
									class="stash footprint mine"
									style:width="{safe.w}px"
									style:height="{safe.h}px"
									style:background-color={user.color}
								>
									<span class="sr-only">Your private area</span>
								</div>
							</div>
						{/if}
					{/each}
				</div>

				<!-- Deal targets: under pieces; dashed outline + flag -->
				<div class="user-deal-zones" aria-hidden="true">
					{#each stashRoster as user, i (user.id)}
						{@const deal = dealRectForRosterIndex(i, $game.playerSlots)}
						{@const dealAccent = user.color || playerSlotColor(i)}
						<div
							class="deal-zone"
							style:transform="translate3d({deal.x}px, {deal.y}px, 0)"
							style:width="{deal.w}px"
							style:height="{deal.h}px"
							style:border-color={dealAccent}
						>
							<span class="deal-flag" aria-hidden="true">🚩</span>
							<span class="deal-label">{user.name}</span>
						</div>
					{/each}
					{#if $game.playerSlots && $game.playerSlots.length > stashRoster.length}
						{#each Array.from({ length: Math.min($game.playerSlots.length, PLAYER_SLOT_MAX) - stashRoster.length }) as _, j}
							{@const idx = stashRoster.length + j}
							{@const deal = dealRectForRosterIndex(idx, $game.playerSlots)}
							<div
								class="deal-zone deal-zone-unused"
								style:transform="translate3d({deal.x}px, {deal.y}px, 0)"
								style:width="{deal.w}px"
								style:height="{deal.h}px"
								style:border-color={playerSlotColor(idx)}
							>
								<span class="deal-flag" aria-hidden="true">🚩</span>
								<span class="deal-label">Slot {idx + 1}</span>
							</div>
						{/each}
					{/if}
				</div>
			{/if}

			{#each boardLayerItems as row (row.k === 'p' ? 'p' + row.piece.id : 'w' + row.widget.id)}
				{#if row.k === 'p'}
					{@const piece = row.piece}
					{#if !piece.hidden}
						<Piece
							{piece}
							boardZoom={zm}
							curGame={$game.curGame}
							assetBaseUrl={$game.assetBaseUrl}
							replayMode={replayMode}
							smoothPosition={(!editorMode && !replayMode) || $game.arrangementAnimationActive}
							smoothDurationMs={$game.arrangementAnimationActive
								? ARRANGEMENT_ANIM_MOVE_MS
								: undefined}
							arrangeAnimating={$game.arrangementAnimationActive}
							editorMode={editorMode}
							onEditorContextMenu={editorMode ? onEditorPieceContextMenu : undefined}
							faceHidden={editorMode
								? false
								: isPieceFaceHiddenFromPeers(
										piece,
										stashRoster,
										selfUserId,
										replayMode,
										$game.playerSlots
									)}
							selected={$game.selectedIds.has(piece.id)}
							dragging={$game.moveDrag != null && $game.selectedIds.has(piece.id) && piece.attributes.includes('move')}
							shuffleLifting={$game.shuffleLiftIds?.has(piece.id) ?? false}
							pressing={pressingPieceId === piece.id}
							remoteColor={$game.remoteSelection[piece.id]}
							onpointerdown={(e) => onPiecePointerDown(piece, e)}
							onpiecedblclick={(id) => {
								const piece = get(game).pieces.find((p) => p.id === id);
								if (!piece || !canViewerSelectPiece(piece)) return;
								onOpenViewer?.(id);
							}}
						/>
					{/if}
				{:else}
					{@const widget = row.widget}
					{#if !widget.hidden}
						<BoardWidgetRenderer
							{widget}
							boardZoom={zm}
							{editorMode}
							{replayMode}
							selected={$game.selectedWidgetIds.has(widget.id)}
							dragging={$game.moveDrag != null && $game.selectedWidgetIds.has(widget.id)}
							onpointerdown={editorMode
								? (e) => {
										e.stopPropagation();
										pointerEngine?.handlePointerDown(e, { kind: 'widget', widgetId: widget.id });
									}
								: undefined}
							onValueChange={onWidgetValueChange}
						/>
					{/if}
				{/if}
			{/each}

			{#if !editorMode && $game.playerSlots}
				<div class="player-score-layer" aria-hidden="true">
					{#each stashRoster as user, i (user.id)}
						{@const sr = scoreRectForRosterIndex(i, $game.playerSlots)}
						<div
							class="player-score-anchor"
							style:transform="translate3d({sr.x}px, {sr.y}px, 0)"
							style:width="{sr.w}px"
							style:min-height="{sr.h}px"
						>
							<PlayerSlotScore
								value={$game.playerSlotScores[i] ?? 0}
								accent={user.color || playerSlotColor(i)}
								disabled={replayMode}
								onChange={(v) => g.setPlayerSlotScore(i, v)}
							/>
						</div>
					{/each}
				</div>
			{/if}

			{#if editorMode && $game.editorSnapGuides && ($game.editorSnapGuides.verticals.length > 0 || $game.editorSnapGuides.horizontals.length > 0)}
				<svg
					class="snap-guides"
					width={$game.table.w}
					height={$game.table.h}
					aria-hidden="true"
				>
					{#each $game.editorSnapGuides.verticals as x}
						<line x1={x} y1={0} x2={x} y2={$game.table.h} stroke="#ec4899" stroke-width="1" opacity="0.85" />
					{/each}
					{#each $game.editorSnapGuides.horizontals as y}
						<line x1={0} y1={y} x2={$game.table.w} y2={y} stroke="#ec4899" stroke-width="1" opacity="0.85" />
					{/each}
				</svg>
			{/if}

			{#if editorMode && editorResizeTarget}
				<div
					class="editor-resize-layer"
					class:piece-locked-handles={editorResizeTarget.locked === true}
					style:z-index={editorResizeTarget.zIndex + 100000}
				>
					<ResizeHandles
						x={editorResizeTarget.x}
						y={editorResizeTarget.y}
						w={editorResizeTarget.initial_size.w}
						h={editorResizeTarget.initial_size.h}
						zoomScale={zm}
						disabled={editorResizeTarget.locked === true}
						onResize={(next, _kind, _e) => {
							const cur = get(game).pieces.find((x) => x.id === editorResizeTarget!.id);
							if (!cur || cur.locked) return;
							g.replacePieceInstance({
								...cur,
								x: next.x,
								y: next.y,
								initial_size: { w: next.w, h: next.h },
								image_size: cur.image_size ? { w: next.w, h: next.h } : undefined
							});
						}}
					/>
					{#if editorResizeTarget.locked !== true}
						<button
							type="button"
							class="rot-knob"
							style:left="{editorResizeTarget.x + editorResizeTarget.initial_size.w / 2 - 10}px"
							style:top="{editorResizeTarget.y - 28}px"
							style:z-index={editorResizeTarget.zIndex + 100001}
							aria-label="Rotate"
							onpointerdown={(e) => onRotHandleDown(editorResizeTarget!, e)}
						></button>
					{/if}
				</div>
			{:else if editorMode && editorResizeWidget}
				<div
					class="editor-resize-layer"
					class:piece-locked-handles={editorResizeWidget.locked === true}
					style:z-index={editorResizeWidget.zIndex + 100000}
				>
					<ResizeHandles
						x={editorResizeWidget.x}
						y={editorResizeWidget.y}
						w={editorResizeWidget.w}
						h={editorResizeWidget.h}
						zoomScale={zm}
						disabled={editorResizeWidget.locked === true}
						onResize={(next, _kind, _e) => {
							const cur = get(game).widgets.find((x) => x.id === editorResizeWidget!.id);
							if (!cur || cur.locked) return;
							g.replaceWidgetInstance({
								...cur,
								x: next.x,
								y: next.y,
								w: next.w,
								h: next.h
							});
						}}
					/>
				</div>
			{/if}

			{#if editorMode && showEditorPlayerZonesPreview && $game.playerSlots}
				<PlayerZonesEditorOverlay zoomScale={zm} onEdited={onPlayerZonesEdited} />
			{/if}

			{#if !editorMode}
				<!-- Other players’ zones: on top of pieces so their area obscures hidden tokens for everyone else. -->
				<div class="user-stashes user-stashes-others" aria-hidden="true">
					{#each stashRoster as user, i (user.id)}
						{#if user.id !== selfUserId}
							{@const safe = safeRectForRosterIndex(i, $game.playerSlots)}
							<div
								class="stash-slot"
								class:stash-turn={$turnHighlightUserIds.includes(user.id)}
								style:transform="translate3d({safe.x}px, {safe.y}px, 0)"
								style:width="{safe.w}px"
							>
								<div
									class="stash footprint theirs"
									style:width="{safe.w}px"
									style:height="{safe.h}px"
									style:background-color={user.color}
								></div>
								<div
									class="stash top"
									style:width="{safe.w}px"
									style:height="{safe.h}px"
									style:background-color={user.color}
								>
									{user.name}
								</div>
								<div class="stash-private-label" aria-hidden="true">PRIVATE</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			<div
				class="camera"
				bind:this={cameraEl}
				style:transform="translate3d({$game.cameraX}px, {$game.cameraY}px, 0)"
			></div>
			<div
				class="mouse"
				bind:this={mouseEl}
				style:transform="translate3d({mouseTx}px, {mouseTy}px, 0)"
			></div>
		</div>
	</div>

	{#if $game.selectionBox && $game.selectingBox}
		<SelectionBox rect={$game.selectionBox} zoom={$game.zoom} />
	{/if}

	<button
		type="button"
		class="zoom-hud"
		class:visible={zoomHudVisible}
		onclick={onZoomHudClick}
		title="Reset zoom ({Math.round(ZOOM_DEFAULT * 100)}%)"
	>
		{zoomLabel($game.zoom)}
	</button>
</div>

<style>
	.viewport.embedded-editor {
		width: 100%;
		height: 100%;
		min-height: 0;
	}
	.viewport:not(.embedded-editor) {
		width: 100vw;
		height: 100vh;
	}
	.viewport {
		position: relative;
		overflow: hidden;
		touch-action: none;
		z-index: 0;
	}
	/** Deal modal is portaled to body; still disable hit-testing on the whole board while it is open. */
	.viewport.deal-modal-suspend,
	.viewport.deal-modal-suspend * {
		pointer-events: none !important;
	}
	.drag-perf-hud {
		position: fixed;
		left: 8px;
		bottom: 8px;
		z-index: 999999;
		max-width: min(420px, calc(100vw - 16px));
		padding: 6px 8px;
		border-radius: 6px;
		font: 11px/1.35 ui-monospace, monospace;
		color: #e8f0ff;
		background: rgba(12, 18, 32, 0.88);
		border: 1px solid rgba(255, 255, 255, 0.12);
		pointer-events: none;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
	}
	.drag-perf-title {
		display: block;
		font-weight: 600;
		margin-bottom: 2px;
		color: #9ecbff;
	}
	.drag-perf-line {
		display: block;
		opacity: 0.95;
	}
	/* Space-pan / scroll-pan: override child cursors (widgets, controls) so the hand shows everywhere. */
	.viewport.space-pan:not(.handscroll),
	.viewport.space-pan:not(.handscroll) * {
		cursor: grab !important;
	}
	.viewport.handscroll,
	.viewport.handscroll * {
		cursor: grabbing !important;
	}
	.game {
		position: absolute;
		z-index: 0;
	}
	.game.will-move {
		will-change: transform;
	}
	.pieces-layer {
		position: relative;
		z-index: 0;
		isolation: isolate;
	}
	.env-plane {
		position: absolute;
		z-index: -1;
		pointer-events: none;
		background-repeat: repeat;
		background-position: 0 0;
	}
	.grid-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}
	.snap-guides {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: none;
		z-index: 999997;
		overflow: visible;
	}
	.table {
		position: absolute;
		z-index: 0;
		background-repeat: no-repeat;
		background-size: cover;
	}
	.user-stashes {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.user-stashes-mine {
		z-index: 0;
	}
	.user-stashes-others {
		z-index: 90000;
		isolation: isolate;
	}
	.user-deal-zones {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 0;
	}
	.player-score-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 94000;
	}
	.player-score-anchor {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		box-sizing: border-box;
	}
	.deal-zone {
		position: absolute;
		top: 0;
		left: 0;
		box-sizing: border-box;
		border: 2px dashed rgba(255, 255, 255, 0.42);
		background: rgba(0, 0, 0, 0.12);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-start;
		padding: 6px 8px;
		gap: 2px;
	}
	.deal-zone-unused {
		opacity: 0.38;
		border-style: dotted;
	}
	.deal-flag {
		font-size: 18px;
		line-height: 1;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
	}
	.deal-label {
		font-size: 12px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.95);
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.stash-slot {
		position: absolute;
		top: 0;
		left: 0;
		width: 700px;
	}
	.stash {
		position: absolute;
		top: 0;
		left: 0;
		width: 700px;
		height: 600px;
		font-size: 40px;
		line-height: 50px;
		text-align: center;
		pointer-events: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	/* Owner sees their zone as a floor under their pieces — not a cover. */
	.stash.footprint.mine {
		color: #000;
		box-shadow:
			inset 0 0 0 2px rgba(0, 0, 0, 0.2),
			inset 0 6px 28px rgba(0, 0, 0, 0.45),
			inset 0 2px 8px rgba(0, 0, 0, 0.35);
	}
	/* Other players’ zones: mat on top to obscure what’s in their hand. */
	.stash.footprint.theirs {
		color: #000;
		box-shadow:
			inset 0 0 0 2px rgba(0, 0, 0, 0.2),
			inset 0 4px 24px rgba(0, 0, 0, 0.35);
	}
	/* Match UserList “my turn” ring: amber-300/400 (see .portrait-shell.has-turn) */
	.stash-slot.stash-turn > .stash.footprint.mine {
		box-shadow:
			0 0 0 3px rgba(251, 191, 36, 0.95),
			0 0 20px rgba(251, 191, 36, 0.45),
			inset 0 0 0 2px rgba(0, 0, 0, 0.2),
			inset 0 6px 28px rgba(0, 0, 0, 0.45),
			inset 0 2px 8px rgba(0, 0, 0, 0.35);
	}
	.stash-slot.stash-turn > .stash.footprint.theirs {
		box-shadow:
			0 0 0 3px rgba(251, 191, 36, 0.95),
			0 0 20px rgba(251, 191, 36, 0.45),
			inset 0 0 0 2px rgba(0, 0, 0, 0.2),
			inset 0 4px 24px rgba(0, 0, 0, 0.35);
	}
	.editor-resize-layer {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.editor-resize-layer :global(.box) {
		pointer-events: none;
	}
	.editor-resize-layer :global(.h) {
		pointer-events: auto;
	}
	.editor-resize-layer.piece-locked-handles :global(.box) {
		opacity: 0.5;
	}
	.editor-resize-layer.piece-locked-handles :global(.h) {
		cursor: not-allowed;
	}
	.rot-knob {
		position: absolute;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid var(--editor-selection, #3b82f6);
		background: rgba(255, 255, 255, 0.95);
		cursor: grab;
		pointer-events: auto;
		padding: 0;
	}
	.rot-knob:active {
		cursor: grabbing;
	}
	.stash.top {
		color: #fff;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.55);
		text-shadow: 0 1px 5px rgb(0 0 0);
	}
	.stash-private-label {
		position: absolute;
		left: 0;
		right: 0;
		top: 100%;
		margin-top: 10px;
		text-align: center;
		font-size: 22px;
		font-weight: 700;
		letter-spacing: 0.35em;
		color: rgba(0, 0, 0, 0.5);
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.25);
		pointer-events: none;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.camera,
	.mouse {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
	}
	.viewport.replay-mode {
		cursor: default;
	}
	.zoom-hud {
		position: fixed;
		right: 12px;
		bottom: 12px;
		z-index: 2000000000;
		padding: 6px 12px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.15);
		background: rgba(255, 255, 255, 0.92);
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: #222;
		cursor: pointer;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.25s ease;
	}
	.zoom-hud.visible {
		opacity: 1;
		pointer-events: auto;
	}
</style>
