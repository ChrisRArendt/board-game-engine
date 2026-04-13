<script lang="ts">
	export let value: number;
	/** Player / slot color — matches stash & deal zone mats. */
	export let accent: string;
	export let disabled = false;
	export let onChange: (next: number) => void;

	function bump(delta: number) {
		let v = (typeof value === 'number' ? value : 0) + delta;
		v = Math.min(99999, Math.max(-99999, Math.round(v)));
		onChange(v);
	}

	/** Solid fill — avoids “holes” behind large digits if parent paint fails; fallback if color missing. */
	$: fill =
		typeof accent === 'string' && accent.trim().length > 0 ? accent.trim() : '#94a3b8';
</script>

<div class="slot-score" style:--accent={fill} style:background-color={fill}>
	<div class="row">
		<button
			type="button"
			class="btn"
			{disabled}
			onpointerdown={(e) => e.stopPropagation()}
			onclick={() => bump(-1)}>−</button
		>
		<span class="num">{value}</span>
		<button
			type="button"
			class="btn"
			{disabled}
			onpointerdown={(e) => e.stopPropagation()}
			onclick={() => bump(1)}>+</button
		>
	</div>
</div>

<style>
	.slot-score {
		container-type: size;
		box-sizing: border-box;
		width: 100%;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: center;
		padding: 6px 8px;
		border-radius: 8px;
		/* Inline background-color + variable — mat color matches stash / deal zones */
		background-color: var(--accent);
		border: 1px solid rgba(0, 0, 0, 0.22);
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.12),
			inset 0 4px 20px rgba(0, 0, 0, 0.18),
			0 2px 8px rgba(0, 0, 0, 0.25);
		pointer-events: auto;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		flex: 1;
		min-height: 0;
		background-color: var(--accent);
		border-radius: 6px;
	}
	.btn {
		flex: 0 0 auto;
		width: 44px;
		height: 44px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.28);
		background: rgba(0, 0, 0, 0.22);
		color: #fff;
		font-size: 28px;
		font-weight: 600;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
	}
	.btn:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.32);
	}
	.btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.num {
		flex: 1;
		min-width: 0;
		text-align: center;
		/* Solid mat behind glyphs (large font can otherwise show board through antialiasing gaps) */
		background-color: var(--accent);
		border-radius: 4px;
		/* Large readout; shrinks if the score rect is small */
		font-size: min(72px, max(28px, 42cqmin));
		line-height: 1;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: #fff;
		text-shadow:
			0 0 10px rgba(0, 0, 0, 0.55),
			0 2px 4px rgba(0, 0, 0, 0.65);
	}
</style>
