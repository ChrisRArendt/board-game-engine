import { writable } from 'svelte/store';
import type { UserEntry } from '$lib/engine/types';

export const users = writable<UserEntry[]>([]);
