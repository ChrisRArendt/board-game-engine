<script lang="ts">
	import type { CardBackground, CardLayer } from '$lib/editor/types';
	import {
		buildSnapTargets,
		snapResizeRect,
		snapThresholdCardPx,
		snapTranslate,
		type SnapGuides
	} from '$lib/editor/snapGeometry';
	import CardPreview from './CardPreview.svelte';
	import ResizeHandles from './ResizeHandles.svelte';

	export let canvasWidth: number;
	export let canvasHeight: number;
	export let borderRadius: number;
	export let frameBorderWidth = 0;
	export let frameBorderColor = '#000000';
	/** null = auto (outer radius − frame width) */
	export let frameInnerRadius: number | null = null;
	export let background: CardBackground;
	export let layers: CardLayer[];
	export let selectedId: string | null;
	let zoom = 1;
	export let onCardResize: (next: { w: number; h: number }) => void;
	export let onLayerSelect: (id: string | null) => void;
	export let onLayerMove: (id: string, x: number, y: number) => void;
	export let onLayerResize: (id: string, next: { x: number; y: number; w: number; h: number }) => void;
	export let onLayerContextMenu: ((id: string, e: MouseEvent) => void) | undefined = undefined;
	export let fieldPreview: Record<string, string> = {};
	export let mediaUrls: Record<string, string> = {};

	const SNAP_SCREEN_PX = 8;
	const EMPTY_GUIDES: SnapGuides = { verticals: [], horizontals: [] };

	let guides: SnapGuides = { verticals: [], horizontals: [] };

	let drag: null | { id: string; sx: number; sy: number; ox: number; oy: number } = null;

	function snapThreshold(): number {
		return snapThresholdCardPx(SNAP_SCREEN_PX, zoom);
	}

	function onLayerPointerDown(id: string, e: PointerEvent) {
		if (e.button !== 0) return;
		const L = layers.find((l) => l.id === id);
		if (!L) return;
		e.preventDefault();
		e.stopPropagation();
		onLayerSelect(id);
		if (L.locked) return;
		drag = { id, sx: e.clientX, sy: e.clientY, ox: L.x, oy: L.y };
		window.addEventListener('pointermove', moveLayer);
		window.addEventListener('pointerup', endLayer);
	}

	function onHitBackgroundClick(e: MouseEvent) {
		const t = e.target as HTMLElement | null;
		if (t?.closest?.('.layer-hit')) return;
		if (t?.closest?.('.resize-handles-root')) return;
		onLayerSelect(null);
	}

	function moveLayer(e: PointerEvent) {
		const d = drag;
		if (!d) return;
		const dx = (e.clientX - d.sx) / zoom;
		const dy = (e.clientY - d.sy) / zoom;
		const nx = d.ox + dx;
		const ny = d.oy + dy;
		const L = layers.find((l) => l.id === d.id);
		if (!L) return;
		if (e.altKey) {
			guides = { verticals: [], horizontals: [] };
			onLayerMove(d.id, nx, ny);
			return;
		}
		const { x: tx, y: ty } = buildSnapTargets(contentW, contentH, layers, d.id);
		const snapped = snapTranslate(nx, ny, L.width, L.height, tx, ty, snapThreshold());
		guides = snapped.guides;
		onLayerMove(d.id, snapped.x, snapped.y);
	}

	function endLayer() {
		drag = null;
		guides = EMPTY_GUIDES;
		window.removeEventListener('pointermove', moveLayer);
		window.removeEventListener('pointerup', endLayer);
	}

	function onLayerResizeSnapped(
		id: string,
		next: { x: number; y: number; w: number; h: number },
		kind: string,
		e: PointerEvent
	) {
		/* ResizeHandles x/y are in overlay space (frameInset + content); layer data + snap are content space. */
		const fx = frameInset;
		const contentRect = {
			x: next.x - fx,
			y: next.y - fx,
			w: next.w,
			h: next.h
		};
		if (e.altKey) {
			guides = { verticals: [], horizontals: [] };
			onLayerResize(id, contentRect);
			return;
		}
		const { x: tx, y: ty } = buildSnapTargets(contentW, contentH, layers, id);
		const snapped = snapResizeRect(kind, contentRect, 8, 8, tx, ty, snapThreshold());
		guides = snapped.guides;
		onLayerResize(id, { x: snapped.x, y: snapped.y, w: snapped.w, h: snapped.h });
	}

	function clearSnapGuides() {
		guides = EMPTY_GUIDES;
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const d = e.deltaY > 0 ? -0.08 : 0.08;
		zoom = Math.min(3, Math.max(0.25, zoom + d));
	}

	$: selectedLayerGeom = selectedId
		? (layers.find((l) => l.id === selectedId) ?? null)
		: null;

	/** Layers live in the card-face *content* box; the frame border is drawn inside W×H (border-box), so overlays must match CardPreview's inset. */
	$: frameInset = Math.max(0, frameBorderWidth ?? 0);
	$: contentW = Math.max(0, canvasWidth - 2 * frameInset);
	$: contentH = Math.max(0, canvasHeight - 2 * frameInset);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="viewport" onwheel={onWheel}>
	<div class="center">
		<div class="scaled" style:transform="scale({zoom})">
			<div class="card-wrap">
				<ResizeHandles
					x={0}
					y={0}
					w={canvasWidth}
					h={canvasHeight}
					zoomScale={zoom}
					onResize={(r) => onCardResize({ w: r.w, h: r.h })}
				/>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="hit"
					role="application"
					style:width="{canvasWidth}px"
					style:height="{canvasHeight}px"
					onclick={onHitBackgroundClick}
				>
					<CardPreview
						width={canvasWidth}
						height={canvasHeight}
						borderRadius={borderRadius}
						frameBorderWidth={frameBorderWidth}
						frameBorderColor={frameBorderColor}
						frameInnerRadius={frameInnerRadius}
						{background}
						{layers}
						fieldValues={fieldPreview}
						{mediaUrls}
						displayScale={1}
						showEmptyPlaceholders={true}
					/>
					{#if guides.verticals.length > 0 || guides.horizontals.length > 0}
						<svg
							class="snap-guides"
							width={canvasWidth}
							height={canvasHeight}
							aria-hidden="true"
						>
							{#each guides.verticals as vx}
								<line
									x1={frameInset + vx}
									y1={0}
									x2={frameInset + vx}
									y2={canvasHeight}
									class="snap-line"
								/>
							{/each}
							{#each guides.horizontals as hy}
								<line
									x1={0}
									y1={frameInset + hy}
									x2={canvasWidth}
									y2={frameInset + hy}
									class="snap-line"
								/>
							{/each}
						</svg>
					{/if}
					{#each [...layers].filter((l) => l.visible).sort((a, b) => b.zIndex - a.zIndex) as L (L.id)}
						<button
							type="button"
							class="layer-hit"
							class:sel={selectedId === L.id}
							style:left="{frameInset + L.x}px"
							style:top="{frameInset + L.y}px"
							style:width="{L.width}px"
							style:height="{L.height}px"
							style:z-index={L.zIndex + 10}
							aria-label="Layer {L.name}"
							onpointerdown={(e) => onLayerPointerDown(L.id, e)}
							oncontextmenu={(e) => {
								e.preventDefault();
								onLayerContextMenu?.(L.id, e);
							}}
						></button>
					{/each}
					{#if selectedLayerGeom && !selectedLayerGeom.locked}
						<div class="layer-resize-layer" aria-hidden="true">
							<ResizeHandles
								x={frameInset + selectedLayerGeom.x}
								y={frameInset + selectedLayerGeom.y}
								w={selectedLayerGeom.width}
								h={selectedLayerGeom.height}
								minW={8}
								minH={8}
								zoomScale={zoom}
								onResize={(next, kind, e) =>
									onLayerResizeSnapped(selectedLayerGeom!.id, next, kind, e)}
								onResizeEnd={clearSnapGuides}
							/>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
	<div class="zoom-readout" title="Hold Alt while dragging or resizing to disable snap">
		{Math.round(zoom * 100)}% · Alt disables snap
	</div>
</div>

<style>
	.viewport {
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0d0d12;
		position: relative;
	}
	.center {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.scaled {
		transform-origin: center center;
	}
	.card-wrap {
		position: relative;
	}
	.hit {
		position: relative;
		border-radius: 8px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.45);
	}
	.layer-hit {
		position: absolute;
		padding: 0;
		margin: 0;
		border: 1px dashed rgba(255, 255, 255, 0.14);
		background: transparent;
		cursor: grab;
		pointer-events: auto;
	}
	.layer-hit.sel {
		border-color: rgba(59, 130, 246, 0.45);
		background: rgba(59, 130, 246, 0.08);
	}
	.layer-resize-layer {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 99998;
	}
	.layer-resize-layer :global(.box) {
		pointer-events: none;
	}
	.layer-resize-layer :global(.h) {
		pointer-events: auto;
	}
	.zoom-readout {
		position: absolute;
		bottom: 12px;
		right: 12px;
		font-size: 12px;
		color: #aaa;
	}
	.snap-guides {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 99990;
		pointer-events: none;
		overflow: visible;
	}
	.snap-line {
		stroke: rgba(236, 72, 153, 0.9);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
</style>
