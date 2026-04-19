<script lang="ts">
	import ColorPicker from './ColorPicker.svelte';

	export let palette: string[] | undefined = undefined;
	export let onPaletteChange: ((next: string[]) => void) | undefined = undefined;

	export let stops: { offset: number; color: string }[] = [
		{ offset: 0, color: '#1a1a2e' },
		{ offset: 1, color: '#16213e' }
	];
	export let angle = 135;
	/** Shape fills: linear (angle) vs radial (curved). Card backgrounds ignore this. */
	export let gradientKind: 'linear' | 'radial' = 'linear';
	/** Radial mode: ellipse radius as % of the layer (both axes), roughly 5–200. */
	export let radialRadiusPct = 100;
	/** When true (shape fills), show linear vs radial and radius. Card backgrounds use linear-only UI. */
	export let showGradientKindControls = false;
	export let onChange:
		| ((next: {
				stops: typeof stops;
				angle: number;
				gradientKind: 'linear' | 'radial';
				radialRadiusPct: number;
		  }) => void)
		| undefined = undefined;

	function emit() {
		onChange?.({
			stops: [...stops],
			angle,
			gradientKind,
			radialRadiusPct
		});
	}

	function addStop() {
		stops = [...stops, { offset: 0.5, color: '#444466' }].sort((a, b) => a.offset - b.offset);
		emit();
	}

	function removeStop(i: number) {
		if (stops.length <= 2) return;
		stops = stops.filter((_, j) => j !== i);
		emit();
	}
</script>

<div class="grad">
	{#if showGradientKindControls}
		<label class="row">
			<span>Gradient style</span>
			<select
				bind:value={gradientKind}
				onchange={emit}
				class="kind-select"
			>
				<option value="linear">Linear</option>
				<option value="radial">Radial (curved)</option>
			</select>
		</label>
		{#if gradientKind === 'linear'}
			<label class="row">
				<span>Angle (°)</span>
				<input
					type="number"
					bind:value={angle}
					step="1"
					onchange={emit}
				/>
			</label>
		{:else}
			<label class="row">
				<span>Radius (%)</span>
				<input
					type="number"
					min="5"
					max="200"
					step="1"
					bind:value={radialRadiusPct}
					onchange={emit}
				/>
			</label>
			<p class="hint">Elliptical gradient from the center; lower values keep color change tighter in the middle.</p>
		{/if}
	{:else}
		<label class="row">
			<span>Angle (°)</span>
			<input
				type="number"
				bind:value={angle}
				step="1"
				onchange={emit}
			/>
		</label>
	{/if}
	{#each stops as s, i}
		<div class="stop">
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				value={s.offset}
				oninput={(e) => {
					const v = parseFloat((e.currentTarget as HTMLInputElement).value);
					stops = stops.map((x, j) => (j === i ? { ...x, offset: v } : x)).sort((a, b) => a.offset - b.offset);
					emit();
				}}
			/>
			<ColorPicker
				value={s.color}
				{palette}
				{onPaletteChange}
				onValueChange={(c: string) => {
					stops = stops.map((x, j) => (j === i ? { ...x, color: c } : x));
					emit();
				}}
			/>
			{#if stops.length > 2}
				<button type="button" class="rm" onclick={() => removeStop(i)} aria-label="Remove stop">×</button>
			{/if}
		</div>
	{/each}
	<button type="button" class="btn" onclick={addStop}>Add color stop</button>
</div>

<style>
	.grad {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
	}
	.row input[type='number'],
	.kind-select {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		font-size: 13px;
	}
	.hint {
		margin: -4px 0 0;
		font-size: 11px;
		line-height: 1.4;
		color: var(--color-text-muted);
	}
	.stop {
		display: grid;
		grid-template-columns: 1fr auto 28px;
		gap: 8px;
		align-items: center;
	}
	.rm {
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		color: inherit;
		cursor: pointer;
		font-size: 18px;
		line-height: 1;
	}
	.btn {
		align-self: flex-start;
		padding: 6px 10px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
		font-size: 13px;
	}
</style>
