<script lang="ts">
	import { tick } from 'svelte';
	import { hexForColorInput, normalizeHex } from '$lib/editor/colorUtils';

	export let value = '#ffffff';
	export let onValueChange: ((v: string) => void) | undefined = undefined;

	/** Game palette swatches; optional `onPaletteChange`. */
	export let palette: string[] | undefined = undefined;
	export let onPaletteChange: ((next: string[]) => void) | undefined = undefined;

	export let resetLabel: string | undefined = undefined;
	export let onReset: (() => void) | undefined = undefined;

	/** Accessible name for the swatch trigger (popover still says “Color”). */
	export let ariaLabel = 'Choose color';

	let open = false;
	let triggerEl: HTMLButtonElement;
	let popEl: HTMLDivElement;
	let hexText = '';
	/** Last color emitted while this dialog is open; flushed to the palette once on close. */
	let sessionColorHex = '';

	$: if (!open) hexText = normalizeHex(value || '#ffffff');

	function addToPalette(hex: string) {
		if (!palette || !onPaletteChange) return;
		const n = normalizeHex(hex);
		if (!/^#[0-9a-f]{6}$/.test(n)) return;
		const key = n.toLowerCase();
		if (palette.some((p) => normalizeHex(p).toLowerCase() === key)) return;
		onPaletteChange([...palette, n]);
	}

	function setColor(hex: string) {
		const n = normalizeHex(hex);
		if (!/^#[0-9a-f]{6}$/.test(n)) return;
		onValueChange?.(n);
		sessionColorHex = n;
		hexText = n;
	}

	function commitHexInput() {
		const n = normalizeHex(hexText.trim());
		if (/^#[0-9a-f]{6}$/.test(n)) {
			setColor(n);
		} else {
			hexText = normalizeHex(value || '#ffffff');
		}
	}

	function removeFromPalette(hex: string, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (!palette || !onPaletteChange) return;
		const key = normalizeHex(hex).toLowerCase();
		onPaletteChange(palette.filter((p) => normalizeHex(p).toLowerCase() !== key));
	}

	function selectPaletteSwatch(hex: string) {
		setColor(hex);
	}

	async function toggle() {
		if (open) {
			close();
			return;
		}
		open = true;
		hexText = normalizeHex(value || '#ffffff');
		sessionColorHex = hexText;
		await tick();
		queueMicrotask(placePopover);
	}

	function close() {
		if (!open) return;
		addToPalette(sessionColorHex);
		open = false;
	}

	async function resetAndClose() {
		onReset?.();
		await tick();
		sessionColorHex = normalizeHex(value || '#ffffff');
		close();
	}

	function placePopover() {
		if (!open || !triggerEl || !popEl) return;
		const r = triggerEl.getBoundingClientRect();
		const gap = 6;
		const w = popEl.offsetWidth;
		const h = popEl.offsetHeight;
		let top = r.bottom + gap;
		if (top + h > window.innerHeight - 8) {
			top = Math.max(8, r.top - gap - h);
		}
		let left = r.left;
		if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
		popEl.style.left = `${left}px`;
		popEl.style.top = `${top}px`;
	}

	function onOutsidePointer(e: PointerEvent) {
		if (!open) return;
		const t = e.target as Node;
		if (triggerEl?.contains(t) || popEl?.contains(t)) return;
		close();
	}

	function onWinKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') close();
	}

	function onWinResize() {
		if (!open) return;
		placePopover();
	}

	$: pickerHex = hexForColorInput(value);
</script>

<svelte:window onpointerdown={onOutsidePointer} onkeydown={onWinKeydown} onresize={onWinResize} />

<div class="cp">
	<button
		type="button"
		class="trigger"
		bind:this={triggerEl}
		style:--swatch={pickerHex}
		aria-expanded={open}
		aria-haspopup="dialog"
		onclick={toggle}
	>
		<span class="swatch-inner" aria-hidden="true"></span>
		<span class="sr-only">{ariaLabel}</span>
	</button>

	{#if open}
		<div
			class="pop"
			bind:this={popEl}
			role="dialog"
			aria-label="Color"
			tabindex="-1"
		>
			<div class="pop-main">
				<label class="native">
					<span class="native-label">Color</span>
					<input
						type="color"
						value={pickerHex}
						class="native-input"
						oninput={(e) => setColor((e.currentTarget as HTMLInputElement).value)}
					/>
				</label>
				<label class="hex-wrap">
					<span class="hex-label">Hex</span>
					<input
						type="text"
						class="hex"
						spellcheck="false"
						bind:value={hexText}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								commitHexInput();
							}
						}}
						onblur={commitHexInput}
					/>
				</label>
			</div>

			{#if palette != null && onPaletteChange && palette.length > 0}
				<div class="pal-section">
					<div class="pal-swatches">
						{#each palette as c (c)}
							<button
								type="button"
								class="pal-dot"
								style:--c={normalizeHex(c)}
								title={normalizeHex(c)}
								aria-label="Use {normalizeHex(c)}"
								onclick={() => selectPaletteSwatch(c)}
								oncontextmenu={(e) => removeFromPalette(c, e)}
							></button>
						{/each}
					</div>
				</div>
			{/if}

			{#if resetLabel && onReset}
				<div class="pop-footer">
					<button type="button" class="link-reset" onclick={resetAndClose}>
						{resetLabel}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.cp {
		position: relative;
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
	.trigger {
		width: 36px;
		height: 32px;
		padding: 3px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		cursor: pointer;
		box-sizing: border-box;
	}
	.swatch-inner {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 5px;
		background: var(--swatch);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
	}
	.pop {
		position: fixed;
		z-index: 10050;
		min-width: 220px;
		max-width: min(320px, calc(100vw - 16px));
		box-sizing: border-box;
		padding: 12px;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		box-shadow:
			0 10px 40px rgba(0, 0, 0, 0.18),
			0 0 0 1px rgba(255, 255, 255, 0.04);
	}
	.pop-main {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.native {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.native-label,
	.hex-label {
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.native-input {
		width: 48px;
		height: 36px;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		cursor: pointer;
		background: transparent;
	}
	.hex-wrap {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.hex {
		padding: 6px 8px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
		font-family: ui-monospace, monospace;
		font-size: 13px;
	}
	.pal-section {
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid var(--color-border);
	}
	.pal-swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		/* Cap width so large palettes wrap instead of stretching the popover */
		max-width: 272px;
	}
	.pal-dot {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		padding: 0;
		border: 2px solid var(--color-border);
		background: var(--c);
		cursor: pointer;
		box-sizing: border-box;
	}
	.pal-dot:hover {
		filter: brightness(1.08);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
	}
	.pop-footer {
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--color-border);
	}
	.link-reset {
		padding: 0;
		border: none;
		background: none;
		color: var(--color-accent, #3b82f6);
		font-size: 12px;
		cursor: pointer;
		text-decoration: underline;
	}
	.link-reset:hover {
		opacity: 0.9;
	}
</style>
