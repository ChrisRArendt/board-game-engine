import { writable } from 'svelte/store';

/** Unread notification count for nav badge (synced via layout + inbox). */
export const unreadNotificationCount = writable(0);
