<script lang="ts">
	import type { DisplayUnit } from '$lib/editor/units';
	import { fromPx, toPx } from '$lib/editor/units';

	let {
		label = '',
		pxValue = $bindable(100),
		unit = $bindable<DisplayUnit>('px')
	}: {
		label?: string;
		pxValue?: number;
		unit?: DisplayUnit;
	} = $props();

	let strVal = $state('100');

	function fmt() {
		const v = fromPx(pxValue, unit);
		strVal = unit === 'px' ? String(Math.round(v)) : v.toFixed(unit === 'in' ? 3 : 2);
	}

	$effect(() => {
		fmt();
	});

	function onInput() {
		const n = parseFloat(strVal);
		if (!Number.isFinite(n)) return;
		pxValue = toPx(n, unit);
	}
</script>

<label class="wrap">
	{#if label}<span class="lab">{label}</span>{/if}
	<div class="row">
		<input type="text" bind:value={strVal} onchange={onInput} onblur={onInput} />
		<select bind:value={unit} onchange={() => fmt()}>
			<option value="px">px</option>
			<option value="in">in</option>
			<option value="cm">cm</option>
		</select>
	</div>
</label>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
	}
	.lab {
		color: var(--color-text-muted, #888);
	}
	.row {
		display: flex;
		gap: 6px;
	}
	.row input {
		flex: 1;
		min-width: 0;
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.row select {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
</style>
