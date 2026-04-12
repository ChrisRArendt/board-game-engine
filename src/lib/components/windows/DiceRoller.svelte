<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { get, writable } from 'svelte/store';
	import { pad } from '$lib/engine/geometry';
	import {
		computeGrandTotalFromDice,
		computeRollTotal,
		dieClipPathForTab,
		faceCountsFromDice,
		rollOneDie,
		type DieTabId,
		type RolledDie
	} from '$lib/engine/diceRoll';
	import { emit } from '$lib/stores/network';
	import {
		appendPoolRoll,
		appendRollerRoll,
		POOL_LOG_KEY,
		rollerLog,
		type PoolSegment
	} from '$lib/stores/rollerLog';

	const tabs: { id: DieTabId; label: string }[] = [
		{ id: 'diceroller_coin', label: 'Coin' },
		{ id: 'diceroller_d4', label: 'd4' },
		{ id: 'diceroller_d6', label: 'd6' },
		{ id: 'diceroller_d8', label: 'd8' },
		{ id: 'diceroller_d10', label: 'd10' },
		{ id: 'diceroller_d12', label: 'd12' },
		{ id: 'diceroller_d20', label: 'd20' },
		{ id: 'diceroller_percent', label: 'd%' }
	];

	/** Distinct fills so die types are easy to tell apart (no universal standard — high contrast). */
	const DIE_FACE_BG: Record<DieTabId, string> = {
		diceroller_coin: 'linear-gradient(145deg, #d4af6a, #a67c2e)',
		diceroller_d4: 'linear-gradient(145deg, #f0a8a8, #c45c5c)',
		diceroller_d6: 'linear-gradient(145deg, #a8e0a8, #4a9a4a)',
		diceroller_d8: 'linear-gradient(145deg, #a8c8f0, #3a6ab8)',
		diceroller_d10: 'linear-gradient(145deg, #e8c8f8, #8a4aaa)',
		diceroller_d12: 'linear-gradient(145deg, #ffe8a8, #d4a020)',
		diceroller_d20: 'linear-gradient(145deg, #c8f0f0, #2a8a8a)',
		diceroller_percent: 'linear-gradient(145deg, #e0e0e0, #909090)'
	};

	const STAGGER_MS = 350;
	const TUMBLE_MS = 600;
	const MAX_QTY = 10;

	/** Shown next to remote rolls so everyone knows who rolled */
	export let rollerName = 'Player';

	/** Store so +/- updates reliably re-render the count (plain `let` + object spread is flaky in Svelte 5). */
	const qtyByTab = writable<Record<string, number>>(
		Object.fromEntries(tabs.map((t) => [t.id, 0]))
	);

	/**
	 * Copy of per-tab counts from the last successful Roll (not changed by Reroll).
	 * Reroll uses this so you can tweak +/- for the next Roll without losing the last pool for Reroll.
	 * Reset clears this along with quantities.
	 */
	let lastPoolQtySnapshot: Record<string, number> | null = null;

	let rolling = false;
	/** Brief hint when Roll is pressed with no dice selected */
	let hintMessage = '';
	let displayDice: RolledDie[] = [];
	let displayGrandTotal: number | null = null;
	let displayFaceCounts: Record<string, number> = {};
	let tumbleKey = 0;

	$: faceCountPairs = Object.entries(displayFaceCounts).sort((a, b) =>
		a[0].localeCompare(b[0], undefined, { numeric: true })
	);

	/** After a roll, show "Reroll" on the main button until +/- changes away from the saved pool. */
	$: primaryButtonIsReroll = (() => {
		const snap = lastPoolQtySnapshot;
		if (!snap) return false;
		return tabs.every((t) => ($qtyByTab[t.id] ?? 0) === (snap[t.id] ?? 0));
	})();

	function primaryRollAction() {
		if (primaryButtonIsReroll) reroll();
		else roll();
	}

	function getQty(tab: DieTabId): number {
		const q = get(qtyByTab)[tab] ?? 0;
		return Math.min(MAX_QTY, Math.max(0, q));
	}

	function setQtyForTab(tab: DieTabId, delta: number) {
		qtyByTab.update((m) => {
			const cur = Math.min(MAX_QTY, Math.max(0, m[tab] ?? 0));
			const next = Math.min(MAX_QTY, Math.max(0, cur + delta));
			return { ...m, [tab]: next };
		});
	}

	/** Only dice with count &gt; 0 — no hidden “active die type” fallback. */
	function buildDiceFromQuantities(): RolledDie[] {
		const dice: RolledDie[] = [];
		for (const t of tabs) {
			const q = getQty(t.id);
			for (let i = 0; i < q; i++) {
				dice.push({ tab: t.id, value: rollOneDie(t.id) });
			}
		}
		return dice;
	}

	function buildDiceFromSnapshot(snapshot: Record<string, number>): RolledDie[] {
		const dice: RolledDie[] = [];
		for (const t of tabs) {
			const q = Math.min(MAX_QTY, Math.max(0, snapshot[t.id] ?? 0));
			for (let i = 0; i < q; i++) {
				dice.push({ tab: t.id, value: rollOneDie(t.id) });
			}
		}
		return dice;
	}

	function captureSnapshotFromCurrentQty() {
		lastPoolQtySnapshot = Object.fromEntries(tabs.map((t) => [t.id, getQty(t.id)]));
	}

	function resetQuantities() {
		if (rolling) return;
		lastPoolQtySnapshot = null;
		qtyByTab.set(Object.fromEntries(tabs.map((t) => [t.id, 0])));
		hintMessage = '';
		displayDice = [];
		displayGrandTotal = null;
		displayFaceCounts = {};
		tumbleKey += 1;
	}

	function groupSegments(dice: RolledDie[]): PoolSegment[] {
		const byTab = new Map<DieTabId, (string | number)[]>();
		for (const d of dice) {
			const arr = byTab.get(d.tab) ?? [];
			arr.push(d.value);
			byTab.set(d.tab, arr);
		}
		const out: PoolSegment[] = [];
		for (const t of tabs) {
			const results = byTab.get(t.id);
			if (!results?.length) continue;
			out.push({
				tab: t.id,
				results,
				total: computeRollTotal(t.id, results)
			});
		}
		return out;
	}

	function nowTimeStr(): string {
		const d = new Date();
		return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;
	}

	function runRollAnimation(
		dice: RolledDie[],
		grandTotal: number | null,
		faceCounts: Record<string, number>
	) {
		rolling = true;
		displayDice = [...dice];
		displayGrandTotal = grandTotal;
		displayFaceCounts = { ...faceCounts };
		tumbleKey += 1;

		const n = dice.length;
		const elapsed = Math.max(0, (n - 1) * STAGGER_MS + TUMBLE_MS);
		setTimeout(() => {
			rolling = false;
		}, elapsed);
	}

	function commitRoll(dice: RolledDie[]) {
		const segments = groupSegments(dice);
		const grandTotal = computeGrandTotalFromDice(dice);
		const faceCounts = faceCountsFromDice(dice);
		const datestr = nowTimeStr();

		if (segments.length > 1) {
			appendPoolRoll(segments, grandTotal, faceCounts, datestr, rollerName);
		} else {
			const s = segments[0];
			appendRollerRoll(s.tab, s.results, s.total, datestr, rollerName);
		}

		emit('window_roller_roll', {
			kind: 'pool',
			dice,
			segments,
			grandTotal,
			faceCounts,
			datestr,
			name: rollerName
		});
		runRollAnimation(dice, grandTotal, faceCounts);
	}

	/** Uses current +/- counts, then saves that mix as the snapshot for Reroll. */
	function roll() {
		if (rolling) return;
		const dice = buildDiceFromQuantities();
		if (dice.length === 0) {
			hintMessage = 'Use + on one or more die types first.';
			setTimeout(() => {
				hintMessage = '';
			}, 2800);
			return;
		}
		hintMessage = '';
		commitRoll(dice);
		captureSnapshotFromCurrentQty();
	}

	/** Re-rolls the same die mix as the last Roll (snapshot). Before any Roll, behaves like Roll. */
	function reroll() {
		if (rolling) return;
		if (!lastPoolQtySnapshot) {
			roll();
			return;
		}
		const dice = buildDiceFromSnapshot(lastPoolQtySnapshot);
		if (dice.length === 0) {
			hintMessage = 'Saved pool is empty — use Roll or Reset.';
			setTimeout(() => {
				hintMessage = '';
			}, 2800);
			return;
		}
		hintMessage = '';
		commitRoll(dice);
	}

	function onRemoteRollerRoll(ev: Event) {
		const d = (ev as CustomEvent).detail as {
			kind?: string;
			dice?: RolledDie[];
			segments?: PoolSegment[];
			grandTotal?: number | null;
			faceCounts?: Record<string, number>;
			rollId?: string;
			results?: (string | number)[];
			total?: number | null;
			result?: string | number;
			datestr?: string;
			name?: string;
		};
		if (!d?.datestr) return;

		if (d.kind === 'pool' && Array.isArray(d.dice) && d.dice.length > 0) {
			const grandTotal =
				d.grandTotal !== undefined && d.grandTotal !== null
					? d.grandTotal
					: computeGrandTotalFromDice(d.dice);
			const faceCounts =
				d.faceCounts && Object.keys(d.faceCounts).length > 0
					? d.faceCounts
					: faceCountsFromDice(d.dice);
			runRollAnimation(d.dice, grandTotal, faceCounts);
			return;
		}

		if (Array.isArray(d.results) && d.results.length > 0 && d.rollId) {
			const tab = d.rollId as DieTabId;
			const dice: RolledDie[] = d.results.map((value) => ({ tab, value }));
			const grandTotal =
				d.total !== undefined && d.total !== null
					? d.total
					: computeRollTotal(tab, d.results);
			const faceCounts = faceCountsFromDice(dice);
			runRollAnimation(dice, grandTotal, faceCounts);
			return;
		}

		if (d.result !== undefined && d.rollId) {
			const tab = d.rollId as DieTabId;
			const dice: RolledDie[] = [{ tab, value: d.result }];
			runRollAnimation(
				dice,
				computeRollTotal(tab, [d.result]),
				faceCountsFromDice(dice)
			);
		}
	}

	onMount(() => {
		window.addEventListener('bge:roller_roll', onRemoteRollerRoll);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('bge:roller_roll', onRemoteRollerRoll);
		}
	});

	function pipCells(n: number): boolean[] {
		const g = Array(9).fill(false);
		switch (n) {
			case 1:
				g[4] = true;
				break;
			case 2:
				g[0] = g[8] = true;
				break;
			case 3:
				g[0] = g[4] = g[8] = true;
				break;
			case 4:
				g[0] = g[2] = g[6] = g[8] = true;
				break;
			case 5:
				g[0] = g[2] = g[4] = g[6] = g[8] = true;
				break;
			case 6:
				g[0] = g[3] = g[6] = g[2] = g[5] = g[8] = true;
				break;
			default:
				g[4] = true;
		}
		return g;
	}
