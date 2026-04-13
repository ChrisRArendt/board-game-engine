<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import {
		scrubToIndex,
		restoreFromHistoryEntry,
		gameHistoryEntries,
		gameHistorySliderIndex,
		gameHistoryLoadState,
		gameHistoryLoadError,
		isHistoryReplayActive
	} from '$lib/stores/history';
	import { get as getStore } from 'svelte/store';
	import { emit } from '$lib/stores/network';

	export let lobbyId: string;
	export let supabase: SupabaseClient;
	export let onPersistSnapshot: () => Promise<void>;

	let scrubDebounce: ReturnType<typeof setTimeout> | null = null;
	let playTimer: ReturnType<typeof setInterval> | null = null;
	let playing = false;

	function scheduleScrubEmit(index: number) {
		if (scrubDebounce) clearTimeout(scrubDebounce);
		scrubDebounce = setTimeout(() => {
			scrubDebounce = null;
			emit('history_scrub', { index });
		}, 100);
	}

	function onRangeInput(e: Event) {
		const v = parseInt((e.target as HTMLInputElement).value, 10);
		if (Number.isNaN(v)) return;
		scrubToIndex(v);
		scheduleScrubEmit(v);
	}

	async function onRestore() {
		const idx = getStore(gameHistorySliderIndex);
		if (idx === null) return;
		const list = getStore(gameHistoryEntries);
		const e = list[idx];
		if (!e) return;
		if (
			!confirm(
				'Restore this point in time as the live game? Future history will be deleted for everyone.'
			)
		) {
			return;
		}
		stopPlay();
		const ok = await restoreFromHistoryEntry(supabase, lobbyId, idx, onPersistSnapshot);
		if (ok) {
			emit('history_restore', { historyId: e.id });
		}
	}

	function stopPlay() {
		playing = false;
		if (playTimer) {
			clearInterval(playTimer);
			playTimer = null;
		}
	}

	function togglePlay() {
		const list = getStore(gameHistoryEntries);
		if (list.length < 2) return;
		if (playing) {
			stopPlay();
			return;
		}
		playing = true;
		playTimer = setInterval(() => {
			const cur = getStore(gameHistorySliderIndex);
			const max = list.length - 1;
			if (cur === null) {
				stopPlay();
				return;
			}
			if (cur >= max) {
				stopPlay();
				return;
			}
			const next = cur + 1;
			scrubToIndex(next);
			scheduleScrubEmit(next);
		}, 800);
	}

	onDestroy(() => {
		stopPlay();
		if (scrubDebounce) clearTimeout(scrubDebounce);
	});

	$: if (!$isHistoryReplayActive) stopPlay();

	$: listLen = $gameHistoryEntries.length;
	$: maxIdx = Math.max(0, listLen - 1);
	$: sliderVal = $gameHistorySliderIndex ?? 0;
	$: labelTime =
		listLen > 0 && $gameHistorySliderIndex !== null
			? new Date($gameHistoryEntries[$gameHistorySliderIndex]?.createdAt ?? 0).toLocaleString()
			: '';
</script>

{#if $isHistoryReplayActive}
	<div class="history-inline" data-history-strip>
		<div class="replay-badge" aria-hidden="true">REPLAY</div>
		<div class="row">
			{#if $gameHistoryLoadState === 'loading'}
				<span class="hint">Loading timeline…</span>
			{:else if $gameHistoryLoadError}
				<span class="err">{$gameHistoryLoadError}</span>
			{:else if listLen === 0}
				<span class="hint">No snapshots yet — history records every 30s when the board changes.</span>
			{:else}
				<label class="slider-label">
					<span class="time" title={labelTime}>{labelTime}</span>
					<input
						type="range"
						class="hist-range"
						min="0"
						max={maxIdx}
						value={sliderVal}
						oninput={onRangeInput}
					/>
				</label>
				<button type="button" class="hist-btn secondary" onclick={togglePlay}>
					{playing ? 'Pause' : 'Play'}
				</button>
				<button type="button" class="hist-btn danger" onclick={onRestore}>Restore this state</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.history-inline {
		width: 100%;
		background: linear-gradient(
			to bottom,
			var(--color-history-bg),
			var(--color-history-bg-end)
		);
		backdrop-filter: blur(8px);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
		padding: 6px 12px 8px;
		font-size: 14px;
		pointer-events: auto;
		border-bottom: 1px solid var(--color-chrome-border);
		color: var(--color-history-text);
	}
	.replay-badge {
		display: inline-block;
		margin-bottom: 6px;
		background: rgba(180, 30, 30, 0.9);
		color: #fff;
		padding: 4px 12px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		max-width: 100%;
	}
	.hist-btn {
		all: unset;
		display: inline-block;
		padding: 6px 14px;
		min-height: 44px;
		box-sizing: border-box;
		line-height: 1.4;
		background: linear-gradient(to bottom, #5a9, #386);
		color: #fff;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		user-select: none;
	}
	.hist-btn.secondary {
		background: linear-gradient(to bottom, #678, #456);
	}
	.hist-btn.danger {
		background: linear-gradient(to bottom, #c85, #a62);
	}
	.hint {
		color: var(--color-history-hint);
	}
	.err {
		color: var(--color-danger);
	}
	.slider-label {
		flex: 1;
		min-width: 200px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.slider-label input[type='range'] {
		width: 100%;
	}
	.hist-range {
		-webkit-appearance: none;
		appearance: none;
		height: 8px;
		border-radius: 4px;
		background: var(--color-slider-track);
		outline: none;
	}
	.hist-range::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: linear-gradient(to bottom, #5a9, #386);
		cursor: pointer;
		border: 2px solid #fff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
	}
	.hist-range::-moz-range-thumb {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: linear-gradient(to bottom, #5a9, #386);
		cursor: pointer;
		border: 2px solid #fff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
	}
	.time {
		font-variant-numeric: tabular-nums;
		color: var(--color-history-text);
		font-size: 12px;
	}
	@media (min-width: 640px) {
		.hist-btn {
			min-height: 36px;
			padding: 4px 12px;
		}
	}
</style>
