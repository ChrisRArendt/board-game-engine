import { writable } from 'svelte/store';

/** When set, root layout shows the mobile DM sheet for this conversation. */
export const dmSheetConversationId = writable<string | null>(null);
