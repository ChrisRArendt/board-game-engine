/** CSS clip-path for a regular N-gon (percent coords), first vertex at top */
export function regularPolygonClipPath(sides: number): string {
	if (sides < 3) return 'none';
	const pts: string[] = [];
	for (let i = 0; i < sides; i++) {
		const a = (i / sides) * 2 * Math.PI - Math.PI / 2;
		const x = 50 + 50 * Math.cos(a);
		const y = 50 + 50 * Math.sin(a);
		pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
	}
	return `polygon(${pts.join(', ')})`;
}

export type DieTabId =
	| 'diceroller_coin'
	| 'diceroller_d4'
	| 'diceroller_d6'
	| 'diceroller_d8'
	| 'diceroller_d10'
	| 'diceroller_d12'
	| 'diceroller_d20'
	| 'diceroller_percent';

export function rollOneDie(tab: DieTabId): string | number {
	switch (tab) {
		case 'diceroller_coin':
			return Math.random() < 0.5 ? 'heads' : 'tails';
		case 'diceroller_d4':
			return 1 + Math.floor(Math.random() * 4);
		case 'diceroller_d6':
			return 1 + Math.floor(Math.random() * 6);
		case 'diceroller_d8':
			return 1 + Math.floor(Math.random() * 8);
		case 'diceroller_d10':
			return 1 + Math.floor(Math.random() * 10);
		case 'diceroller_d12':
			return 1 + Math.floor(Math.random() * 12);
		case 'diceroller_d20':
			return 1 + Math.floor(Math.random() * 20);
		case 'diceroller_percent':
			return `${Math.floor(Math.random() * 10)}0`;
		default:
			return '?';
	}
}

/** Sum for numeric dice; null for coin-only or non-numeric mixes */
export function computeRollTotal(tab: DieTabId, results: (string | number)[]): number | null {
	if (tab === 'diceroller_coin') return null;
	const nums = results.map((r) => {
		if (typeof r === 'number') return r;
		const n = parseInt(String(r), 10);
		return Number.isFinite(n) ? n : NaN;
	});
	if (nums.some((n) => !Number.isFinite(n))) return null;
	return nums.reduce((a, b) => a + b, 0);
}

/**
 * Clip-path for each die: polygon side count matches the die size (d8 = octagon, d6 = hexagon, etc.).
 * Coin uses circle (handled in Svelte with border-radius). d10 uses a readable kite; others use regular N-gons.
 */
export function dieClipPathForTab(tab: DieTabId): string {
	switch (tab) {
		case 'diceroller_coin':
			return 'none';
		case 'diceroller_d4':
			return regularPolygonClipPath(4);
		case 'diceroller_d6':
			return regularPolygonClipPath(6);
		case 'diceroller_d8':
			return regularPolygonClipPath(8);
		case 'diceroller_d10':
			return regularPolygonClipPath(10);
		case 'diceroller_d12':
			return regularPolygonClipPath(12);
		case 'diceroller_d20':
			return regularPolygonClipPath(20);
		case 'diceroller_percent':
			return regularPolygonClipPath(10);
		default:
			return regularPolygonClipPath(6);
	}
}

export type RolledDie = { tab: DieTabId; value: string | number };

/** Sum numeric dice in a pool (skips coins). Percent strings parse as integers. */
export function computeGrandTotalFromDice(dice: RolledDie[]): number | null {
	let sum = 0;
	let any = false;
	for (const d of dice) {
		if (d.tab === 'diceroller_coin') continue;
		const n = typeof d.value === 'number' ? d.value : parseInt(String(d.value), 10);
		if (Number.isFinite(n)) {
			sum += n;
			any = true;
		}
	}
	return any ? sum : null;
}

/** Count how many times each face value appeared (string keys). */
export function faceCountsFromDice(dice: RolledDie[]): Record<string, number> {
	const c: Record<string, number> = {};
	for (const d of dice) {
		const k = String(d.value);
		c[k] = (c[k] ?? 0) + 1;
	}
	return c;
}
