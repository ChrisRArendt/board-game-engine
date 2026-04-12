<script lang="ts">
	export let title = '';
	export let open = true;
	export let onclose: (() => void) | undefined = undefined;

	let x = 300;
	let y = 190;
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
		x = ox + (e.clientX - sx);
		y = oy + (e.clientY - sy);
	}

	function onUp() {
		drag = false;
	}
</script>

<svelte:window on:pointermove={onMove} on:pointerup={onUp} />

{#if open}
	<div class="window" style:transform="translate3d({x}px, {y}px, 0)">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="titlebar">
			<ul class="sysbuttons">
				<li>
					<button
						type="button"
						class="close"
						on:pointerdown|stopPropagation={() => onclose?.()}
					>
						x
					</button>
				</li>
				<li class="inactive">_</li>
				<li class="inactive">+</li>
			</ul>
			<p class="title" on:pointerdown|stopPropagation={onTitleDown}>{title}</p>
		</div>
		<div class="content">
			<slot />
		</div>
	</div>
{/if}

<style>
	.window {
		position: fixed;
		z-index: 2000000002;
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
