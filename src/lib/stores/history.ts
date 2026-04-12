import { derived, get, writable } from 'svelte/store';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '$lib/supabase/database.types';
import {
	applyStoredGameSnapshot,
	isStoredGameSnapshot,
	serializeGameState,
	type StoredGameSnapshot
} from './game';

/** Default interval for periodic history snapshots (ms). */
export const HISTORY_RECORD_INTERVAL_MS = 30_000;

export type HistoryEntry = {
	id: number;
	createdAt: string;
	snapshot: StoredGameSnapshot;
};

const entries = writable<HistoryEntry[]>([]);
/** `null` = live play; `0..n-1` = replaying that history frame */
const sliderIndex = writable<number | null>(null);
/** Live board state captured when entering replay (restored on exit). */
const liveSnapshotCaptured = writable<StoredGameSnapshot | null>(null);

const historyLoadState = writable<'idle' | 'loading' | 'ready' | 'error'>('idle');
const historyLoadError = writable<string | null>(null);

export const gameHistoryEntries = { subscribe: entries.subscribe };
export const gameHistorySliderIndex = { subscribe: sliderIndex.subscribe };
export const gameHistoryLiveSnapshot = { subscribe: liveSnapshotCaptured.subscribe };
export const gameHistoryLoadState = { subscribe: historyLoadState.subscribe };
export const gameHistoryLoadError = { subscribe: historyLoadError.subscribe };

/** True while history panel has captured live state (read-only board). */
export const isHistoryReplayActive = derived(liveSnapshotCaptured, (c) => c !== null);

let lastRecordedSerialized: string | null = null;
let recordingLobbyId: string | null = null;
let recordingUserId: string | null = null;
let recordingSupabase: SupabaseClient | null = null;

/** Call after game is loaded so the first 30s tick does not duplicate unchanged state. */
export function initRecordingBaseline() {
	lastRecordedSerialized = stableSerialize(serializeGameState());
}

function stableSerialize(s: StoredGameSnapshot): string {
	return JSON.stringify(s);
}

export function configureHistoryRecording(opts: {
	lobbyId: string;
	userId: string;
	supabase: SupabaseClient;
}) {
	recordingLobbyId = opts.lobbyId;
	recordingUserId = opts.userId;
	recordingSupabase = opts.supabase;
}

/** Serialize current state and insert if it differs from the last recorded snapshot. */
export async function tryRecordHistorySnapshot(): Promise<void> {
	if (!recordingSupabase || !recordingLobbyId || !recordingUserId) return;
	if (get(liveSnapshotCaptured)) return;
	const st = serializeGameState();
	const serialized = stableSerialize(st);
	if (serialized === lastRecordedSerialized) return;

	const { data, error } = await recordingSupabase
		.from('game_history_snapshots')
		.insert({
			lobby_id: recordingLobbyId,
			snapshot: st as unknown as Json,
			saved_by: recordingUserId
		})
		.select('id, created_at')
		.single();

	if (error) {
		console.error('[bge] history record', error);
		return;
	}

	lastRecordedSerialized = serialized;
	const row = data as { id: number; created_at: string };
	entries.update((list) => [
		...list,
		{ id: row.id, createdAt: row.created_at, snapshot: st }
	]);
}

export async function loadHistoryFromDb(
	supabase: SupabaseClient,
	lobbyId: string
): Promise<void> {
	historyLoadState.set('loading');
	historyLoadError.set(null);
	const { data, error } = await supabase
		.from('game_history_snapshots')
		.select('id, created_at, snapshot')
		.eq('lobby_id', lobbyId)
		.order('created_at', { ascending: true });

	if (error) {
		historyLoadState.set('error');
		historyLoadError.set(error.message);
		console.error('[bge] history load', error);
		return;
	}

	const list: HistoryEntry[] = [];
	for (const row of data ?? []) {
		const snap = row.snapshot;
		if (!isStoredGameSnapshot(snap)) continue;
		list.push({
			id: row.id,
			createdAt: row.created_at,
			snapshot: snap
		});
	}
	entries.set(list);
	historyLoadState.set('ready');
}

function getEntryByIndex(index: number): HistoryEntry | undefined {
	return get(entries)[index];
}

function applyFrameAtIndex(index: number) {
	const e = getEntryByIndex(index);
	if (!e) return;
	applyStoredGameSnapshot(e.snapshot, { skipCenter: true });
}

