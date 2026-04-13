<script lang="ts">
	import ColorPicker from './ColorPicker.svelte';

	export let palette: string[] | undefined = undefined;
	export let onPaletteChange: ((next: string[]) => void) | undefined = undefined;

	export let stops: { offset: number; color: string }[] = [
		{ offset: 0, color: '#1a1a2e' },
		{ offset: 1, color: '#16213e' }
	];
	export let angle = 135;
	export let onChange: ((next: { stops: typeof stops; angle: number }) => void) | undefined = undefined;

	function emit() {
		onChange?.({ stops: [...stops], angle });
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
	<label class="row">
		<span>Angle (°)</span>
		<input
			type="number"
			bind:value={angle}
			step="1"
			onchange={emit}
		/>
	</label>
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
	.row input[type='number'] {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
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
