<script lang="ts">
	import { browser } from '$app/environment';
	import type { BoardWidget } from '$lib/engine/types';
	import { normalizeLabelConfig } from '$lib/engine/boardWidgets';
	import { ensureGoogleFontLoaded, extractPrimaryFontFamily } from '$lib/editor/googleFontsLoader';

	export let widget: BoardWidget;
	export let editorMode = false;
	export let replayMode = false;
	export let selected = false;
	export let dragging = false;
	export let onpointerdown: ((e: PointerEvent) => void) | undefined = undefined;
	export let onValueChange: ((id: number, value: string | number | boolean) => void) | undefined = undefined;

	function numConfig(w: BoardWidget) {
		const c = w.config;
		const min = typeof c.min === 'number' ? c.min : 0;
		const max = typeof c.max === 'number' ? c.max : 999;
		const step = typeof c.step === 'number' ? c.step : 1;
		return { min, max, step };
	}

	function diceSides(w: BoardWidget) {
		const c = w.config;
		const sides = typeof c.sides === 'number' && c.sides >= 2 ? c.sides : 6;
		const count = typeof c.count === 'number' && c.count >= 1 ? Math.min(20, c.count) : 1;
		return { sides, count };
	}

	function rollDice() {
		const { sides, count } = diceSides(widget);
		let sum = 0;
		for (let i = 0; i < count; i++) {
			sum += 1 + Math.floor(Math.random() * sides);
		}
		onValueChange?.(widget.id, sum);
	}

	function bumpCounter(delta: number) {
		const { min, max, step } = numConfig(widget);
		let v = typeof widget.value === 'number' ? widget.value : 0;
		v += delta * step;
		v = Math.round(v / step) * step;
		v = Math.min(max, Math.max(min, v));
		onValueChange?.(widget.id, v);
	}

	function onTextInput(e: Event) {
		const v = (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
		onValueChange?.(widget.id, v);
	}

	function toggleBool() {
		const next = !(widget.value === true);
		onValueChange?.(widget.id, next);
	}

	$: labelText = widget.label?.trim() || '';
	$: counterVal = typeof widget.value === 'number' ? widget.value : Number(widget.value) || 0;
	$: textVal = typeof widget.value === 'string' ? widget.value : String(widget.value ?? '');
	$: toggleOn = widget.value === true;
	$: labelSty = widget.type === 'label' ? normalizeLabelConfig(widget.config) : null;
	$: if (browser && labelSty) {
		const p = extractPrimaryFontFamily(labelSty.fontFamily);
		if (p) ensureGoogleFontLoaded(p);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="board-widget"
	class:editorMode
	class:play={!editorMode}
	class:type-label={widget.type === 'label'}
	class:selected
	class:dragging
	data-board-widget-id={widget.id}
	style:left="{widget.x}px"
	style:top="{widget.y}px"
	style:width="{widget.w}px"
	style:min-height="{widget.h}px"
	style:z-index={widget.zIndex}
	style:background={widget.type === 'label' && labelSty
		? labelSty.backgroundTransparent
			? 'transparent'
			: labelSty.backgroundColor
		: undefined}
	style:border={widget.type === 'label' && labelSty?.backgroundTransparent ? 'none' : undefined}
	style:padding={widget.type === 'label' && labelSty?.backgroundTransparent ? '0' : undefined}
	style:box-shadow={widget.type === 'label' && labelSty?.backgroundTransparent ? 'none' : undefined}
	onpointerdown={onpointerdown}
>
	{#if labelText}
		<div class="widget-caption">{labelText}</div>
	{/if}

	{#if widget.type === 'counter'}
		<div class="w-counter">
			<button
				type="button"
				class="w-btn interactive"
				disabled={editorMode || replayMode}
				onpointerdown={(e) => e.stopPropagation()}
				onclick={() => bumpCounter(-1)}>−</button
			>
			<span class="w-num">{counterVal}</span>
			<button
				type="button"
				class="w-btn interactive"
				disabled={editorMode || replayMode}
				onpointerdown={(e) => e.stopPropagation()}
				onclick={() => bumpCounter(1)}>+</button
			>
		</div>
	{:else if widget.type === 'label' && labelSty}
		<div class="w-label-wrap">
			<div
				class="w-label"
				class:text-v-center={labelSty.verticalAlign === 'center'}
				class:text-v-bottom={labelSty.verticalAlign === 'bottom'}
				style:font-family={labelSty.fontFamily}
				style:font-size="{labelSty.fontSize}px"
				style:font-weight={labelSty.fontWeight}
				style:font-style={labelSty.fontStyle}
				style:color={labelSty.color}
				style:text-align={labelSty.textAlign}
				style:line-height={labelSty.lineHeight}
				style:letter-spacing="{labelSty.letterSpacingPx}px"
				style:text-decoration={labelSty.textDecoration}
				style:text-transform={labelSty.textTransform}
				style:text-shadow={labelSty.textShadow.trim() ? labelSty.textShadow : 'none'}
			>
				<span class="w-label-inner">{labelSty.text}</span>
			</div>
		</div>
	{:else if widget.type === 'textbox'}
		<textarea
			class="w-textarea interactive"
			rows="3"
			readonly={editorMode || replayMode}
			tabindex={replayMode ? -1 : 0}
			placeholder={typeof widget.config.placeholder === 'string' ? widget.config.placeholder : ''}
			value={textVal}
			onpointerdown={(e) => e.stopPropagation()}
			oninput={onTextInput}
		></textarea>
	{:else if widget.type === 'dice'}
		<div class="w-dice">
			<button
				type="button"
				class="w-roll interactive"
				disabled={editorMode || replayMode}
				onpointerdown={(e) => e.stopPropagation()}
				onclick={() => rollDice()}>Roll</button
			>
			<span class="w-dice-result">{typeof widget.value === 'number' ? widget.value : '—'}</span>
		</div>
	{:else if widget.type === 'toggle'}
		<button
			type="button"
			class="w-toggle interactive"
			class:on={toggleOn}
			disabled={editorMode || replayMode}
			onpointerdown={(e) => e.stopPropagation()}
			onclick={() => toggleBool()}
		>
			{toggleOn
				? typeof widget.config.onText === 'string'
					? widget.config.onText
					: 'On'
				: typeof widget.config.offText === 'string'
					? widget.config.offText
					: 'Off'}
		</button>
	{/if}
</div>

<style>
	.board-widget {
		position: absolute;
		box-sizing: border-box;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(15, 23, 42, 0.92);
		padding: 8px;
		color: #e2e8f0;
		font-size: 14px;
		pointer-events: auto;
	}
	.board-widget.play {
		pointer-events: none;
	}
	.board-widget.play .interactive {
		pointer-events: auto;
	}
	.board-widget.editorMode {
		pointer-events: auto;
	}
	.board-widget.selected {
		outline: 2px solid var(--color-accent, #3b82f6);
		outline-offset: 1px;
	}
	.board-widget.dragging {
		opacity: 0.92;
	}
	.board-widget.type-label {
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		overflow: hidden;
	}
	.w-label-wrap {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.w-label {
		flex: 1;
		align-self: stretch;
		width: 100%;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		overflow: hidden;
		word-break: break-word;
		white-space: pre-wrap;
	}
	.w-label.text-v-center {
		justify-content: center;
	}
	.w-label.text-v-bottom {
		justify-content: flex-end;
	}
	.w-label-inner {
		display: block;
		width: 100%;
	}
	.widget-caption {
		font-size: 11px;
		color: #94a3b8;
		margin-bottom: 6px;
	}
	.w-counter {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
	}
	.w-btn {
		width: 36px;
		height: 36px;
		border-radius: 6px;
		border: 1px solid #475569;
		background: #1e293b;
		color: #f8fafc;
		font-size: 20px;
		line-height: 1;
		cursor: pointer;
	}
	.w-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.w-num {
		min-width: 2ch;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.w-textarea {
		width: 100%;
		min-height: 64px;
		resize: vertical;
		border-radius: 6px;
		border: 1px solid #334155;
		background: #0f172a;
		color: #e2e8f0;
		padding: 8px;
		font: inherit;
		box-sizing: border-box;
	}
	.w-dice {
		display: flex;
		align-items: center;
		gap: 12px;
		justify-content: center;
	}
	.w-roll {
		padding: 8px 14px;
		border-radius: 6px;
		border: 1px solid #475569;
		background: #2563eb;
		color: #fff;
		font-weight: 600;
		cursor: pointer;
	}
	.w-roll:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.w-dice-result {
		font-size: 22px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		min-width: 2ch;
		text-align: center;
	}
	.w-toggle {
		width: 100%;
		padding: 10px 12px;
		border-radius: 6px;
		border: 1px solid #475569;
		background: #334155;
		color: #e2e8f0;
		cursor: pointer;
		font-weight: 600;
	}
	.w-toggle.on {
		background: #15803d;
		border-color: #166534;
		color: #fff;
	}
	.w-toggle:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
