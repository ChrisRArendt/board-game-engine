<script lang="ts">
	export let value = '#ffffff';
	export let onValueChange: ((v: string) => void) | undefined = undefined;
</script>

<div class="color-row">
	<input
		type="color"
		{value}
		class="swatch"
		aria-label="Color"
		oninput={(e) => {
			const v = (e.currentTarget as HTMLInputElement).value;
			onValueChange?.(v);
		}}
	/>
	<input
		type="text"
		{value}
		class="hex"
		spellcheck="false"
		oninput={(e) => {
			const v = (e.currentTarget as HTMLInputElement).value;
			onValueChange?.(v);
		}}
	/>
</div>

<style>
	.color-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.swatch {
		width: 40px;
		height: 36px;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		cursor: pointer;
	}
	.hex {
		flex: 1;
		min-width: 0;
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		font-family: ui-monospace, monospace;
		font-size: 13px;
	}
</style>