</script>

<div class="roller">
	<div class="tabs-row">
		<div class="tab-grid">
			{#each tabs as t}
				<div class="tab-cell">
					<span class="tab-label">{t.label}</span>
					<div class="tab-qty">
						<button
							type="button"
							class="qty-btn"
							disabled={rolling}
							onclick={() => setQtyForTab(t.id, -1)}
						>
							−
						</button>
						<span class="qty-val"
							>{Math.min(
								MAX_QTY,
								Math.max(0, $qtyByTab[t.id] ?? 0)
							)}</span
						>
						<button
							type="button"
							class="qty-btn"
							disabled={rolling}
							onclick={() => setQtyForTab(t.id, 1)}
						>
							+
						</button>
					</div>
				</div>
			{/each}
		</div>
		<div class="action-buttons">
			<button type="button" class="rollbtn" disabled={rolling} onclick={primaryRollAction}>
				{primaryButtonIsReroll ? 'Reroll' : 'Roll'}
			</button>
			<button type="button" class="rollbtn resetbtn" disabled={rolling} onclick={resetQuantities}>
				Reset
			</button>
		</div>
	</div>

	<div class="body">
		{#if hintMessage}
			<div class="hint-banner">{hintMessage}</div>
		{/if}
		<div class="dice-stage" style="perspective: 800px">
			{#if displayDice.length > 0}
				{#key tumbleKey}
					<div class="dice-row">
						{#each displayDice as d, i (i)}
							<div
								class="die-wrap"
								class:coin={d.tab === 'diceroller_coin'}
								style:animation-delay="{i * STAGGER_MS}ms"
							>
								<div
									class="die-face"
									style:clip-path={d.tab === 'diceroller_coin'
										? 'none'
										: dieClipPathForTab(d.tab)}
									style:background={DIE_FACE_BG[d.tab]}
									class:is-coin={d.tab === 'diceroller_coin'}
								>
									{#if d.tab === 'diceroller_d6' && typeof d.value === 'number' && d.value >= 1 && d.value <= 6}
										<div class="pip-grid">
											{#each pipCells(d.value) as pipOn, j (j)}
												<span class="pip-cell" class:pip-on={pipOn}></span>
											{/each}
										</div>
									{:else}
										<span class="die-val">{d.value}</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/key}
				{#if displayGrandTotal !== null}
					<div class="total-line">Total: <strong>{displayGrandTotal}</strong></div>
				{/if}
				{#if faceCountPairs.length > 0}
					<div class="counts-line">
						<span class="counts-label">By face:</span>
						{#each faceCountPairs as [k, v] (k)}
							<span class="count-chip">{k}×{v}</span>
						{/each}
					</div>
				{/if}
			{:else}
				<div class="dice-placeholder">
					Set counts with +/−, then use the main button: it says <strong>Roll</strong> when counts
					changed (or first time), and <strong>Reroll</strong> after a roll until you change +/−.
					<strong>Reset</strong> clears counts and the saved mix.
				</div>
			{/if}
		</div>
		<div class="log">
			{#each $rollerLog[POOL_LOG_KEY] ?? [] as line}
				<p><span>{line.text}</span> <span class="muted">at {line.time}</span></p>
			{/each}
		</div>
	</div>
</div>

<style>
	.roller {
		width: min(420px, 92vw);
	}
	.tabs-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 10px;
	}
	.tab-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}
	.tab-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 4px 6px;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: #fafafa;
	}
	.tab-label {
		font-size: 11px;
		padding: 2px 4px;
		font-weight: 600;
		color: #333;
		user-select: none;
	}
	.tab-qty {
		display: flex;
		align-items: center;
		gap: 2px;
		font-size: 11px;
	}
	.qty-btn {
		width: 20px;
		height: 20px;
		padding: 0;
		cursor: pointer;
		font-weight: bold;
		font-size: 12px;
		line-height: 1;
	}
	.qty-val {
		min-width: 1rem;
		text-align: center;
		font-weight: 600;
	}
	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex: 0 0 auto;
		align-self: flex-start;
	}
	.rollbtn {
		min-width: 88px;
		padding: 8px 12px;
		cursor: pointer;
		font-weight: 700;
		font-size: 13px;
		border-radius: 4px;
		border: 1px solid #bbb;
		background: linear-gradient(to bottom, #f5f5f5, #e0e0e0);
	}
	.rollbtn.resetbtn {
		font-weight: 600;
		background: linear-gradient(to bottom, #fafafa, #eaeaea);
		color: #444;
	}
	.rollbtn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.hint-banner {
		font-size: 12px;
		color: #a63;
		font-weight: 600;
		padding: 4px 0;
	}
	.dice-stage {
		min-height: 108px;
		padding: 4px 0;
	}
	.dice-placeholder {
		font-size: 12px;
		color: #666;
		line-height: 1.4;
		padding: 8px 0;
	}
	.dice-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.die-wrap {
		width: 52px;
		height: 52px;
		flex-shrink: 0;
		animation: tumble 0.6s ease-out forwards;
		opacity: 0;
		transform-style: preserve-3d;
	}
	.die-wrap.coin {
		border-radius: 50%;
	}
	@keyframes tumble {
		0% {
			opacity: 0;
			transform: rotateY(0deg) scale(0.35);
		}
		100% {
			opacity: 1;
			transform: rotateY(720deg) scale(1);
		}
	}
	.die-face {
		width: 100%;
		height: 100%;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.45),
			0 2px 6px rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.die-face.is-coin {
		border-radius: 50%;
		clip-path: none !important;
	}
	.die-val {
		font-size: 13px;
		font-weight: 800;
		color: #111;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
	}
	.pip-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		width: 70%;
		height: 70%;
		gap: 2px;
	}
	.pip-cell {
		border-radius: 50%;
		background: transparent;
	}
	.pip-cell.pip-on {
		background: radial-gradient(circle at 30% 30%, #222, #000);
		box-shadow: inset 0 -1px 1px rgba(0, 0, 0, 0.5);
	}
	.total-line {
		font-size: 13px;
		margin-top: 6px;
		color: #333;
	}
	.counts-line {
		font-size: 12px;
		margin-top: 4px;
		color: #444;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.counts-label {
		font-weight: 600;
		margin-right: 4px;
	}
	.count-chip {
		background: #eef3f8;
		border: 1px solid #ccd8e4;
		border-radius: 4px;
		padding: 1px 6px;
		font-variant-numeric: tabular-nums;
	}
	.log {
		overflow: auto;
		font-size: 12px;
		max-height: 140px;
		border-top: 1px solid #eee;
		padding-top: 6px;
	}
	.log p {
		margin: 2px 0;
	}
	.muted {
		color: #999;
		font-size: 0.85em;
	}
</style>
