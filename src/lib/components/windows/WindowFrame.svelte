<script lang="ts">
	import { browser } from '$app/environment';

	export let title = '';
	/** Avoid naming this `open` — in Svelte 5 it can conflict with the HTML `open` attribute / boolean prop handling. */
	export let visible = false;
	/** Do not name this `onClose` — Svelte 5 treats `on` + PascalCase props as event/callback wiring and it can conflict. */
	export let requestClose: (() => void) | undefined = undefined;

	let x = 120;
	let y = 36;
	let drag = false;
	let sx = 0;
	let sy = 0;
	let ox = 0;
	let oy = 0;

	/** Collapse content to title bar only. */
	let minimized = false;
	/** Fill the viewport (minus small inset). */
	let maximized = false;
	let savedX = 120;
	let savedY = 36;

	let windowEl: HTMLDivElement | undefined;

	$: if (!visible) {
		minimized = false;
		maximized = false;
	}

	function clampDragPos(nx: number, ny: number): { nx: number; ny: number } {
		if (!browser) return { nx, ny };
		const w = windowEl?.getBoundingClientRect().width ?? 400;
		const h = windowEl?.getBoundingClientRect().height ?? 200;
		const maxX = Math.max(8, window.innerWidth - w - 8);
		const maxY = Math.max(8, window.innerHeight - h - 8);
		return {
			nx: Math.max(8, Math.min(maxX, nx)),
			ny: Math.max(8, Math.min(maxY, ny))
		};
	}

	function onTitleDown(e: PointerEvent) {
		if (maximized && windowEl) {
			const rect = windowEl.getBoundingClientRect();
			maximized = false;
			x = e.clientX - rect.width / 2;
			y = e.clientY - 14;
			const c = clampDragPos(x, y);
			x = c.nx;
			y = c.ny;
		}
		drag = true;
		sx = e.clientX;
		sy = e.clientY;
		ox = x;
		oy = y;
	}

	function onMove(e: PointerEvent) {
		if (!drag) return;
		let nx = ox + (e.clientX - sx);
		let ny = oy + (e.clientY - sy);
		const c = clampDragPos(nx, ny);
		x = c.nx;
		y = c.ny;
	}

	function onUp() {
		drag = false;
	}

	function onClose(e: PointerEvent) {
		e.stopPropagation();
		requestClose?.();
	}

	function onMinimize(e: PointerEvent) {
		e.stopPropagation();
		if (maximized) {
			maximized = false;
			x = savedX;
			y = savedY;
		}
		minimized = !minimized;
	}

	function onMaximize(e: PointerEvent) {
		e.stopPropagation();
		if (minimized) {
			minimized = false;
		}
		if (!maximized) {
			savedX = x;
			savedY = y;
			maximized = true;
		} else {
			maximized = false;
			x = savedX;
			y = savedY;
			const c = clampDragPos(x, y);
			x = c.nx;
			y = c.ny;
		}
	}
</script>

<svelte:window onpointermove={onMove} onpointerup={onUp} />

{#if visible}
	<div
		bind:this={windowEl}
		class="window"
		class:maximized
		class:minimized
		style:transform={maximized ? undefined : `translate3d(${x}px, ${y}px, 0)`}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="titlebar">
			<div class="titlebar-left">
				<button type="button" class="traffic close" aria-label="Close" onpointerdown={onClose}>
					×
				</button>
				<button type="button" class="traffic minimize" aria-label="Minimize" onpointerdown={onMinimize}>
					−
				</button>
				<button type="button" class="traffic maximize" aria-label="Maximize" onpointerdown={onMaximize}>
					+
				</button>
			</div>
			<p
				class="title"
				onpointerdown={(e) => {
					e.stopPropagation();
					onTitleDown(e);
				}}
			>
				{title}
			</p>
			<div class="titlebar-spacer" aria-hidden="true"></div>
		</div>
		<div class="content" class:content-hidden={minimized}>
			<slot />
		</div>
	</div>
{/if}

<style>
	.window {
		position: fixed;
		left: 0;
		top: 0;
		z-index: 120;
		pointer-events: auto;
		box-shadow: var(--shadow-lg);
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-window-bg);
		min-width: 200px;
		max-width: 100vw;
	}
	.window.maximized {
		left: 0;
		top: 0;
		width: 100vw;
		height: 100vh;
		max-height: 100vh;
		border-radius: 0;
		z-index: 9998;
		display: flex;
		flex-direction: column;
	}
	.window.maximized .content {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
	.window.minimized:not(.maximized) {
		width: min(420px, 100vw);
	}
	.titlebar {
		display: grid;
		grid-template-columns: minmax(120px, 1fr) minmax(0, 2.5fr) minmax(120px, 1fr);
		align-items: center;
		min-height: 46px;
		padding: 0 10px;
		box-sizing: border-box;
		background: linear-gradient(
			to bottom,
			var(--color-window-titlebar-start),
			var(--color-window-titlebar-end)
		);
		border-radius: 6px 6px 0 0;
		position: relative;
		flex-shrink: 0;
	}
	.window.maximized .titlebar {
		border-radius: 0;
	}
	.titlebar-left {
		grid-column: 1;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 8px;
	}
	.title {
		grid-column: 2;
		margin: 0;
		text-align: center;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.2;
		color: var(--color-window-title);
		cursor: move;
		user-select: none;
		padding: 4px 0;
	}
	.titlebar-spacer {
		grid-column: 3;
	}
	.traffic {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: none;
		border-radius: 50%;
		font-size: 15px;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: inset 0 -1px 1px rgba(0, 0, 0, 0.2);
		transition:
			transform 0.08s ease,
			filter 0.08s ease;
	}
	.traffic:hover {
		filter: brightness(1.08);
	}
	.traffic:active {
		transform: scale(0.94);
	}
	.traffic.close {
		color: #5c0a0a;
		background: linear-gradient(180deg, #ff6961, #e54b42);
	}
	.traffic.minimize {
		color: #5c3d00;
		background: linear-gradient(180deg, #ffcc4d, #e6a819);
	}
	.traffic.maximize {
		color: #0d3d1a;
		background: linear-gradient(180deg, #5bd37a, #2fa84a);
	}
	.content {
		padding: 6px;
	}
	.content.content-hidden {
		display: none;
	}
</style>
