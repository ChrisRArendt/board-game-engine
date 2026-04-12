import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';

const LS_MIC = 'bge_voice_mic_device';
const LS_SPEAKER = 'bge_voice_speaker_device';
const LS_INPUT_GAIN = 'bge_voice_input_gain';

function loadStr(key: string, fallback: string): string {
	if (!browser) return fallback;
	return localStorage.getItem(key) ?? fallback;
}

function loadGain(): number {
	if (!browser) return 1;
	const v = parseFloat(localStorage.getItem(LS_INPUT_GAIN) ?? '1');
	if (Number.isNaN(v) || v < 0 || v > 2) return 1;
	return v;
}

export type VoiceDevicePrefs = {
	preferredMicId: string;
	preferredSpeakerId: string;
	/** 0–2 linear gain applied to mic before sending */
	inputGain: number;
};

export const voiceDevicePrefs = writable<VoiceDevicePrefs>({
	preferredMicId: loadStr(LS_MIC, ''),
	preferredSpeakerId: loadStr(LS_SPEAKER, ''),
	inputGain: loadGain()
});

export function persistVoiceDevicePrefs(partial: Partial<VoiceDevicePrefs>) {
	voiceDevicePrefs.update((cur) => {
		const next = { ...cur, ...partial };
		if (browser) {
			if (partial.preferredMicId !== undefined)
				localStorage.setItem(LS_MIC, next.preferredMicId);
			if (partial.preferredSpeakerId !== undefined)
				localStorage.setItem(LS_SPEAKER, next.preferredSpeakerId);
			if (partial.inputGain !== undefined)
				localStorage.setItem(LS_INPUT_GAIN, String(next.inputGain));
		}
		return next;
	});
}

/** Per-friend volume (0–2) and mute; merged with DB rows */
export type FriendVoicePref = { volume: number; muted: boolean };

export const friendVoicePrefs = writable<Record<string, FriendVoicePref>>({});

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: Map<string, FriendVoicePref> | null = null;
let supabaseRef: SupabaseClient<Database> | null = null;

export function registerFriendVoiceSaver(client: SupabaseClient<Database> | null) {
	supabaseRef = client;
}

function queueSave(userId: string, friendId: string, pref: FriendVoicePref) {
	if (!supabaseRef || !userId) return;
	if (!pendingSave) pendingSave = new Map();
	pendingSave.set(friendId, pref);
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(() => {
		saveTimer = null;
		const batch = pendingSave;
		pendingSave = null;
		if (!batch || !supabaseRef) return;
		void (async () => {
			for (const [fid, p] of batch) {
				const { error } = await supabaseRef!.from('friend_voice_settings').upsert(
					{
						user_id: userId,
						friend_id: fid,
						volume: p.volume,
						muted: p.muted
					},
					{ onConflict: 'user_id,friend_id' }
				);
				if (error) console.warn('[bge] friend_voice_settings upsert', error);
			}
		})();
	}, 400);
}

/**
 * Set local preference for how loud a remote peer is (0–2) and optional mute.
 * Persists to DB when signed in.
 */
export function setFriendVoicePref(
	selfUserId: string,
	friendId: string,
	partial: Partial<FriendVoicePref>
) {
	friendVoicePrefs.update((cur) => {
		const prev = cur[friendId] ?? { volume: 1, muted: false };
		const next = { ...prev, ...partial };
		const out = { ...cur, [friendId]: next };
		queueSave(selfUserId, friendId, next);
		return out;
	});
}

export function getEffectivePeerVolume(friendId: string): number {
	const p = get(friendVoicePrefs)[friendId];
	if (!p) return 1;
	if (p.muted) return 0;
	return p.volume;
}

export async function loadFriendVoicePrefsFromSupabase(
	supabase: SupabaseClient<Database>,
	userId: string
) {
	const { data, error } = await supabase.from('friend_voice_settings').select('*').eq('user_id', userId);
	if (error) {
		console.warn('[bge] loadFriendVoicePrefs', error);
		return;
	}
	const map: Record<string, FriendVoicePref> = {};
	for (const row of data ?? []) {
		map[row.friend_id] = {
			volume: typeof row.volume === 'number' ? row.volume : 1,
			muted: !!row.muted
		};
	}
	friendVoicePrefs.set(map);
}
