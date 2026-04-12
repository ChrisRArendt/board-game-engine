<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import {
		openReplay,
		exitReplay,
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

	async function toggleHistory() {
		if (getStore(isHistoryReplayActive)) {
			exitReplay();
			emit('history_close', {});
			stopPlay();
			return;
		}
		const idx = await openReplay(supabase, lobbyId);
		if (idx >= 0) {
			emit('history_open', { index: idx });
		}
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

<div class="history-strip" data-history-strip>
	<div class="row">
		<button type="button" class="hist-btn" onclick={toggleHistory}>
			{$isHistoryReplayActive ? 'Exit history' : 'History'}
		</button>
		{#if $isHistoryReplayActive}
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
		{/if}
	</div>
</div>

<style>
	.history-strip {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 2000000000;
		background: linear-gradient(to top, rgba(255, 255, 255, 0.95), rgba(230, 230, 230, 0.92));
		box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.25);
		padding: 6px 12px 8px;
		font-size: 14px;
		pointer-events: auto;
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
		padding: 4px 12px;
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
		color: #444;
	}
	.err {
		color: #b00;
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
	.time {
		font-variant-numeric: tabular-nums;
		color: #222;
		font-size: 12px;
	}
</style>
