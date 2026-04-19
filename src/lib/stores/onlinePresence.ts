import { writable } from 'svelte/store';

export type PresenceStatus = 'online' | 'in_lobby' | 'in_game' | 'offline';

/** Rich presence metadata from global Realtime presence payloads. */
export type PresencePayload = {
	status: PresenceStatus;
	name?: string;
	lobby_id?: string;
	lobby_name?: string;
	game_key?: string;
};

/**
 * User ids seen online on `online:global` (back-compat for components that only need a Set).
 * @deprecated Prefer `presenceByUserId` for activity labels.
 */
export const onlineUserIds = writable<Set<string>>(new Set());

export const presenceByUserId = writable<Map<string, PresencePayload>>(new Map());

/**
 * Merged into global presence `track()` from lobby/play routes (status, lobby_id, game_key, …).
 */
export const selfPresenceMeta = writable<Record<string, unknown>>({});

export function presenceForUser(
	map: Map<string, PresencePayload>,
	userId: string
): PresencePayload | undefined {
	return map.get(userId);
}
