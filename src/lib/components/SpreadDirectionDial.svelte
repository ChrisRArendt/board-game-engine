<script lang="ts">
	/**
	 * 16-way direction picker for linear spread (`spreadCustom` + Arrange → Spread).
	 * Engine angles (same as Math.cos/sin in screen space, +y down): 0° = east, 90° = south, 270° = north.
	 * Top of the circle = 270° (spread “up” on the table).
	 * Click or click-drag on the dial to pick; arrow keys nudge when focused.
	 */
	import {
		SPREAD_ANGLE_STEP_DEG,
		SPREAD_DIRECTION_COUNT,
		snapSpreadAngleDeg
	} from '$lib/stores/arrangementPrefs';

	export let spreadAngleDeg = 0;
	export let compact = false;
	export let onSelect: (deg: number) => void;

	const viewSize = 96;
	const cx = 48;
	const cy = 48;
	const rOuter = 40;
	const rInner = 14;
	const tickR1 = 32;
	const tickR2 = 38;

	let svgEl: SVGSVGElement | undefined;
	let dragging = false;

	$: active = snapSpreadAngleDeg(spreadAngleDeg);

	function outerPoint(degEngine: number) {
		const rad = (degEngine * Math.PI) / 180;
		return { x: cx + rOuter * Math.cos(rad), y: cy + rOuter * Math.sin(rad) };
	}

	/** Triangular wedge from center (no SVG arc math; matches engine angles). */
	function sectorPath(i: number): string {
		const a0 = (i - 0.5) * SPREAD_ANGLE_STEP_DEG;
		const a1 = (i + 0.5) * SPREAD_ANGLE_STEP_DEG;
		const p0 = outerPoint(a0);
		const p1 = outerPoint(a1);
		return `M ${cx} ${cy} L ${p0.x} ${p0.y} L ${p1.x} ${p1.y} Z`;
	}

	function clientToSnappedDeg(clientX: number, clientY: number): number {
		if (!svgEl) return active;
		const rect = svgEl.getBoundingClientRect();
		if (rect.width < 1 || rect.height < 1) return active;
		const mx = ((clientX - rect.left) / rect.width) * viewSize;
		const my = ((clientY - rect.top) / rect.height) * viewSize;
		const dx = mx - cx;
		const dy = my - cy;
		let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
		if (deg < 0) deg += 360;
		return snapSpreadAngleDeg(deg);
	}

	function onSvgPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		dragging = true;
		try {
			(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
		onSelect(clientToSnappedDeg(e.clientX, e.clientY));
	}

	function onSvgPointerMove(e: PointerEvent) {
		if (!dragging) return;
		onSelect(clientToSnappedDeg(e.clientX, e.clientY));
	}

	function onSvgPointerEnd(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		try {
			(e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
	}

	function onSvgKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
			e.preventDefault();
			onSelect(snapSpreadAngleDeg(active - SPREAD_ANGLE_STEP_DEG));
		} else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
			e.preventDefault();
			onSelect(snapSpreadAngleDeg(active + SPREAD_ANGLE_STEP_DEG));
		}
	}
</script>

<div class="spread-dial" class:compact role="group" aria-label="Spread direction">
	<span class="dial-label">Spread direction</span>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<svg
		bind:this={svgEl}
		class="dial-svg"
		viewBox="0 0 {viewSize} {viewSize}"
		width={compact ? 88 : viewSize}
		height={compact ? 88 : viewSize}
		role="slider"
		tabindex="0"
		aria-valuemin={0}
		aria-valuemax={337.5}
		aria-valuenow={active}
		aria-label="Spread direction in degrees, click or drag"
		on:pointerdown={onSvgPointerDown}
		on:pointermove={onSvgPointerMove}
		on:pointerup={onSvgPointerEnd}
		on:pointercancel={onSvgPointerEnd}
		on:keydown={onSvgKeydown}
	>
		{#each Array.from({ length: SPREAD_DIRECTION_COUNT }, (_, i) => i) as i (i)}
			<path
				class="sector"
				class:active={active === i * SPREAD_ANGLE_STEP_DEG}
				d={sectorPath(i)}
				aria-hidden="true"
			/>
		{/each}
		{#each Array.from({ length: SPREAD_DIRECTION_COUNT }, (_, i) => i) as i (i)}
			{@const deg = i * SPREAD_ANGLE_STEP_DEG}
			{@const rad = (deg * Math.PI) / 180}
			{@const x1 = cx + tickR1 * Math.cos(rad)}
			{@const y1 = cy + tickR1 * Math.sin(rad)}
			{@const x2 = cx + tickR2 * Math.cos(rad)}
			{@const y2 = cy + tickR2 * Math.sin(rad)}
			<line class="tick-mark" {x1} {y1} {x2} {y2} />
		{/each}
		<circle class="inner-ring" cx={cx} cy={cy} r={rInner} fill="var(--color-surface, #1a1d26)" />
	</svg>
</div>

<style>
	.spread-dial {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.spread-dial.compact {
		gap: 4px;
	}
	.dial-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		align-self: stretch;
	}
	.compact .dial-label {
		font-size: 9px;
	}
	.dial-svg {
		display: block;
		color: var(--color-text-muted);
		cursor: pointer;
		touch-action: none;
		border-radius: 50%;
		outline: none;
	}
	.dial-svg:focus-visible {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent, #3b82f6) 65%, transparent);
		border-radius: 50%;
	}
	.sector {
		fill: color-mix(in srgb, var(--color-text-muted) 6%, transparent);
		stroke: color-mix(in srgb, var(--color-border) 80%, transparent);
		stroke-width: 0.5;
		pointer-events: none;
		transition:
			fill 120ms ease,
			filter 120ms ease;
	}
	.dial-svg:hover .sector:not(.active) {
		fill: color-mix(in srgb, var(--color-accent, #3b82f6) 14%, transparent);
	}
	.sector.active {
		fill: color-mix(in srgb, var(--color-accent, #3b82f6) 52%, transparent);
		stroke: transparent;
		filter: brightness(1.08);
	}
	.inner-ring {
		stroke: var(--color-border);
		stroke-width: 1;
		pointer-events: none;
	}
	.tick-mark {
		stroke: var(--color-text-muted);
		stroke-width: 1.25;
		stroke-linecap: round;
		opacity: 0.55;
		pointer-events: none;
	}
</style>
