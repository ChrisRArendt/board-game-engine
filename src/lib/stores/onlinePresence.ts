import { writable } from 'svelte/store';

/** User ids seen on the global `online:global` Realtime presence channel. */
export const onlineUserIds = writable<Set<string>>(new Set());
