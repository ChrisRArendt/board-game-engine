<script lang="ts">
	import { browser } from '$app/environment';

	/** Avoid naming this `open` — Svelte 5 can conflict with HTML `open` */
	export let visible = false;
	export let title = '';
	export let requestClose: (() => void) | undefined = undefined;

	let dragging = false;
	let dragY = 0;
	let startY = 0;
	let sheetEl: HTMLDivElement | undefined;
	let reducedMotion = false;

	$: if (browser && typeof matchMedia !== 'undefined') {
		reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	$: if (!visible) {
		dragging = false;
		dragY = 0;
	}

	function onPointerDown(e: PointerEvent) {
		if (e.target !== e.currentTarget && !(e.target as HTMLElement).closest?.('.sheet-handle')) return;
		dragging = true;
		startY = e.clientY;
		dragY = 0;
		(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!visible || !dragging) return;
		dragY = Math.max(0, e.clientY - startY);
	}

	function onPointerUp() {
		if (!dragging) return;
		dragging = false;
		const h = sheetEl?.getBoundingClientRect().height ?? 300;
		if (dragY > h * 0.4) {
			requestClose?.();
		}
		dragY = 0;
	}

	function onScrimClick() {
		requestClose?.();
	}
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={onPointerUp} onpointercancel={onPointerUp} />

{#if visible}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="bottom-sheet-root"
		class:no-motion={reducedMotion}
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) onScrimClick();
		}}
	>
		<div
			class="sheet"
			bind:this={sheetEl}
			style:transform={dragging ? `translateY(${dragY}px)` : undefined}
			style:transition={dragging || reducedMotion ? 'none' : undefined}
			onpointerdown={(e) => e.stopPropagation()}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="sheet-handle"
				onpointerdown={(e) => {
					e.stopPropagation();
					onPointerDown(e);
				}}
			></div>
			<div class="sheet-head">
				<h2 class="sheet-title">{title}</h2>
				<button type="button" class="sheet-close" onclick={() => requestClose?.()} aria-label="Close"
					>×</button
				>
			</div>
			<div class="sheet-body">
				<slot />
			</div>
		</div>
	</div>
{/if}

<style>
	.bottom-sheet-root {
		position: fixed;
		inset: 0;
		z-index: 2000000005;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		pointer-events: auto;
		animation: fadeIn 0.25s ease;
	}
	.bottom-sheet-root.no-motion {
		animation: none;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.sheet {
		width: 100%;
		max-height: 85vh;
		background: #fff;
		border-radius: 12px 12px 0 0;
		box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		animation: slideUp 0.25s ease;
		touch-action: none;
	}
	.no-motion .sheet {
		animation: none;
	}
	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	.sheet-handle {
		width: 36px;
		height: 4px;
		border-radius: 4px;
		background: #cbd5e1;
		margin: 8px auto 4px;
		cursor: grab;
	}
	.sheet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 12px 8px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}
	.sheet-title {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		color: #333;
	}
	.sheet-close {
		all: unset;
		cursor: pointer;
		font-size: 22px;
		line-height: 1;
		padding: 4px 8px;
		color: #666;
		border-radius: 4px;
	}
	.sheet-close:hover {
		background: rgba(0, 0, 0, 0.06);
	}
	.sheet-body {
		overflow: auto;
		padding: 8px;
		flex: 1;
		min-height: 0;
	}
</style>
