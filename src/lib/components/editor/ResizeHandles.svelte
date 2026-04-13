<script lang="ts">
	/** Local coords inside parent (px). */
	export let x = 0;
	export let y = 0;
	export let w = 100;
	export let h = 100;
	/** Minimum width/height during resize (px). */
	export let minW = 20;
	export let minH = 20;
	export let disabled = false;
	/** Divide pointer delta by this (e.g. CSS zoom on parent). */
	export let zoomScale = 1;
	/** Table / anchored rect: only resize from E, S, SE (top-left fixed at origin). */
	export let originLocked = false;
	export let onResize: (next: { x: number; y: number; w: number; h: number }) => void;

	let drag: null | { kind: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } =
		null;

	function start(kind: string, e: PointerEvent) {
		if (disabled) return;
		e.preventDefault();
		e.stopPropagation();
		drag = { kind, sx: e.clientX, sy: e.clientY, ox: x, oy: y, ow: w, oh: h };
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', end);
	}

	function move(e: PointerEvent) {
		if (!drag) return;
		const z = zoomScale || 1;
		const dx = (e.clientX - drag.sx) / z;
		const dy = (e.clientY - drag.sy) / z;
		let nx = drag.ox;
		let ny = drag.oy;
		let nw = drag.ow;
		let nh = drag.oh;
		const k = drag.kind;
		const mw = minW;
		const mh = minH;
		if (originLocked) {
			if (k.includes('e')) nw = Math.max(mw, drag.ow + dx);
			if (k.includes('s')) nh = Math.max(mh, drag.oh + dy);
			nx = 0;
			ny = 0;
		} else {
			if (k.includes('e')) nw = Math.max(mw, drag.ow + dx);
			if (k.includes('w')) {
				nw = Math.max(mw, drag.ow - dx);
				nx = drag.ox + drag.ow - nw;
			}
			if (k.includes('s')) nh = Math.max(mh, drag.oh + dy);
			if (k.includes('n')) {
				nh = Math.max(mh, drag.oh - dy);
				ny = drag.oy + drag.oh - nh;
			}
		}
		onResize({ x: nx, y: ny, w: nw, h: nh });
	}

	function end() {
		drag = null;
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', end);
	}
</script>

<div class="box resize-handles-root" style:left="{x}px" style:top="{y}px" style:width="{w}px" style:height="{h}px">
	{#if !originLocked}
		<button type="button" class="h nw" aria-label="resize nw" onpointerdown={(e) => start('nw', e)}></button>
		<button type="button" class="h n" aria-label="resize n" onpointerdown={(e) => start('n', e)}></button>
		<button type="button" class="h ne" aria-label="resize ne" onpointerdown={(e) => start('ne', e)}></button>
		<button type="button" class="h w" aria-label="resize w" onpointerdown={(e) => start('w', e)}></button>
	{/if}
	<button type="button" class="h e" aria-label="resize e" onpointerdown={(e) => start('e', e)}></button>
	{#if !originLocked}
		<button type="button" class="h sw" aria-label="resize sw" onpointerdown={(e) => start('sw', e)}></button>
	{/if}
	<button type="button" class="h s" aria-label="resize s" onpointerdown={(e) => start('s', e)}></button>
	<button type="button" class="h se" aria-label="resize se" onpointerdown={(e) => start('se', e)}></button>
</div>

<style>
	.box {
		position: absolute;
		pointer-events: none;
		box-sizing: border-box;
		border: 2px solid var(--editor-selection, #3b82f6);
	}
	.h {
		position: absolute;
		width: 10px;
		height: 10px;
		background: #fff;
		border: 1px solid var(--editor-selection, #3b82f6);
		padding: 0;
		pointer-events: auto;
		cursor: nwse-resize;
	}
	.nw {
		left: -5px;
		top: -5px;
		cursor: nwse-resize;
	}
	.n {
		left: 50%;
		top: -5px;
		transform: translateX(-50%);
		cursor: ns-resize;
	}
	.ne {
		right: -5px;
		top: -5px;
		cursor: nesw-resize;
	}
	.w {
		left: -5px;
		top: 50%;
		transform: translateY(-50%);
		cursor: ew-resize;
	}
	.e {
		right: -5px;
		top: 50%;
		transform: translateY(-50%);
		cursor: ew-resize;
	}
	.sw {
		left: -5px;
		bottom: -5px;
		cursor: nesw-resize;
	}
	.s {
		left: 50%;
		bottom: -5px;
		transform: translateX(-50%);
		cursor: ns-resize;
	}
	.se {
		right: -5px;
		bottom: -5px;
		cursor: nwse-resize;
	}
</style>
