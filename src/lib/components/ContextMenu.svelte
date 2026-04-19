<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import { hasAttr, pieceSupportsFlip } from '$lib/engine/pieces';
	import ArrangementControls from '$lib/components/ArrangementControls.svelte';
	import { users } from '$lib/stores/users';
	import { settings } from '$lib/stores/settings';
	import {
		activeUserId,
		getLocalPlayerColor,
		playerColorOverrides,
		playerOrder
	} from '$lib/stores/network';
	import { buildStashRoster, canSelectPieceForViewer } from '$lib/engine/stash';
	import { openDealDialog } from '$lib/stores/dealDialog';
	import { selectablePiecesHitAtClient } from '$lib/engine/pileSelect';
	import type { PieceInstance } from '$lib/engine/types';
	import { isHistoryReplayActive } from '$lib/stores/history';
	import PlayAssistActionIcon from '$lib/components/icons/PlayAssistActionIcon.svelte';

	export let open = false;
	export let x = 0;
	export let y = 0;
	export let selfDisplayName = 'You';

	/** Fallbacks before `menuEl` is measured (real menu is often taller than 400px with Arrange). */
	const MENU_W_FALLBACK = 248;
	const MENU_H_FALLBACK = 400;

	let menuEl: HTMLUListElement | undefined;
	let clip = { left: 0, top: 0 };

	let pilePickCountStr = '1';
	let pilePickEnd: 'top' | 'bottom' = 'top';
	let prevPileMenuSnap = '';

	/** Root lists shortcuts; `pile` / `arrange` show full controls + Back. */
	let ctxMenuStep: 'root' | 'pile' | 'arrange' = 'root';
	$: if (!open) ctxMenuStep = 'root';

	function prefersReducedMotion(): boolean {
		if (!browser || typeof matchMedia === 'undefined') return false;
		return matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	$: stashRoster = (() => {
		$settings;
		$users;
		$playerOrder;
		$playerColorOverrides;
		if (!$activeUserId) return [];
		return buildStashRoster({
			selfUserId: $activeUserId,
			selfDisplayName,
			selfColor: getLocalPlayerColor(),
			users: $users,
			playerOrder: $playerOrder,
			playerColorOverrides: $playerColorOverrides
		});
	})();

	$: pileHitPieces =
		open && browser && $activeUserId != null
			? selectablePiecesHitAtClient(x, y, $game.pieces, (p: PieceInstance) =>
					canSelectPieceForViewer(
						p,
						stashRoster,
						$activeUserId!,
						get(isHistoryReplayActive),
						$game.playerSlots
					)
				)
			: [];

	$: showPilePick = pileHitPieces.length >= 2;

	$: pileMenuSnap =
		open && showPilePick ? `${x},${y},${pileHitPieces.map((p) => p.id).join(',')}` : '';
	$: if (open && showPilePick && pileMenuSnap !== prevPileMenuSnap) {
		prevPileMenuSnap = pileMenuSnap;
		pilePickEnd = 'top';
		pilePickCountStr = String(Math.min(3, pileHitPieces.length));
	}
	$: if (!open) prevPileMenuSnap = '';

	/** Double − / ++ buttons: step by 2 (single + / − step by 1). */
	const PILE_COUNT_COARSE = 2;

	function pileCountMax(): number {
		return Math.max(1, pileHitPieces.length);
	}

	function parsePileCount(): number {
		const max = pileCountMax();
		return Math.min(Math.max(1, parseInt(pilePickCountStr, 10) || 1), max);
	}

	function setPileCount(n: number) {
		const max = pileCountMax();
		pilePickCountStr = String(Math.min(max, Math.max(1, Math.round(n))));
	}

	function adjustPileCount(delta: number) {
		setPileCount(parsePileCount() + delta);
	}

	function applyPilePick() {
		const ordered = pileHitPieces.map((p) => p.id);
		const max = ordered.length;
		const n = Math.min(Math.max(1, parseInt(pilePickCountStr, 10) || 1), max);
		const pick = pilePickEnd === 'top' ? ordered.slice(-n) : ordered.slice(0, n);
		g.replaceSelectionWithPieceIds(pick);
		open = false;
	}

	function fitMenuToViewport() {
		if (!browser || !menuEl) return;
		const pad = 8;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const w = menuEl?.offsetWidth ?? MENU_W_FALLBACK;
		const h = menuEl?.offsetHeight ?? MENU_H_FALLBACK;
		const maxL = Math.max(pad, vw - w - pad);
		const maxT = Math.max(pad, vh - h - pad);
		clip = {
			left: Math.min(Math.max(pad, x), maxL),
			top: Math.min(Math.max(pad, y), maxT)
		};
	}

	$: sel = $game.pieces.filter((p) => $game.selectedIds.has(p.id));
	$: arrangeUnlockedCount = [...$game.selectedIds].filter((id) => {
		const p = $game.pieces.find((x) => x.id === id);
		return p != null && !p.locked;
	}).length;
	$: showFlip = sel.some((p) => pieceSupportsFlip(p));
	$: showArrange = sel.length > 1 && sel.every((p) => hasAttr(p, 'move'));
	$: if (open && ctxMenuStep === 'pile' && !showPilePick) ctxMenuStep = 'root';
	$: if (open && ctxMenuStep === 'arrange' && !showArrange) ctxMenuStep = 'root';
	$: showShuffle =
		sel.length > 1 &&
		sel.every((p) => hasAttr(p, 'move')) &&
		arrangeUnlockedCount >= 2;
	/** Same eligibility as Shuffle — reorder identities by piece type without moving slots. */
	$: showGroupByType = showShuffle;
	/** Deal is for multi-card distribution; a single card is easier to drag. */
	$: showDeal =
		sel.length >= 2 && sel.every((p) => hasAttr(p, 'move')) && stashRoster.length > 0;

	$: arrangeFlipCapableCount = sel.filter((p) => pieceSupportsFlip(p)).length;

	$: showSpacerAfterDeal =
		showDeal && (showFlip || showShuffle || showGroupByType || showArrange);
	$: showSpacerAfterFlip =
		showFlip && (showShuffle || showGroupByType || showArrange);

	/** Spacer after “Pick from stack” entry when more root rows follow. */
	$: showSpacerAfterPickEntry =
		showPilePick && (showDeal || showFlip || showShuffle || showGroupByType || showArrange);

	/** Reposition after mount / when pointer or menu content changes / resize. */
	$: if (
		browser &&
		open &&
		(showPilePick || showFlip || showShuffle || showGroupByType || showArrange || showDeal)
	) {
		void x;
		void y;
		void ctxMenuStep;
		void showPilePick;
		void showDeal;
		void showFlip;
		void showShuffle;
		void showGroupByType;
		void showArrange;
		void stashRoster;
		tick().then(() =>
			requestAnimationFrame(() => {
				fitMenuToViewport();
				requestAnimationFrame(fitMenuToViewport);
			})
		);
	}

	onMount(() => {
		if (!browser) return;
		const onResize = () => requestAnimationFrame(fitMenuToViewport);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

</script>

{#if open && (showPilePick || showFlip || showShuffle || showGroupByType || showArrange || showDeal)}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions a11y_no_static_element_interactions -->
	<ul
		bind:this={menuEl}
		class="ctx"
		data-bge-context-menu
		style:top="{clip.top}px"
		style:left="{clip.left}px"
		onclick={(e) => e.stopPropagation()}
		onpointerdown={(e) => e.stopPropagation()}
	>
		{#if ctxMenuStep === 'root'}
			{#if showPilePick}
				<li class="ctx-action" role="presentation">
					<button type="button" class="ctx-action-btn" onclick={() => (ctxMenuStep = 'pile')}>
						<PlayAssistActionIcon kind="stack" size={18} />
						<span class="ctx-action-label">Pick from stack</span>
					</button>
				</li>
				{#if showSpacerAfterPickEntry}
					<li class="spacer"></li>
				{/if}
			{/if}
			{#if showDeal}
			<li class="ctx-action" role="presentation">
				<button
					type="button"
					class="ctx-action-btn"
					onclick={() => {
						openDealDialog({
							roster: stashRoster,
							maxCards: sel.filter((p) => hasAttr(p, 'move')).length,
							reducedMotion: prefersReducedMotion()
						});
						/** Close after click so release does not hit the board (would deselect → “no cards”). */
						setTimeout(() => {
							open = false;
						}, 0);
					}}
				>
					<PlayAssistActionIcon kind="deal" size={18} />
					<span class="ctx-action-label">Deal to…</span>
				</button>
			</li>
		{/if}
		{#if showSpacerAfterDeal}
			<li class="spacer"></li>
		{/if}
		{#if showFlip}
			<li class="ctx-action" role="presentation">
				<button
					type="button"
					class="ctx-action-btn"
					onclick={() => {
						g.flipSelectedPiecesSync();
						open = false;
					}}
				>
					<PlayAssistActionIcon kind="flip" size={18} />
					<span class="ctx-action-label">
						{sel.filter((p) => pieceSupportsFlip(p)).length > 1 ? 'Flip all' : 'Flip'}
					</span>
				</button>
			</li>
		{/if}
		{#if showSpacerAfterFlip}
			<li class="spacer"></li>
		{/if}
		{#if showShuffle}
			<li class="ctx-action" role="presentation">
				<button
					type="button"
					class="ctx-action-btn"
					onclick={() => {
						g.runShuffleMovableSelection();
						open = false;
					}}
				>
					<PlayAssistActionIcon kind="shuffle" size={18} />
					<span class="ctx-action-label">Shuffle</span>
				</button>
			</li>
		{/if}
		{#if showShuffle && (showGroupByType || showArrange)}
			<li class="spacer"></li>
		{/if}
		{#if showGroupByType}
			<li class="ctx-action" role="presentation">
				<button
					type="button"
					class="ctx-action-btn"
					title="Same layout as now — only swaps which piece sits in which slot, ordered by piece type along the spread. Unsaved boards use size as type hint."
					onclick={() => {
						g.runArrangeGroupByPieceType();
						open = false;
					}}
				>
					<PlayAssistActionIcon kind="sort" size={18} />
					<span class="ctx-action-label">Sort by type</span>
				</button>
			</li>
		{/if}
		{#if showGroupByType && showArrange}
			<li class="spacer"></li>
		{/if}
			{#if showArrange}
				<li class="ctx-action" role="presentation">
					<button type="button" class="ctx-action-btn" onclick={() => (ctxMenuStep = 'arrange')}>
						<PlayAssistActionIcon kind="spreadRow" size={18} />
						<span class="ctx-action-label">Arrange</span>
					</button>
				</li>
			{/if}
		{:else if ctxMenuStep === 'pile'}
			<li class="ctx-back-row">
				<button type="button" class="ctx-submenu-back" onclick={() => (ctxMenuStep = 'root')}>
					← Back
				</button>
			</li>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li class="embed pile-embed" onpointerdown={(e) => e.stopPropagation()}>
				<p class="embed-title">Pick from stack</p>
				<div class="pile-controls">
					<label class="pile-count">
						<span>Count</span>
						<div class="pile-count-row">
							<button
								type="button"
								class="pile-step"
								aria-label={`Decrease count by ${PILE_COUNT_COARSE}`}
								disabled={parsePileCount() <= 1}
								onclick={() => adjustPileCount(-PILE_COUNT_COARSE)}
							>
								-{'\u00A0'}-
							</button>
							<input
								type="number"
								class="pile-count-input"
								min="1"
								max={pileHitPieces.length}
								bind:value={pilePickCountStr}
							/>
							<button
								type="button"
								class="pile-step"
								aria-label="Increase count by one"
								disabled={parsePileCount() >= pileCountMax()}
								onclick={() => adjustPileCount(1)}
							>
								+
							</button>
							<button
								type="button"
								class="pile-step"
								aria-label={`Increase count by ${PILE_COUNT_COARSE}`}
								disabled={parsePileCount() >= pileCountMax()}
								onclick={() => adjustPileCount(PILE_COUNT_COARSE)}
							>
								++
							</button>
						</div>
					</label>
					<div class="segmented" role="group" aria-label="From top or bottom of stack">
						<button
							type="button"
							class:active={pilePickEnd === 'top'}
							onclick={() => (pilePickEnd = 'top')}
						>
							Top
						</button>
						<button
							type="button"
							class:active={pilePickEnd === 'bottom'}
							onclick={() => (pilePickEnd = 'bottom')}
						>
							Bottom
						</button>
					</div>
				</div>
				<button type="button" class="pile-apply" onclick={applyPilePick}>
					<PlayAssistActionIcon kind="stack" size={18} />
					<span class="ctx-action-label">Select</span>
				</button>
			</li>
		{:else if ctxMenuStep === 'arrange'}
			<li class="ctx-back-row">
				<button type="button" class="ctx-submenu-back" onclick={() => (ctxMenuStep = 'root')}>
					← Back
				</button>
			</li>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li class="embed" onpointerdown={(e) => e.stopPropagation()}>
				<p class="embed-title">Arrange</p>
				<ArrangementControls
					compact
					contextMenu
					showNoFlipSubhint={false}
					gapPresetMode
					useSelectionUnlockedHint
					unlockedCount={arrangeUnlockedCount}
					selectedCount={$game.selectedIds.size}
					flipCapableCount={arrangeFlipCapableCount}
					onAfterApply={() => (open = false)}
				/>
			</li>
		{/if}
	</ul>
{/if}

<style>
	.ctx {
		display: block;
		position: fixed;
		list-style: none;
		background: var(--color-context-bg);
		border: 1px solid var(--color-border-strong);
		z-index: 2000000003;
		box-shadow: var(--shadow-md);
		border-radius: 3px;
		padding: 2px 0;
		margin: 0;
		min-width: 108px;
		max-width: min(280px, calc(100vw - 16px));
		max-height: min(90vh, calc(100vh - 16px));
		overflow-x: hidden;
		overflow-y: auto;
		font-size: 16px;
	}
	.ctx li {
		padding: 5px 10px;
		min-height: 32px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		font-size: 16px;
		line-height: 1.25;
		color: var(--color-text);
		cursor: pointer;
	}
	.ctx li:not(.embed):not(.spacer):not(.ctx-action):not(.ctx-back-row):hover {
		background: var(--color-ctx-hover-bg);
		color: #fff;
	}
	.ctx li.ctx-back-row {
		padding: 2px 6px;
		min-height: unset;
		list-style: none;
		cursor: default;
		display: block;
	}
	.ctx-submenu-back {
		display: block;
		width: 100%;
		box-sizing: border-box;
		margin: 0;
		padding: 6px 10px;
		border: none;
		border-radius: 4px;
		background: transparent;
		font: inherit;
		font-size: 15px;
		line-height: 1.25;
		text-align: left;
		color: var(--color-text-muted);
		cursor: pointer;
	}
	.ctx-submenu-back:hover {
		background: var(--color-ctx-hover-bg);
		color: #fff;
	}
	.ctx-submenu-back:focus-visible {
		outline: 2px solid var(--color-accent, #3b82f6);
		outline-offset: 2px;
	}
	.ctx li.ctx-action {
		padding: 2px 6px;
		min-height: unset;
		display: block;
		cursor: default;
		list-style: none;
	}
	.ctx-action-btn {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 8px;
		width: 100%;
		box-sizing: border-box;
		margin: 0;
		padding: 7px 10px;
		border: none;
		border-radius: 4px;
		background: var(--color-accent, #3b82f6);
		color: #fff;
		font: inherit;
		font-size: 16px;
		line-height: 1.25;
		text-align: left;
		cursor: pointer;
	}
	.ctx-action-btn :global(.assist-act-ico) {
		opacity: 1;
	}
	.ctx-action-label {
		flex: 1;
		min-width: 0;
		text-align: left;
	}
	.ctx-action-btn:hover {
		filter: brightness(1.05);
	}
	.ctx-action-btn:focus-visible {
		outline: 2px solid var(--color-accent, #3b82f6);
		outline-offset: 2px;
	}
	.ctx li.embed {
		flex-direction: column;
		align-items: stretch;
		cursor: default;
		padding: 4px 6px 6px;
		min-height: unset;
	}
	.ctx li.embed.pile-embed {
		padding: 6px 8px 8px;
	}
	.embed-title {
		margin: 0 0 3px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}
	.pile-controls {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 6px;
	}
	.pile-count {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	/* Match ArrangementControls `.compact.context-menu` density (see Arrange section below). */
	.pile-count span {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}
	.pile-count-row {
		display: flex;
		align-items: stretch;
		gap: 4px;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
		overflow-x: auto;
	}
	.pile-step {
		flex: 0 0 auto;
		min-width: 2.25rem;
		padding: 4px 4px;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.2;
		white-space: nowrap;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}
	.pile-step:hover:not(:disabled) {
		background: var(--color-surface-muted, rgba(255, 255, 255, 0.06));
	}
	.pile-step:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.pile-count-input {
		box-sizing: border-box;
		flex: 1 1 auto;
		/* ~3 tabular digits + horizontal padding; native steppers need extra room on Chromium/WebKit */
		min-width: max(5.25rem, calc(3ch + 1.75rem));
		width: auto;
		padding: 4px 6px;
		font-size: 16px;
		font-variant-numeric: tabular-nums;
		user-select: text;
		-webkit-user-select: text;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		text-align: center;
		appearance: auto;
	}
	/* Keep native increment/decrement controls visible where the UA provides them */
	.pile-count-input::-webkit-outer-spin-button,
	.pile-count-input::-webkit-inner-spin-button {
		opacity: 1;
		height: auto;
	}
	.pile-embed .segmented {
		display: flex;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		overflow: hidden;
	}
	.pile-embed .segmented button {
		flex: 1;
		padding: 5px 6px;
		border: none;
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-size: 16px;
		cursor: pointer;
	}
	.pile-embed .segmented button + button {
		border-left: 1px solid var(--color-border);
	}
	.pile-embed .segmented button.active {
		background: var(--ctx-choice-selected-bg, var(--color-text-muted));
		color: var(--ctx-choice-selected-fg, var(--color-text));
		box-shadow: none;
	}
	.pile-apply {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 8px;
		box-sizing: border-box;
		width: 100%;
		padding: 6px 10px;
		font-size: 16px;
		border-radius: 4px;
		border: none;
		background: var(--color-accent, #3b82f6);
		color: #fff;
		text-align: left;
		cursor: pointer;
	}
	.pile-apply :global(.assist-act-ico) {
		opacity: 1;
	}
	.pile-apply:hover {
		filter: brightness(1.05);
	}
	/* Divider only: .ctx li min-height would otherwise force a tall blank “row” */
	.ctx li.spacer {
		min-height: 0;
		height: 0;
		padding: 0;
		margin: 2px 0;
		overflow: hidden;
		flex: 0 0 auto;
		align-self: stretch;
		border: none;
		border-top: 1px solid var(--color-border);
		cursor: default;
		pointer-events: none;
	}
</style>
