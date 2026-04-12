<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import Piece from './Piece.svelte';
	import SelectionBox from './SelectionBox.svelte';
	import * as g from '$lib/stores/game';
	import { game } from '$lib/stores/game';
	import { ZOOM_DEFAULT } from '$lib/engine/geometry';
	import { PointerEngine } from '$lib/engine/pointer';
	import { users } from '$lib/stores/users';
	import { emit, getLocalPlayerColor, playerColorOverrides, playerOrder } from '$lib/stores/network';
	import { settings } from '$lib/stores/settings';
	import type { PieceInstance } from '$lib/engine/types';

	export let zoomWithScroll = false;
	export let panScreenEdge = false;
	export let replayMode = false;
	export let onOpenViewer: ((pieceId: number) => void) | undefined = undefined;
	export let onViewerFollowPiece: ((pieceId: number) => void) | undefined = undefined;
	export let selfUserId: string;
	export let selfDisplayName = 'You';
	/** Long-press on touch: open context menu at (x,y) in client coords */
	export let onOpenContextMenu: ((clientX: number, clientY: number) => void) | undefined = undefined;

	let viewportEl: HTMLDivElement | undefined;
	let cameraEl: HTMLDivElement | undefined;
	let mouseEl: HTMLDivElement | undefined;
	let tableEl: HTMLDivElement | undefined;

	let mouseTx = 0;
	let mouseTy = 0;

	let edgeTimer: ReturnType<typeof setInterval> | null = null;

	let pointerEngine: PointerEngine | null = null;
	let pressingPieceId: number | null = null;

	let zoomHudVisible = false;
	let zoomHudTimer: ReturnType<typeof setTimeout> | null = null;
	let lastHudZoom = -1;

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

	function stashPos(i: number) {
		return {
			x: 50 + (i % 6) * 720,
			y: 2300 + Math.floor(i / 6) * 800
		};
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
			onPieceTouchPressing: (pieceId, pressing) => {
				pressingPieceId = pressing ? pieceId : null;
			},
			onPieceTouchTap: (pieceId, shift) => {
				const p = get(game).pieces.find((x) => x.id === pieceId);
				if (p?.attributes.includes('select')) {
					g.clickSelect(pieceId, shift);
				}
				onViewerFollowPiece?.(pieceId);
			},
			onPieceTouchDragStart: (pieceId, clientX, clientY) => {
				const st = get(game);
				const piece = st.pieces.find((p) => p.id === pieceId);
				if (!piece?.attributes.includes('move')) return;
				if (piece.attributes.includes('select')) {
					g.clickSelect(pieceId, false);
				}
				const st2 = get(game);
				g.startMoveDrag(pieceId, clientX, clientY, st2.panX, st2.panY);
				onViewerFollowPiece?.(pieceId);
			},
			onPieceDragMove: (x, y) => {
				g.moveDragTo(x, y);
				const st2 = get(game);
				for (const p of st2.pieces) {
					if (st2.selectedIds.has(p.id) && p.attributes.includes('move')) {
						emit('piece_move', { id: p.id, x: p.x, y: p.y });
					}
				}
			},
			onPieceDragEnd: () => {
				g.endMoveDrag();
			},
			onPieceDragCancel: () => {
				g.cancelMoveDrag();
			},
			onLongPress: (pieceId, x, y) => {
				onOpenContextMenu?.(x, y);
			},
			onTapEmpty: () => {
				g.deselectAll();
			},
			onMouseTableDown: (direct, clientX, clientY, shift) => {
				if (!direct) return;
				const st = get(game);
				if (st.spacePanHeld) {
					g.startPanPointer(clientX, clientY);
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
				if (browser) {
					document.querySelectorAll<HTMLElement>('[data-piece-id]').forEach((el) => {
						const id = parseInt(el.dataset.pieceId ?? '', 10);
						if (Number.isNaN(id)) return;
						const r = el.getBoundingClientRect();
						rects.set(id, { x: r.left, y: r.top, w: r.width, h: r.height });
					});
				}
				g.updateSelectionBox(x, y, rects);
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
		pointerEngine?.destroy();
		pointerEngine = null;
		window.removeEventListener('pointermove', onPointerMoveGlobal);
		if (edgeTimer) clearInterval(edgeTimer);
		if (zoomHudTimer) clearTimeout(zoomHudTimer);
	});

	function onViewportPointerDown(e: PointerEvent) {
		if (replayMode) return;
		const target = e.target as HTMLElement;
		if (target.closest('.table')) return;
		if (target.closest('[data-piece-id]')) return;
		if (target.closest('.textregion')) return;
		if (e.pointerType === 'touch') {
			pointerEngine?.handlePointerDown(e, { kind: 'viewport' });
			return;
		}
		const st = get(game);
		if (!st.spacePanHeld) return;
		pointerEngine?.handlePointerDown(e, { kind: 'viewport' });
	}

	function onTablePointerDown(e: PointerEvent) {
		if (replayMode) return;
		const direct = e.target === e.currentTarget;
		pointerEngine?.handlePointerDown(e, { kind: 'table', direct });
	}

	function onWheel(e: WheelEvent) {
		if (replayMode) return;
		e.preventDefault();
		const st = get(game);
		if (zoomWithScroll) {
			const el = mouseEl ?? cameraEl;
			const focal = el
				? {
						x: el.getBoundingClientRect().left + el.clientWidth / 2,
						y: el.getBoundingClientRect().top + el.clientHeight / 2
					}
				: { x: window.innerWidth / 2, y: window.innerHeight / 2 };
			g.adjustZoomWheel(e.deltaY, focal);
		} else {
			g.applyPanDelta(e.deltaX, e.deltaY);
		}
	}

	async function onPiecePointerDown(piece: PieceInstance, e: PointerEvent) {
		if (replayMode) return;
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
		const me = {
			id: selfUserId,
			name: selfDisplayName,
			color: getLocalPlayerColor()
		};
		const others = $users.map((u) => ({
			id: u.id,
			name: u.name,
			color: $playerColorOverrides[u.id] ?? u.color
		}));
		const roster = [...others, me];
		const order = $playerOrder;
		if (!order.length) return roster.sort((a, b) => a.id.localeCompare(b.id));
		const byId = new Map(roster.map((r) => [r.id, r]));
		const present = new Set(roster.map((r) => r.id));
		const out: typeof roster = [];
		for (const id of order) {
			if (!present.has(id)) continue;
			const r = byId.get(id);
			if (r) out.push(r);
		}
		for (const r of roster) {
			if (!order.includes(r.id)) out.push(r);
		}
		return out;
	})();

	$: zm = $game.zoom;
	$: bgTable = `/data/${$game.curGame}/images/table-bg.jpg`;
	$: viewportCursor = replayMode
		? 'default'
		: $game.spacePanHeld
			? 'grab'
			: $game.handscroll
				? 'grabbing'
				: $game.moveDrag
					? 'move'
					: 'default';
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="viewport"
	class:space-pan={$game.spacePanHeld}
	class:handscroll={$game.handscroll}
	class:replay-mode={replayMode}
	class:dragging-piece={$game.moveDrag != null}
	style:cursor={viewportCursor}
	bind:this={viewportEl}
	onpointerdown={onViewportPointerDown}