function applyScrubIndex(index: number) {
	const list = get(entries);
	if (list.length === 0) return;
	const clamped = Math.max(0, Math.min(index, list.length - 1));
	sliderIndex.set(clamped);
	applyFrameAtIndex(clamped);
}

/** Open replay UI: load timeline from DB, capture live state, jump to latest frame. */
export async function openReplay(supabase: SupabaseClient, lobbyId: string): Promise<number> {
	if (get(liveSnapshotCaptured)) return -1;

	await loadHistoryFromDb(supabase, lobbyId);
	if (get(historyLoadState) === 'error') return -1;

	liveSnapshotCaptured.set(serializeGameState());
	const list = get(entries);
	if (list.length > 0) {
		const startIdx = list.length - 1;
		sliderIndex.set(startIdx);
		applyFrameAtIndex(startIdx);
		return startIdx;
	}
	sliderIndex.set(null);
	return 0;
}

export function exitReplay() {
	const live = get(liveSnapshotCaptured);
	sliderIndex.set(null);
	liveSnapshotCaptured.set(null);
	if (live) {
		applyStoredGameSnapshot(live);
	}
}

/** Local scrub — caller should `emit('history_scrub', { index })` (debounced). */
export function scrubToIndex(index: number) {
	applyScrubIndex(index);
}

/** Remote peer scrubbed the slider (no emit). */
export function scrubToIndexRemote(index: number) {
	applyScrubIndex(index);
}

/**
 * Another client opened history: load timeline, capture our live state, match their frame index.
 */
export async function syncOpenReplayFromRemote(
	supabase: SupabaseClient,
	lobbyId: string,
	index: number
): Promise<void> {
	await loadHistoryFromDb(supabase, lobbyId);
	if (get(historyLoadState) === 'error') return;

	if (get(liveSnapshotCaptured)) {
		scrubToIndexRemote(index);
		return;
	}

	liveSnapshotCaptured.set(serializeGameState());
	const list = get(entries);
	if (list.length === 0) {
		sliderIndex.set(null);
		return;
	}
	const clamped = Math.max(0, Math.min(index, list.length - 1));
	sliderIndex.set(clamped);
	applyFrameAtIndex(clamped);
}

export function remoteCloseReplay() {
	const live = get(liveSnapshotCaptured);
	sliderIndex.set(null);
	liveSnapshotCaptured.set(null);
	if (live) {
		applyStoredGameSnapshot(live);
	}
}

export async function restoreFromHistoryEntry(
	supabase: SupabaseClient,
	lobbyId: string,
	entryIndex: number,
	onPersistLive: () => void | Promise<void>
): Promise<boolean> {
	const list = get(entries);
	const e = list[entryIndex];
	if (!e) return false;

	const { error: delErr } = await supabase
		.from('game_history_snapshots')
		.delete()
		.eq('lobby_id', lobbyId)
		.gt('id', e.id);

	if (delErr) {
		console.error('[bge] history restore delete', delErr);
		return false;
	}

	entries.update((arr) => arr.filter((x) => x.id <= e.id));
	sliderIndex.set(null);
	liveSnapshotCaptured.set(null);
	applyStoredGameSnapshot(e.snapshot);
	lastRecordedSerialized = stableSerialize(serializeGameState());
	await onPersistLive();
	return true;
}

export async function remoteRestoreFromHistoryId(
	supabase: SupabaseClient,
	lobbyId: string,
	historyId: number,
	onPersistLive: () => void | Promise<void>
): Promise<void> {
	let entry = get(entries).find((x) => x.id === historyId);
	if (!entry) {
		await loadHistoryFromDb(supabase, lobbyId);
		entry = get(entries).find((x) => x.id === historyId);
	}
	if (!entry) return;

	const { error: delErr } = await supabase
		.from('game_history_snapshots')
		.delete()
		.eq('lobby_id', lobbyId)
		.gt('id', historyId);

	if (delErr) {
		console.error('[bge] history remote restore delete', delErr);
		return;
	}

	entries.update((arr) => arr.filter((x) => x.id <= historyId));
	sliderIndex.set(null);
	liveSnapshotCaptured.set(null);
	applyStoredGameSnapshot(entry.snapshot);
	lastRecordedSerialized = stableSerialize(serializeGameState());
	await onPersistLive();
}
