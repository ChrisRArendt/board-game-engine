<script lang="ts">
	import FontFamilyPicker from './FontFamilyPicker.svelte';
	import ColorPicker from './ColorPicker.svelte';
	import { game } from '$lib/stores/game';
	import type { BoardWidget } from '$lib/engine/types';

	export let widget: BoardWidget;
	export let patchWidget: (next: BoardWidget) => void;
	export let onPalettePersist: ((cols: string[]) => void) | undefined = undefined;

	function patchConfig(partial: Record<string, unknown>) {
		patchWidget({
			...widget,
			config: { ...widget.config, ...partial }
		});
	}

	function patchTextAndValue(text: string) {
		patchWidget({
			...widget,
			config: { ...widget.config, text },
			value: text
		});
	}
</script>

<h4 class="sub">Typography</h4>
<label class="row">
	<span>Content</span>
	<input
		type="text"
		value={String(widget.config.text ?? widget.value ?? '')}
		oninput={(e) => patchTextAndValue((e.currentTarget as HTMLInputElement).value)}
	/>
</label>

<div class="font-block">
	<FontFamilyPicker
		value={String(widget.config.fontFamily ?? 'system-ui, sans-serif')}
		onChange={(fontFamily) => patchConfig({ fontFamily })}
	/>
</div>

<label class="row">
	<span>Font size</span>
	<input
		type="number"
		min="4"
		step="1"
		value={Number(widget.config.fontSize ?? 18)}
		oninput={(e) =>
			patchConfig({ fontSize: parseFloat((e.currentTarget as HTMLInputElement).value) || 12 })}
	/>
</label>
<label class="row">
	<span>Weight</span>
	<select
		value={String(widget.config.fontWeight ?? '600')}
		onchange={(e) => patchConfig({ fontWeight: (e.currentTarget as HTMLSelectElement).value })}
	>
		<option value="100">100</option>
		<option value="200">200</option>
		<option value="300">300</option>
		<option value="400">400</option>
		<option value="500">500</option>
		<option value="600">600</option>
		<option value="700">700</option>
		<option value="800">800</option>
		<option value="900">900</option>
	</select>
</label>
<label class="row">
	<span>Line height</span>
	<input
		type="number"
		min="0.5"
		step="0.05"
		value={Number(widget.config.lineHeight ?? 1.3)}
		oninput={(e) =>
			patchConfig({ lineHeight: parseFloat((e.currentTarget as HTMLInputElement).value) || 1.2 })}
	/>
</label>
<label class="row">
	<span>Letter spacing (px)</span>
	<input
		type="number"
		step="0.25"
		value={Number(widget.config.letterSpacingPx ?? 0)}
		oninput={(e) =>
			patchConfig({ letterSpacingPx: parseFloat((e.currentTarget as HTMLInputElement).value) || 0 })}
	/>
</label>
<label class="row">
	<span>Text color</span>
	<ColorPicker
		value={String(widget.config.color ?? '#e2e8f0')}
		palette={$game.pieceColorPalette}
		onPaletteChange={(cols) => onPalettePersist?.(cols)}
		onValueChange={(c) => patchConfig({ color: c })}
	/>
</label>

<label class="row check">
	<input
		type="checkbox"
		checked={widget.config.backgroundTransparent === true}
		onchange={(e) =>
			patchConfig({ backgroundTransparent: (e.currentTarget as HTMLInputElement).checked })}
	/>
	<span>Transparent background</span>
</label>
{#if widget.config.backgroundTransparent !== true}
	<label class="row">
		<span>Background color</span>
		<ColorPicker
			value={String(widget.config.backgroundColor ?? '#0f172a')}
			palette={$game.pieceColorPalette}
			onPaletteChange={(cols) => onPalettePersist?.(cols)}
			onValueChange={(c) => patchConfig({ backgroundColor: c })}
		/>
	</label>
{/if}

<label class="row">
	<span>Align (horizontal)</span>
	<select
		value={String(widget.config.textAlign ?? 'center')}
		onchange={(e) =>
			patchConfig({ textAlign: (e.currentTarget as HTMLSelectElement).value as 'left' | 'center' | 'right' })}
	>
		<option value="left">Left</option>
		<option value="center">Center</option>
		<option value="right">Right</option>
	</select>
</label>
<label class="row">
	<span>Align (vertical)</span>
	<select
		value={String(widget.config.verticalAlign ?? 'center')}
		onchange={(e) =>
			patchConfig({
				verticalAlign: (e.currentTarget as HTMLSelectElement).value as 'top' | 'center' | 'bottom'
			})}
	>
		<option value="top">Top</option>
		<option value="center">Center</option>
		<option value="bottom">Bottom</option>
	</select>
</label>
<label class="row">
	<span>Style</span>
	<select
		value={String(widget.config.fontStyle ?? 'normal')}
		onchange={(e) =>
			patchConfig({ fontStyle: (e.currentTarget as HTMLSelectElement).value as 'normal' | 'italic' })}
	>
		<option value="normal">Normal</option>
		<option value="italic">Italic</option>
	</select>
</label>
<label class="row">
	<span>Decoration</span>
	<select
		value={String(widget.config.textDecoration ?? 'none')}
		onchange={(e) =>
			patchConfig({
				textDecoration: (e.currentTarget as HTMLSelectElement).value as
					| 'none'
					| 'underline'
					| 'line-through'
			})}
	>
		<option value="none">None</option>
		<option value="underline">Underline</option>
		<option value="line-through">Line-through</option>
	</select>
</label>
<label class="row">
	<span>Transform</span>
	<select
		value={String(widget.config.textTransform ?? 'none')}
		onchange={(e) =>
			patchConfig({
				textTransform: (e.currentTarget as HTMLSelectElement).value as
					| 'none'
					| 'uppercase'
					| 'lowercase'
					| 'capitalize'
			})}
	>
		<option value="none">None</option>
		<option value="uppercase">Uppercase</option>
		<option value="lowercase">Lowercase</option>
		<option value="capitalize">Capitalize</option>
	</select>
</label>
<label class="row">
	<span>Text shadow (CSS)</span>
	<input
		type="text"
		placeholder="e.g. 0 1px 2px rgba(0,0,0,0.5)"
		value={String(widget.config.textShadow ?? '')}
		oninput={(e) => patchConfig({ textShadow: (e.currentTarget as HTMLInputElement).value })}
	/>
</label>

<style>
	h4.sub {
		margin: 12px 0 6px;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}
	h4.sub:first-child {
		margin-top: 0;
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.row.check {
		flex-direction: row;
		align-items: center;
		gap: 8px;
	}
	.row input[type='number'],
	.row input[type='text'],
	.row select {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.font-block {
		margin-bottom: 4px;
	}
</style>