>
	<div class="game" class:will-move={$game.handscroll || $game.panPointerStart != null} style:transform="translate3d({$game.panX}px, {$game.panY}px, 0)">
		<div
			class="pieces-layer"
			style:transform="scale({zm})"
			style:transform-origin="0 0"
			onwheel={onWheel}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="table"
				bind:this={tableEl}
				style:width="{$game.table.w}px"
				style:height="{$game.table.h}px"
				style:background-image="url({bgTable})"
				onpointerdown={onTablePointerDown}
			></div>

			<div class="user-stashes">
				{#each stashRoster as user, i (user.id)}
					{@const pos = stashPos(i)}
					{@const isSelf = user.id === selfUserId}
					<div class="stash-slot" style:transform="translate3d({pos.x}px, {pos.y}px, 0)">
						<div
							class="stash footprint"
							class:mine={isSelf}
							class:theirs={!isSelf}
							style:background-color={user.color}
						>
							{#if isSelf}
								<span class="sr-only">Your private area</span>
							{/if}
						</div>
						{#if !isSelf}
							<div class="stash top" style:background-color={user.color}>
								{user.name}
							</div>
							<div class="stash-private-label" aria-hidden="true">PRIVATE</div>
						{/if}
					</div>
				{/each}
			</div>

			{#each $game.pieces as piece (piece.id)}
				<Piece
					{piece}
					curGame={$game.curGame}
					replayMode={replayMode}
					selected={$game.selectedIds.has(piece.id)}
					dragging={$game.moveDrag != null && $game.selectedIds.has(piece.id) && piece.attributes.includes('move')}
					pressing={pressingPieceId === piece.id}
					remoteColor={$game.remoteSelection[piece.id]}
					onpointerdown={(e) => onPiecePointerDown(piece, e)}
					onpiecedblclick={onOpenViewer}
				/>
			{/each}

			{#each [0, 1, 2, 3] as i}
				<div class="textregion" id="textregion_{i}" style:left="{1260 + i * 190}px" style:top="580px">
					<input
						type="text"
						readonly={replayMode}
						tabindex={replayMode ? -1 : 0}
						value={$game.textRegions[`textregion_${i}`] ?? '00'}
						oninput={(e) => {
							if (replayMode) return;
							const v = (e.currentTarget as HTMLInputElement).value;
							g.setTextRegion(`textregion_${i}`, v);
							emit('textregion_change', { winid: `textregion_${i}`, val: v });
						}}
					/>
				</div>
			{/each}

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
		<SelectionBox rect={$game.selectionBox} />
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
	.viewport {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		touch-action: none;
		z-index: 0;
	}
	.viewport.space-pan {
		cursor: grab;
	}
	.viewport.handscroll {
		cursor: grabbing;
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
	.stash.footprint.mine {
		z-index: 0;
		color: #000;
		box-shadow:
			inset 0 0 0 2px rgba(0, 0, 0, 0.2),
			inset 0 6px 28px rgba(0, 0, 0, 0.45),
			inset 0 2px 8px rgba(0, 0, 0, 0.35);
	}
	.stash.footprint.theirs {
		z-index: 0;
		color: #000;
		box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.15);
	}
	.stash.top {
		z-index: 10000;
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
	.textregion {
		position: absolute;
		width: 110px;
		height: 60px;
		z-index: 1000;
		background: #fff;
		box-shadow: 0 0 10px 5px #000;
	}
	.textregion input {
		text-align: center;
		width: 100%;
		font-size: 50px;
		padding: 0;
		margin: 0;
		border: 0;
		height: 100%;
		font-family: inherit;
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
