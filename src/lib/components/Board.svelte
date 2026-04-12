<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import Piece from './Piece.svelte';
	import SelectionBox from './SelectionBox.svelte';
	import * as g from '$lib/stores/game';
	import { game } from '$lib/stores/game';
	import { zoomLevelToMult } from '$lib/engine/geometry';
	import { users } from '$lib/stores/users';
	import { activeUserId } from '$lib/stores/network';
	import { emit } from '$lib/stores/network';
	import type { PieceInstance } from '$lib/engine/types';

	export let zoomWithScroll = false;
	export let panScreenEdge = false;
	/** Open local card viewer for a piece (not broadcast) */
	export let onOpenViewer: ((pieceId: number) => void) | undefined = undefined;

	let viewportEl: HTMLDivElement | undefined;
	let cameraEl: HTMLDivElement | undefined;
	let mouseEl: HTMLDivElement | undefined;
	let tableEl: HTMLDivElement | undefined;

	let mouseTx = 0;
	let mouseTy = 0;

	let edgeTimer: ReturnType<typeof setInterval> | null = null;

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
		const st = get(game);
		const zm = zoomLevelToMult(st.zoomLevel);
		mouseTx = Math.floor((-st.panX + e.clientX) * (1 / zm));
		mouseTy = Math.floor((-st.panY + e.clientY) * (1 / zm));

		if (st.selectingBox && st.selectionBox) {
			const rects = new Map<number, { x: number; y: number; w: number; h: number }>();
			if (browser) {
				document.querySelectorAll<HTMLElement>('[data-piece-id]').forEach((el) => {
					const id = parseInt(el.dataset.pieceId ?? '', 10);
					if (Number.isNaN(id)) return;
					const r = el.getBoundingClientRect();
					rects.set(id, { x: r.left, y: r.top, w: r.width, h: r.height });
				});
			}
			g.updateSelectionBox(e.clientX, e.clientY, rects);
		}

		const go = { x: st.panX, y: st.panY };
		if (st.moveDrag) {
			g.moveDragTo(e.clientX, e.clientY, go.x, go.y);
			const st2 = get(game);
			for (const p of st2.pieces) {
				if (st2.selectedIds.has(p.id) && p.attributes.includes('move')) {
					emit('piece_move', { id: p.id, x: p.x, y: p.y });
				}
			}
		}

		if (st.panPointerStart) {
			g.movePanPointer(e.clientX, e.clientY);
		}

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

	function onPointerUpGlobal() {
		g.endMoveDrag();
		g.endSelectionBox();
		g.endPanPointer();
	}

	onMount(() => {
		window.addEventListener('pointermove', onPointerMoveGlobal);
		window.addEventListener('pointerup', onPointerUpGlobal);
		edgeTimer = setInterval(() => {
			const st = get(game);
			if (panScreenEdge && (st.edgePan.x !== 0 || st.edgePan.y !== 0)) {
				g.applyEdgePanStep();
			}
		}, 1000 / 30);
	});

	onDestroy(() => {
		if (!browser) return;
		window.removeEventListener('pointermove', onPointerMoveGlobal);
		window.removeEventListener('pointerup', onPointerUpGlobal);
		if (edgeTimer) clearInterval(edgeTimer);
	});

	function onTablePointerDown(e: PointerEvent) {
		if (e.target !== e.currentTarget) return;
		const st = get(game);
		if (st.spacePanHeld) {
			g.startPanPointer(e.clientX, e.clientY);
			return;
		}
		if (st.shiftDown) {
			g.startSelectionBox(e.clientX, e.clientY);
			return;
		}
		g.deselectAll();
		g.startPanPointer(e.clientX, e.clientY);
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const st = get(game);
		if (zoomWithScroll) {
			const el = mouseEl ?? cameraEl;
			const focal = el ? docOffset(el) : { left: 0, top: 0 };
			g.adjustZoom(e.deltaY > 0 ? -1 : 1, focal);
		} else {
			g.applyPanDelta(e.deltaX, e.deltaY);
		}
	}

	async function onPiecePointerDown(piece: PieceInstance, e: PointerEvent) {
		e.stopPropagation();
		const st = get(game);
		if (st.spacePanHeld) {
			g.startPanPointer(e.clientX, e.clientY);
			return;
		}
		if (piece.attributes.includes('select')) {
			g.clickSelect(piece.id, st.shiftDown);
			await tick();
		}
		const st2 = get(game);
		if (piece.attributes.includes('move')) {
			g.startMoveDrag(piece.id, e.clientX, e.clientY, st2.panX, st2.panY);
		}
	}

	function stashCover(user: { id: string }) {
		const id = get(activeUserId);
		if (!id) return false;
		return user.id !== id;
	}

	$: zm = zoomLevelToMult($game.zoomLevel);
	$: bgTable = `/data/${$game.curGame}/images/table-bg.jpg`;
</script>

<div
	class="viewport"
	class:space-pan={$game.spacePanHeld}
	class:handscroll={$game.handscroll}
	bind:this={viewportEl}
>
	<div class="game" style:transform="translate3d({$game.panX}px, {$game.panY}px, 0)">
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
				{#each $users as user, i (user.id + '-' + i)}
					{@const pos = stashPos(i)}
					<div
						class="stash footprint"
						style:transform="translate3d({pos.x}px, {pos.y}px, 0)"
						style:background-color={user.color}
					>
						Your Stash
					</div>
					{#if stashCover(user)}
						<div
							class="stash top"
							style:transform="translate3d({pos.x}px, {pos.y}px, 0)"
							style:background-color={user.color}
						>
							{user.name}
						</div>
					{/if}
				{/each}
			</div>

			{#each $game.pieces as piece (piece.id)}
				<Piece
					{piece}
					curGame={$game.curGame}
					selected={$game.selectedIds.has(piece.id)}
					remoteColor={$game.remoteSelection[piece.id]}
					onpointerdown={(e) => onPiecePointerDown(piece, e)}
					onpiecedblclick={onOpenViewer}
				/>
			{/each}

			{#each [0, 1, 2, 3] as i}
				<div class="textregion" id="textregion_{i}" style:left="{1260 + i * 190}px" style:top="580px">
					<input
						type="text"
						value={$game.textRegions[`textregion_${i}`] ?? '00'}
						oninput={(e) => {
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
</div>

<style>
	.viewport {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		/* 0: stay above <main> hit-testing; toolbar / user list use much higher z-index */
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
	.stash {
		position: absolute;
		width: 700px;
		height: 600px;
		font-size: 40px;
		line-height: 50px;
		text-align: center;
		pointer-events: none;
	}
	.stash.footprint {
		z-index: 0;
		color: #000;
		box-shadow: inset 0 3px 10px #000;
	}
	.stash.top {
		z-index: 10000;
		color: #fff;
		box-shadow: 0 3px 10px #000;
		text-shadow: 0 1px 5px rgb(0 0 0);
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
</style>
