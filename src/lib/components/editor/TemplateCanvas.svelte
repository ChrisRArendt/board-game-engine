<script lang="ts">
	import type { CardBackground, CardLayer } from '$lib/editor/types';
	import CardPreview from './CardPreview.svelte';
	import ResizeHandles from './ResizeHandles.svelte';

	export let canvasWidth: number;
	export let canvasHeight: number;
	export let borderRadius: number;
	export let frameBorderWidth = 0;
	export let frameBorderColor = '#000000';
	export let background: CardBackground;
	export let layers: CardLayer[];
	export let selectedId: string | null;
	let zoom = 1;
	export let onCardResize: (next: { w: number; h: number }) => void;
	export let onLayerSelect: (id: string | null) => void;
	export let onLayerMove: (id: string, x: number, y: number) => void;
	export let onLayerResize: (id: string, next: { x: number; y: number; w: number; h: number }) => void;
	export let fieldPreview: Record<string, string> = {};
	export let mediaUrls: Record<string, string> = {};

	let drag: null | { id: string; sx: number; sy: number; ox: number; oy: number } = null;

	function onLayerPointerDown(id: string, e: PointerEvent) {
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
		if (!drag) return;
		const dx = (e.clientX - drag.sx) / zoom;
		const dy = (e.clientY - drag.sy) / zoom;
		onLayerMove(drag.id, drag.ox + dx, drag.oy + dy);
	}

	function endLayer() {
		drag = null;
		window.removeEventListener('pointermove', moveLayer);
		window.removeEventListener('pointerup', endLayer);
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const d = e.deltaY > 0 ? -0.08 : 0.08;
		zoom = Math.min(3, Math.max(0.25, zoom + d));
	}

	$: selectedLayerGeom = selectedId
		? (layers.find((l) => l.id === selectedId) ?? null)
		: null;
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
						{background}
						{layers}
						fieldValues={fieldPreview}
						{mediaUrls}
						displayScale={1}
						showEmptyPlaceholders={true}
					/>
					{#each [...layers].filter((l) => l.visible).sort((a, b) => b.zIndex - a.zIndex) as L (L.id)}
						<button
							type="button"
							class="layer-hit"
							class:sel={selectedId === L.id}
							style:left="{L.x}px"
							style:top="{L.y}px"
							style:width="{L.width}px"
							style:height="{L.height}px"
							style:z-index={L.zIndex + 10}
							aria-label="Layer {L.name}"
							onpointerdown={(e) => onLayerPointerDown(L.id, e)}
						></button>
					{/each}
					{#if selectedLayerGeom && !selectedLayerGeom.locked}
						<div class="layer-resize-layer" aria-hidden="true">
							<ResizeHandles
								x={selectedLayerGeom.x}
								y={selectedLayerGeom.y}
								w={selectedLayerGeom.width}
								h={selectedLayerGeom.height}
								minW={8}
								minH={8}
								zoomScale={zoom}
								onResize={(next) => onLayerResize(selectedLayerGeom!.id, next)}
							/>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
	<div class="zoom-readout">{Math.round(zoom * 100)}%</div>
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
</style>
