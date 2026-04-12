import { writable } from 'svelte/store';

export type RollerLine = { text: string; time: string };

/** Shared dice-roller log (per die tab). Updated locally on roll and from Realtime on other players' rolls. */
export const rollerLog = writable<Record<string, RollerLine[]>>({});

export function appendRollerLine(rollId: string, text: string, time: string): void {
	rollerLog.update((lines) => {
		const prev = lines[rollId] ?? [];
		return { ...lines, [rollId]: [{ text, time }, ...prev].slice(0, 50) };
	});
}

export function clearRollerLog(): void {
	rollerLog.set({});
}
