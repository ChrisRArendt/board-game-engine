import { writable } from 'svelte/store';

export type RollerLine = { text: string; time: string };

/** Shared dice-roller log (per die tab). Updated locally on roll and from Realtime on other players' rolls. */
export const rollerLog = writable<Record<string, RollerLine[]>>({});

const DISPLAY_TYPE: Record<string, string> = {
	diceroller_coin: 'coin',
	diceroller_d4: 'd4',
	diceroller_d6: 'd6',
	diceroller_d8: 'd8',
	diceroller_d10: 'd10',
	diceroller_d12: 'd12',
	diceroller_d20: 'd20',
	diceroller_percent: 'd%'
};

/** Human-readable line for multi-die rolls (e.g. `3d6: 2 + 4 + 5 = 11 (Alice)`). */
export function formatRollerRollText(
	rollId: string,
	results: (string | number)[],
	total: number | null,
	name?: string
): string {
	const typeLabel = DISPLAY_TYPE[rollId] ?? rollId.replace('diceroller_', '');
	const parts = results.map(String).join(' + ');
	let core: string;
	if (results.length <= 1) {
		core = `${typeLabel}: ${parts}`;
	} else {
		core = `${results.length}${typeLabel}: ${parts}`;
		if (total !== null) core += ` = ${total}`;
	}
	if (name) core += ` (${name})`;
	return core;
}

export type PoolSegment = {
	tab: string;
	results: (string | number)[];
	total: number | null;
};

/** One pool roll line: all die types, grand total, and per-face counts. */
export function formatPoolRollText(
	segments: PoolSegment[],
	grandTotal: number | null,
	faceCounts: Record<string, number>,
	name?: string
): string {
	const segParts = segments.map((s) => {
		const lbl = DISPLAY_TYPE[s.tab] ?? s.tab.replace('diceroller_', '');
		const n = s.results.length;
		const inner = s.results.map(String).join('+');
		if (n === 1) {
			return `${lbl}: ${inner}`;
		}
		return `${n}${lbl}: ${inner}${s.total !== null ? `=${s.total}` : ''}`;
	});
	const countStr = Object.entries(faceCounts)
		.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
		.map(([k, v]) => `${k}×${v}`)
		.join(', ');
	let core = `Pool: ${segParts.join(' · ')}`;
	if (grandTotal !== null) core += ` · Σ ${grandTotal}`;
	if (countStr) core += ` · ${countStr}`;
	if (name) core += ` (${name})`;
	return core;
}

export const POOL_LOG_KEY = 'diceroller_pool';

export function appendRollerLine(rollId: string, text: string, time: string): void {
	rollerLog.update((lines) => {
		const prev = lines[rollId] ?? [];
		return { ...lines, [rollId]: [{ text, time }, ...prev].slice(0, 50) };
	});
}

/** Append a roll using structured results (preferred for new roller). Also mirrors to pool log. */
export function appendRollerRoll(
	rollId: string,
	results: (string | number)[],
	total: number | null,
	time: string,
	name?: string
): void {
	const text = formatRollerRollText(rollId, results, total, name);
	appendRollerLine(rollId, text, time);
	appendRollerLine(POOL_LOG_KEY, text, time);
}

/** Multi-type pool roll (single log line). */
export function appendPoolRoll(
	segments: PoolSegment[],
	grandTotal: number | null,
	faceCounts: Record<string, number>,
	time: string,
	name?: string
): void {
	const text = formatPoolRollText(segments, grandTotal, faceCounts, name);
	appendRollerLine(POOL_LOG_KEY, text, time);
}

export function clearRollerLog(): void {
	rollerLog.set({});
}
