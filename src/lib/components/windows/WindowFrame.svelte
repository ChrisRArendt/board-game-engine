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

	function onTitleDown(e: PointerEvent) {
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
		if (browser) {
			const maxW = 520;
			const maxH = Math.min(window.innerHeight - 40, 720);
			nx = Math.max(8, Math.min(window.innerWidth - maxW, nx));
			ny = Math.max(8, Math.min(window.innerHeight - maxH, ny));
		}
		x = nx;
		y = ny;
	}

	function onUp() {
		drag = false;
	}
</script>

<svelte:window onpointermove={onMove} onpointerup={onUp} />

{#if visible}
	<div class="window" style:transform="translate3d({x}px, {y}px, 0)">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="titlebar">
			<ul class="sysbuttons">
				<li>
					<button
						type="button"
						class="close"
						onpointerdown={(e) => {
							e.stopPropagation();
							requestClose?.();
						}}
					>
						x
					</button>
				</li>
				<li class="inactive">_</li>
				<li class="inactive">+</li>
			</ul>
			<p
				class="title"
				onpointerdown={(e) => {
					e.stopPropagation();
					onTitleDown(e);
				}}
			>
				{title}
			</p>
		</div>
		<div class="content">
			<slot />
		</div>
	</div>
{/if}

<style>
	.window {
		position: fixed;
		left: 0;
		top: 0;
		z-index: 1;
		pointer-events: auto;
		box-shadow:
			0 10px 50px 8px rgba(0, 0, 0, 0.2),
			0 30px 50px 0px rgba(0, 0, 0, 0.35),
			0 0 0 1px rgba(0, 0, 0, 0.15);
		border-radius: 4px;
		background: #fff;
		min-width: 200px;
	}
	.titlebar {
		background: linear-gradient(
			to bottom,
			rgba(233, 233, 233, 1) 0%,
			rgba(214, 214, 214, 1) 40%,
			rgba(200, 200, 200, 1) 100%
		);
		border-radius: 4px 4px 0 0;
		position: relative;
	}
	.sysbuttons {
		list-style: none;
		display: inline-block;
		padding-left: 8px;
		margin: 0;
	}
	.sysbuttons li {
		display: inline-block;
		margin: 5px 4px;
		vertical-align: top;
	}
	.sysbuttons li.inactive {
		width: 12px;
		height: 12px;
		font-size: 10px;
		line-height: 10px;
		text-align: center;
		border-radius: 6px;
	}
	.sysbuttons button.close {
		display: inline-block;
		width: 12px;
		height: 12px;
		padding: 0;
		border: none;
		font: inherit;
		font-size: 10px;
		line-height: 10px;
		text-align: center;
		border-radius: 6px;
		cursor: pointer;
	}
	.sysbuttons .close {
		color: #800;
		background: linear-gradient(#e66, #c44);
	}
	.sysbuttons .inactive {
		background: #ccc;
		cursor: default;
	}
	.title {
		position: absolute;
		top: 0;
		right: 0;
		width: calc(100% - 60px);
		text-align: center;
		font-size: 13px;
		line-height: 24px;
		margin: 0;
		color: #393939;
		cursor: move;
		user-select: none;
	}
	.content {
		padding: 6px;
	}
</style>
