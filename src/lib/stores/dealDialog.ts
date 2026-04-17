import { writable } from 'svelte/store';
import type { StashRosterEntry } from '$lib/engine/stash';
import { boardPointerBlocked } from '$lib/stores/boardPointerBlock';

export type DealDialogState = {
	open: boolean;
	roster: StashRosterEntry[];
	maxCards: number;
	reducedMotion: boolean;
};

const empty: DealDialogState = {
	open: false,
	roster: [],
	maxCards: 0,
	reducedMotion: false
};

export const dealDialog = writable<DealDialogState>(empty);

export function openDealDialog(snapshot: Omit<DealDialogState, 'open'>): void {
	boardPointerBlocked.set(true);
	dealDialog.set({ ...snapshot, open: true });
}

export function closeDealDialog(): void {
	boardPointerBlocked.set(false);
	dealDialog.set(empty);
}
