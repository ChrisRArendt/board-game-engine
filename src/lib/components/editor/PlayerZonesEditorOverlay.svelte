<script lang="ts">
	import { get } from 'svelte/store';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import type { Rect } from '$lib/engine/geometry';
	import ResizeHandles from '$lib/components/editor/ResizeHandles.svelte';
	import { playerSlotColor } from '$lib/engine/stash';

	function topStackZ(pieces: { zIndex: number }[], widgets: { zIndex: number }[]): number {
		let m = 0;
		for (const p of pieces) m = Math.max(m, p.zIndex);
		for (const w of widgets) m = Math.max(m, w.zIndex);
		return m;
	}

	/** Divide pointer delta by board zoom (same as pieces layer). */
	export let zoomScale = 1;
	export let onEdited: (() => void) | undefined = undefined;

	function hexToRgba(hex: string, alpha: number): string {
		const h = hex.replace('#', '');
		if (h.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
		const r = parseInt(h.slice(0, 2), 16);
		const gch = parseInt(h.slice(2, 4), 16);
		const b = parseInt(h.slice(4, 6), 16);
		return `rgba(${r},${gch},${b},${alpha})`;
	}

	function patchSlot(
		slotIndex: number,
		which: 'safe' | 'deal',
		r: Rect,
		opts?: { skipHistory?: boolean }
	) {
		const slots = get(game).playerSlots;
		if (!slots || !slots[slotIndex]) return;
		const next = slots.map((z, j) =>
			j === slotIndex ? { ...z, [which]: { x: r.x, y: r.y, w: r.w, h: r.h } } : z
		);
		g.setPlayerSlots(next);
		if (!opts?.skipHistory) onEdited?.();
	}

	function onResizeSlot(
		slotIndex: number,
		which: 'safe' | 'deal',
		next: { x: number; y: number; w: number; h: number }
	) {
		const slots = get(game).playerSlots;
		if (!slots || !slots[slotIndex]) return;
		const cur = slots[slotIndex][which];
		patchSlot(
			slotIndex,
			which,
			{
				x: cur.x + next.x,
				y: cur.y + next.y,
				w: next.w,
				h: next.h
			},
			{ skipHistory: true }
		);
	}

	let moveDrag: {
		slotIndex: number;
		which: 'safe' | 'deal';
		sx: number;
		sy: number;
		ox: number;
		oy: number;
	} | null = null;

	function startMove(slotIndex: number, which: 'safe' | 'deal', cur: Rect, e: PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
		moveDrag = {
			slotIndex,
			which,
			sx: e.clientX,
			sy: e.clientY,
			ox: cur.x,
			oy: cur.y
		};
		window.addEventListener('pointermove', onMoveDrag);
		window.addEventListener('pointerup', endMoveDrag);
	}

	function onMoveDrag(e: PointerEvent) {
		const d = moveDrag;
		if (!d) return;
		const z = zoomScale || 1;
		const dx = (e.clientX - d.sx) / z;
		const dy = (e.clientY - d.sy) / z;
		const slots = get(game).playerSlots;
		if (!slots) return;
		const cur = slots[d.slotIndex][d.which];
		patchSlot(
			d.slotIndex,
			d.which,
			{
				...cur,
				x: d.ox + dx,
				y: d.oy + dy
			},
			{ skipHistory: true }
		);
	}

	function endMoveDrag() {
		const had = moveDrag !== null;
		moveDrag = null;
		window.removeEventListener('pointermove', onMoveDrag);
		window.removeEventListener('pointerup', endMoveDrag);
		if (had) onEdited?.();
	}
</script>

{#if $game.playerSlots}
	<div
		class="player-zones-edit-root"
		aria-hidden="true"
		style:z-index={Math.max(999990, topStackZ($game.pieces, $game.widgets) + 2)}
	>
		{#each $game.playerSlots as z, slotIndex (slotIndex)}
			{@const color = playerSlotColor(slotIndex)}
			{@const fillSafe = hexToRgba(color, 0.14)}
			{@const fillDeal = hexToRgba(color, 0.22)}
			<!-- Safe -->
			<div
				class="zone-anchor"
				style:left="{z.safe.x}px"
				style:top="{z.safe.y}px"
				style:width="{z.safe.w}px"
				style:height="{z.safe.h}px"
				style:--slot-accent={color}
			>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="zone-drag"
					class:safe={true}
					style:background={fillSafe}
					style:border-color={color}
					title="Drag to move safe zone (player {slotIndex + 1})"
					onpointerdown={(e) => startMove(slotIndex, 'safe', z.safe, e)}
				>
					<span class="tag" style:color={color}>Safe {slotIndex + 1}</span>
				</div>
				<ResizeHandles
					x={0}
					y={0}
					w={z.safe.w}
					h={z.safe.h}
					minW={48}
					minH={48}
					zoomScale={zoomScale}
					onResize={(next) => onResizeSlot(slotIndex, 'safe', next)}
					onResizeEnd={() => onEdited?.()}
				/>
			</div>
			<!-- Deal -->
			<div
				class="zone-anchor"
				style:left="{z.deal.x}px"
				style:top="{z.deal.y}px"
				style:width="{z.deal.w}px"
				style:height="{z.deal.h}px"
				style:--slot-accent={color}
			>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="zone-drag"
					class:deal={true}
					style:background={fillDeal}
					style:border-color={color}
					title="Drag to move deal zone (player {slotIndex + 1})"
					onpointerdown={(e) => startMove(slotIndex, 'deal', z.deal, e)}
				>
					<span class="tag" style:color={color}>Deal {slotIndex + 1}</span>
				</div>
				<ResizeHandles
					x={0}
					y={0}
					w={z.deal.w}
					h={z.deal.h}
					minW={48}
					minH={48}
					zoomScale={zoomScale}
					onResize={(next) => onResizeSlot(slotIndex, 'deal', next)}
					onResizeEnd={() => onEdited?.()}
				/>
			</div>
		{/each}
	</div>
{/if}

<style>
	.player-zones-edit-root {
		position: absolute;
		inset: 0;
		pointer-events: none;
		/* z-index set inline so zones stay above the highest piece/widget */
	}
	.zone-anchor {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: none;
		box-sizing: border-box;
	}
	.zone-drag {
		position: absolute;
		inset: 0;
		pointer-events: auto;
		cursor: move;
		border: 2px dashed var(--slot-accent, #64748b);
		border-radius: 6px;
		box-sizing: border-box;
	}
	.zone-drag.safe {
		border-style: solid;
		border-width: 2px;
		opacity: 0.98;
	}
	.zone-drag.deal {
		border-style: dashed;
	}
	.tag {
		position: absolute;
		left: 6px;
		top: 4px;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.02em;
		text-shadow:
			0 0 6px rgba(0, 0, 0, 0.85),
			0 1px 2px rgba(0, 0, 0, 0.9);
		pointer-events: none;
	}
	/* ResizeHandles use --editor-selection; match slot color */
	.zone-anchor :global(.box) {
		--editor-selection: var(--slot-accent, #3b82f6);
		border-color: var(--slot-accent, #3b82f6);
	}
	.zone-anchor :global(.h) {
		border-color: var(--slot-accent, #3b82f6);
	}
</style>
