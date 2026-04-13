<script lang="ts">
	import { DEFAULT_PIECE_COLOR_PALETTE } from '$lib/engine/types';

	/** Hex colors shared across the game for piece background fills. */
	export let palette: string[];
	export let onChange: (next: string[]) => void;

	function normalizeHex(v: string): string {
		const t = v.trim();
		if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
		if (/^#[0-9a-fA-F]{3}$/.test(t)) {
			const r = t[1],
				g = t[2],
				b = t[3];
			return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
		}
		return t.startsWith('#') ? t : `#${t}`;
	}

	function updateAt(i: number, hex: string) {
		const next = [...palette];
		next[i] = normalizeHex(hex);
		onChange(next);
	}

	function removeAt(i: number) {
		onChange(palette.filter((_, j) => j !== i));
	}

	function addSwatch() {
		onChange([...palette, '#64748b']);
	}

	function resetDefaults() {
		onChange([...DEFAULT_PIECE_COLOR_PALETTE]);
	}
</script>

<div class="pal">
	<div class="row head">
		<span class="label">Piece color palette</span>
		<button type="button" class="linkish" onclick={addSwatch}>+ Add</button>
		<button type="button" class="linkish" onclick={resetDefaults}>Reset defaults</button>
	</div>
	<p class="hint">
		Used as swatches when picking a background color for pieces. Persists in game data (Save on Settings or Save
		board).
	</p>
	<div class="swatches">
		{#each palette as c, i (i)}
			<div class="sw">
				<input type="color" value={c} title={c} oninput={(e) => updateAt(i, (e.currentTarget as HTMLInputElement).value)} />
				<input
					class="hex"
					type="text"
					value={c}
					spellcheck="false"
					onchange={(e) => updateAt(i, (e.currentTarget as HTMLInputElement).value)}
				/>
				<button type="button" class="rm" title="Remove" aria-label="Remove swatch" onclick={() => removeAt(i)}>×</button>
			</div>
		{/each}
	</div>
</div>

<style>
	.pal {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.label {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		margin-right: auto;
	}
	.linkish {
		padding: 2px 8px;
		font-size: 12px;
		border: none;
		background: none;
		color: var(--color-accent, #3b82f6);
		cursor: pointer;
		text-decoration: underline;
	}
	.hint {
		margin: 0;
		font-size: 11px;
		line-height: 1.4;
		color: var(--color-text-muted);
	}
	.swatches {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 220px;
		overflow: auto;
	}
	.sw {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.sw input[type='color'] {
		width: 36px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		cursor: pointer;
	}
	.hex {
		flex: 1;
		min-width: 0;
		padding: 4px 8px;
		font-size: 12px;
		font-family: ui-monospace, monospace;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.rm {
		width: 28px;
		height: 28px;
		padding: 0;
		line-height: 1;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text-muted);
		cursor: pointer;
	}
	.rm:hover {
		color: #f87171;
	}
</style>
