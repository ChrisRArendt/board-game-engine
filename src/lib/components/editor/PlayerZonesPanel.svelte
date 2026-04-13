<script lang="ts">
	import { get } from 'svelte/store';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import type { Rect } from '$lib/engine/geometry';
	import {
		defaultPlayerSlotsFromLegacyGrid,
		playerSlotColor,
		PLAYER_SLOT_MAX
	} from '$lib/engine/stash';

	export let onAfterEdit: () => void;

	function initFromLegacy() {
		g.setPlayerSlots(defaultPlayerSlotsFromLegacyGrid());
		onAfterEdit();
	}

	function clearZones() {
		g.setPlayerSlots(null);
		onAfterEdit();
	}

	function patchRect(
		slotIndex: number,
		which: 'safe' | 'deal' | 'score',
		field: keyof Rect,
		raw: string
	) {
		const slots = get(game).playerSlots;
		if (!slots || !slots[slotIndex]) return;
		const n = parseFloat(raw);
		if (!Number.isFinite(n)) return;
		const cur = slots[slotIndex][which];
		const nextRect = { ...cur, [field]: n };
		const next = slots.map((z, j) =>
			j === slotIndex ? { ...z, [which]: nextRect } : z
		);
		g.setPlayerSlots(next);
		onAfterEdit();
	}
</script>

<div class="panel">
	<h4>Player zones</h4>
	<p class="hint">
		Up to {PLAYER_SLOT_MAX} slots. Each has <strong>safe</strong> (private hand), <strong>deal</strong> (incoming
		cards), and <strong>score</strong> (shared +/- counter in play). Runtime maps lobby players to slots in order.
	</p>
	{#if !$game.playerSlots}
		<p class="subhint">
			When disabled, the board uses the built-in fixed stash positions. Enabling saves per-slot rectangles in this
			game so you can place safe and deal areas anywhere.
		</p>
		<button type="button" class="btn primary" onclick={initFromLegacy}>Enable player zones</button>
		<p class="subhint after-btn">
			Starts from the same layout as the built-in stash grid—you can edit numbers below.
		</p>
	{:else}
		<div class="actions">
			<button type="button" class="btn secondary" onclick={initFromLegacy}>Reset to built-in stash layout</button>
			<button type="button" class="btn danger" onclick={clearZones}>Disable zones (built-in stash only)</button>
		</div>
		<div class="slots">
			{#each $game.playerSlots as z, i (i)}
				<details class="slot" open={i === 0}>
					<summary>
						<span class="slot-swatch" style:background={playerSlotColor(i)} title="Player {i + 1} color"
						></span>
						Slot {i + 1}
					</summary>
					<div class="grid">
						<span class="lab">Safe x</span>
						<input
							type="number"
							value={z.safe.x}
							onchange={(e) => patchRect(i, 'safe', 'x', e.currentTarget.value)}
						/>
						<span class="lab">y</span>
						<input
							type="number"
							value={z.safe.y}
							onchange={(e) => patchRect(i, 'safe', 'y', e.currentTarget.value)}
						/>
						<span class="lab">w</span>
						<input
							type="number"
							value={z.safe.w}
							onchange={(e) => patchRect(i, 'safe', 'w', e.currentTarget.value)}
						/>
						<span class="lab">h</span>
						<input
							type="number"
							value={z.safe.h}
							onchange={(e) => patchRect(i, 'safe', 'h', e.currentTarget.value)}
						/>
					</div>
					<div class="grid deal">
						<span class="lab">Deal x</span>
						<input
							type="number"
							value={z.deal.x}
							onchange={(e) => patchRect(i, 'deal', 'x', e.currentTarget.value)}
						/>
						<span class="lab">y</span>
						<input
							type="number"
							value={z.deal.y}
							onchange={(e) => patchRect(i, 'deal', 'y', e.currentTarget.value)}
						/>
						<span class="lab">w</span>
						<input
							type="number"
							value={z.deal.w}
							onchange={(e) => patchRect(i, 'deal', 'w', e.currentTarget.value)}
						/>
						<span class="lab">h</span>
						<input
							type="number"
							value={z.deal.h}
							onchange={(e) => patchRect(i, 'deal', 'h', e.currentTarget.value)}
						/>
					</div>
					<div class="grid score">
						<span class="lab">Score x</span>
						<input
							type="number"
							value={z.score.x}
							onchange={(e) => patchRect(i, 'score', 'x', e.currentTarget.value)}
						/>
						<span class="lab">y</span>
						<input
							type="number"
							value={z.score.y}
							onchange={(e) => patchRect(i, 'score', 'y', e.currentTarget.value)}
						/>
						<span class="lab">w</span>
						<input
							type="number"
							value={z.score.w}
							onchange={(e) => patchRect(i, 'score', 'w', e.currentTarget.value)}
						/>
						<span class="lab">h</span>
						<input
							type="number"
							value={z.score.h}
							onchange={(e) => patchRect(i, 'score', 'h', e.currentTarget.value)}
						/>
					</div>
				</details>
			{/each}
		</div>
	{/if}
</div>

<style>
	.panel {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}
	h4 {
		margin: 0 0 8px;
		font-size: 13px;
	}
	.hint {
		margin: 0 0 10px;
		font-size: 12px;
		line-height: 1.4;
		color: var(--color-text-muted, #94a3b8);
	}
	.subhint {
		margin: 0 0 10px;
		font-size: 11px;
		line-height: 1.45;
		color: var(--color-text-muted, #94a3b8);
	}
	.subhint.after-btn {
		margin: 8px 0 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 10px;
	}
	.btn {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 12px;
		cursor: pointer;
	}
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
	}
	.btn.secondary {
		background: var(--color-surface);
	}
	.btn.danger {
		border-color: #b91c1c;
		color: #fecaca;
	}
	.slots {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 320px;
		overflow: auto;
	}
	.slot {
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 4px 8px;
		font-size: 12px;
	}
	.slot summary {
		cursor: pointer;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.slot-swatch {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
		border: 1px solid rgba(255, 255, 255, 0.25);
	}
	.grid {
		display: grid;
		grid-template-columns: auto 1fr auto 1fr;
		gap: 4px 6px;
		align-items: center;
		margin-top: 8px;
	}
	.grid.deal,
	.grid.score {
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px dashed var(--color-border);
	}
	.lab {
		font-size: 11px;
		opacity: 0.85;
	}
	input {
		width: 100%;
		min-width: 0;
		padding: 4px 6px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
		font-size: 12px;
	}
</style>
