<script lang="ts">
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';

	export let viewportW: number;
	export let viewportH: number;

	let dragging = false;
	/** Minimap root; `pointermove` is on `window`, so we cannot use `event.currentTarget` in `jumpTo`. */
	let mmRoot: HTMLDivElement | undefined;

	$: tw = $game.table.w;
	$: th = $game.table.h;
	$: z = $game.zoom;
	$: panX = $game.panX;
	$: panY = $game.panY;

	// World rect visible in viewport (approx)
	$: wx0 = (-panX) / z;
	$: wy0 = (-panY) / z;
	$: wx1 = (viewportW - panX) / z;
	$: wy1 = (viewportH - panY) / z;

	const mmW = 140;
	const mmH = 100;
	const pad = 4;

	$: sx = (mmW - pad * 2) / tw;
	$: sy = (mmH - pad * 2) / th;
	$: s = Math.min(sx, sy);

	$: ox = pad + (mmW - pad * 2 - tw * s) / 2;
	$: oy = pad + (mmH - pad * 2 - th * s) / 2;

	function worldToMm(x: number, y: number) {
		return { x: ox + x * s, y: oy + y * s };
	}

	$: vpRect = {
		x: ox + wx0 * s,
		y: oy + wy0 * s,
		w: Math.max(2, (wx1 - wx0) * s),
		h: Math.max(2, (wy1 - wy0) * s)
	};

	$: show = z > 0.35 && (wx1 - wx0 < tw * 0.98 || wy1 - wy0 < th * 0.98);

	function onMmPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		dragging = true;
		jumpTo(e);
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	function onMove(e: PointerEvent) {
		if (!dragging) return;
		jumpTo(e);
	}

	function onUp() {
		dragging = false;
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
	}

	function jumpTo(e: PointerEvent) {
		const el = mmRoot;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const mx = e.clientX - r.left;
		const my = e.clientY - r.top;
		const wx = (mx - ox) / s;
		const wy = (my - oy) / s;
		const cx = (wx0 + wx1) / 2;
		const cy = (wy0 + wy1) / 2;
		const ddx = wx - cx;
		const ddy = wy - cy;
		g.game.update((st) => ({
			...st,
			panX: st.panX - ddx * st.zoom,
			panY: st.panY - ddy * st.zoom
		}));
		g.centerCamToVP();
	}
</script>

{#if show && tw > 0 && th > 0 && viewportW > 0}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={mmRoot}
		class="minimap"
		style:width="{mmW}px"
		style:height="{mmH}px"
		onpointerdown={onMmPointerDown}
		role="presentation"
	>
		<svg width={mmW} height={mmH} aria-hidden="true">
			<rect x={ox} y={oy} width={tw * s} height={th * s} fill="rgba(34,197,94,0.25)" stroke="rgba(255,255,255,0.3)" />
			{#each $game.pieces as p (p.id)}
				{#if !p.hidden}
					{@const a = worldToMm(p.x, p.y)}
					<rect
						x={a.x}
						y={a.y}
						width={Math.max(1, p.initial_size.w * s)}
						height={Math.max(1, p.initial_size.h * s)}
						fill="rgba(59,130,246,0.35)"
					/>
				{/if}
			{/each}
			<rect
				x={vpRect.x}
				y={vpRect.y}
				width={vpRect.w}
				height={vpRect.h}
				fill="none"
				stroke="rgba(255,255,255,0.85)"
				stroke-width="1.5"
			/>
		</svg>
	</div>
{/if}

<style>
	.minimap {
		position: absolute;
		right: 56px;
		bottom: 48px;
		z-index: 50;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: rgba(15, 23, 42, 0.85);
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	}
</style>
