<script lang="ts">
	import type { PieceInstance } from '$lib/engine/types';
	import ImageUploader from './ImageUploader.svelte';
	import ColorPicker from './ColorPicker.svelte';
	import { game, setPieceColorPalette } from '$lib/stores/game';

	export let piece: PieceInstance | null;
	export let gameId: string;
	export let userId: string;
	export let onChange: (next: PieceInstance) => void;
	/** Persist palette to game_data (e.g. debounced Supabase merge). */
	export let onPalettePersist: ((cols: string[]) => void) | undefined = undefined;

	const attrs = ['select', 'move', 'flip', 'shuffle', 'roundcorners'] as const;

	function toggleAttr(a: (typeof attrs)[number]) {
		if (!piece) return;
		const set = new Set(piece.attributes);
		if (set.has(a)) set.delete(a);
		else set.add(a);
		onChange({ ...piece, attributes: [...set] });
	}

	function patch(p: Partial<PieceInstance>) {
		if (!piece) return;
		onChange({ ...piece, ...p });
	}
</script>

{#if piece}
	<div class="props">
		<label class="row">
			<span>Class</span>
			<input
				type="text"
				value={piece.classes}
				oninput={(e) => patch({ classes: (e.currentTarget as HTMLInputElement).value })}
			/>
		</label>
		<label class="row">
			<span>Image file (bg)</span>
			<input
				type="text"
				value={piece.bg}
				oninput={(e) => patch({ bg: (e.currentTarget as HTMLInputElement).value })}
			/>
		</label>
		<div class="row">
			<span>Upload</span>
			<ImageUploader
				{gameId}
				{userId}
				onUploaded={(path, filename) => {
					patch({ bg: filename });
				}}
			/>
		</div>
		<label class="row">
			<span>W</span>
			<input
				type="number"
				value={piece.initial_size.w}
				oninput={(e) =>
					patch({
						initial_size: {
							...piece.initial_size,
							w: Math.max(4, parseFloat((e.currentTarget as HTMLInputElement).value) || 0)
						}
					})}
			/>
		</label>
		<label class="row">
			<span>H</span>
			<input
				type="number"
				value={piece.initial_size.h}
				oninput={(e) =>
					patch({
						initial_size: {
							...piece.initial_size,
							h: Math.max(4, parseFloat((e.currentTarget as HTMLInputElement).value) || 0)
						}
					})}
			/>
		</label>
		<h4>Background color</h4>
		<p class="subhint">Solid fill behind the image (visible through transparent PNG areas).</p>
		<div class="bg-picker">
			<ColorPicker
				value={piece.bg_color || '#94a3b8'}
				palette={$game.pieceColorPalette}
				onPaletteChange={(cols: string[]) => {
					setPieceColorPalette(cols);
					onPalettePersist?.(cols);
				}}
				onValueChange={(c: string) => patch({ bg_color: c })}
				resetLabel="Clear"
				onReset={() => patch({ bg_color: undefined })}
			/>
		</div>
		<h4>Attributes</h4>
		{#each attrs as a}
			<label class="check">
				<input
					type="checkbox"
					checked={piece.attributes.includes(a)}
					onchange={() => toggleAttr(a)}
				/>
				<span>{a}</span>
			</label>
		{/each}
	</div>
{:else}
	<p class="muted">Select a piece</p>
{/if}

<style>
	.props {
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-size: 13px;
	}
	h4 {
		margin: 8px 0 0;
		font-size: 12px;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.row input[type='text'],
	.row input[type='number'] {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.muted {
		color: var(--color-text-muted);
	}
	.subhint {
		margin: 0 0 6px;
		font-size: 11px;
		color: var(--color-text-muted);
		line-height: 1.35;
	}
	.bg-picker {
		display: flex;
		align-items: center;
	}
</style>
