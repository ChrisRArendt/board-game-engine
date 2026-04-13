<script lang="ts">
	/** 3×3 alignment — first string is stored as `object-position` / `background-position` */
	const POSITION_PRESETS: [string, string][] = [
		['left top', 'Top left'],
		['center top', 'Top center'],
		['right top', 'Top right'],
		['left center', 'Middle left'],
		['center', 'Center'],
		['right center', 'Middle right'],
		['left bottom', 'Bottom left'],
		['center bottom', 'Bottom center'],
		['right bottom', 'Bottom right']
	];

	function normalizePos(p: string): string {
		const t = p.trim().toLowerCase();
		if (t === '50% 50%' || t === 'center center') return 'center';
		return t;
	}

	let {
		objectFit,
		objectPosition,
		onFitChange,
		onPositionChange,
		fitLabel = 'Fit'
	}: {
		objectFit: 'cover' | 'contain' | 'fill';
		objectPosition: string;
		onFitChange: (fit: 'cover' | 'contain' | 'fill') => void;
		onPositionChange: (pos: string) => void;
		fitLabel?: string;
	} = $props();
</script>

<div class="layout-controls">
	<label class="fit-row">
		<span>{fitLabel}</span>
		<select
			value={objectFit}
			onchange={(e) =>
				onFitChange((e.currentTarget as HTMLSelectElement).value as 'cover' | 'contain' | 'fill')}
		>
			<option value="cover">Cover</option>
			<option value="contain">Contain</option>
			<option value="fill">Stretch</option>
		</select>
	</label>
	<div class="pos-wrap">
		<span class="pos-label">Position</span>
		<div class="grid9" role="group" aria-label="Image alignment">
			{#each POSITION_PRESETS as [cssVal, label] (cssVal)}
				<button
					type="button"
					class="cell"
					class:active={normalizePos(objectPosition) === normalizePos(cssVal)}
					title={label}
					aria-label={label}
					onclick={() => onPositionChange(cssVal)}
				></button>
			{/each}
		</div>
	</div>
</div>

<style>
	.layout-controls {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.fit-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		color: var(--color-text-muted, #94a3b8);
	}
	.fit-row select {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		max-width: 12rem;
	}
	.pos-wrap {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.pos-label {
		font-size: 12px;
		color: var(--color-text-muted, #94a3b8);
	}
	.grid9 {
		display: grid;
		grid-template-columns: repeat(3, 28px);
		grid-template-rows: repeat(3, 28px);
		gap: 3px;
		width: fit-content;
		padding: 4px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg, #0f172a);
	}
	.cell {
		margin: 0;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		background: var(--color-surface-muted, #1e293b);
		cursor: pointer;
	}
	.cell:hover {
		filter: brightness(1.15);
	}
	.cell.active {
		background: var(--color-accent, #3b82f6);
		border-color: transparent;
	}
</style>
