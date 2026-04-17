<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import { hasAttr, pieceSupportsFlip } from '$lib/engine/pieces';
	import { ARRANGEMENT_GAP_PRESET } from '$lib/editor/arrangementGapPresets';
	import { arrangementPrefs } from '$lib/stores/arrangementPrefs';
	import DealToDialog from '$lib/components/DealToDialog.svelte';
	import { users } from '$lib/stores/users';
	import { settings } from '$lib/stores/settings';
	import {
		activeUserId,
		getLocalPlayerColor,
		playerColorOverrides,
		playerOrder
	} from '$lib/stores/network';
	import { buildStashRoster } from '$lib/engine/stash';
	import PlayAssistActionIcon from '$lib/components/icons/PlayAssistActionIcon.svelte';

	const STORAGE_KEY = 'bge:playAssistBar.v1';

	/** When true, scroll wheel pans the table instead of zooming (copy matches Settings / PlayControlsHelp). */
	export let scrollWheelPans = false;
	export let replayMode = false;
	export let selfDisplayName = 'You';
	/** Single selection: toggles the same large preview as hold-<kbd>P</kbd> (parent owns overlay state). */
	export let onTogglePiecePeek: ((pieceId: number) => void) | undefined = undefined;

	let dealOpen = false;
	let offsetX = 0;
	let offsetY = 0;
	let dragActive = false;
	let dragHandleEl: HTMLElement | null = null;
	let dragStartClientX = 0;
	let dragStartClientY = 0;
	let dragStartOffsetX = 0;
	let dragStartOffsetY = 0;

	function prefersReducedMotion(): boolean {
		if (!browser || typeof matchMedia === 'undefined') return false;
		return matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function loadPosition() {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const j = JSON.parse(raw) as { ox?: number; oy?: number };
			if (typeof j.ox === 'number' && Number.isFinite(j.ox)) offsetX = j.ox;
			if (typeof j.oy === 'number' && Number.isFinite(j.oy)) offsetY = j.oy;
		} catch {
			/* ignore */
		}
	}

	function savePosition() {
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ ox: offsetX, oy: offsetY }));
		} catch {
			/* ignore */
		}
	}

	onMount(() => {
		loadPosition();
	});

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

	$: sel = $game.pieces.filter((p) => $game.selectedIds.has(p.id));
	$: arrangeUnlockedCount = [...$game.selectedIds].filter((id) => {
		const p = $game.pieces.find((x) => x.id === id);
		return p != null && !p.locked;
	}).length;
	$: showFlip = sel.some((p) => pieceSupportsFlip(p));
	$: showArrange = sel.length > 1 && sel.every((p) => hasAttr(p, 'move'));
	$: showShuffle =
		sel.length > 1 &&
		sel.every((p) => hasAttr(p, 'move')) &&
		arrangeUnlockedCount >= 2;
	$: showGroupByType = showShuffle;
	$: showDeal =
		sel.length >= 2 && sel.every((p) => hasAttr(p, 'move')) && stashRoster.length > 0;

	/** Spread / fan / smart arrange need at least two unlocked movables (same gate as shuffle). */
	$: showMultiArrange = showArrange && arrangeUnlockedCount >= 2;

	$: idleHints = $game.selectedIds.size === 0;

	$: singlePiece =
		sel.length === 1 ? sel[0] : null;
	$: showSingleDup = singlePiece != null && hasAttr(singlePiece, 'duplicate');
	$: showSingleDest = singlePiece != null && hasAttr(singlePiece, 'destroy');
	$: showSingleFlip = singlePiece != null && pieceSupportsFlip(singlePiece);
	$: showSinglePreview = singlePiece != null && typeof onTogglePiecePeek === 'function';
	$: singleHasAnyAction = showSinglePreview || showSingleFlip || showSingleDup || showSingleDest;

	/** First selected piece in board order — same rule as keyboard A / runArrangeSmart. */
	$: smartFirstForArrange = $game.pieces.find((p) => $game.selectedIds.has(p.id));
	/** Keyboard A: face-down selection → pile at average position (same-origin, like Arrange → Pile). */
	$: smartArrangeShowsPile = smartFirstForArrange != null && smartFirstForArrange.flipped;

	function onDragHandleDown(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		dragActive = true;
		dragStartClientX = e.clientX;
		dragStartClientY = e.clientY;
		dragStartOffsetX = offsetX;
		dragStartOffsetY = offsetY;
		dragHandleEl = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
		dragHandleEl?.setPointerCapture(e.pointerId);
		window.addEventListener('pointermove', onDragMove);
		window.addEventListener('pointerup', onDragUp);
	}

	function onDragMove(e: PointerEvent) {
		if (!dragActive) return;
		offsetX = dragStartOffsetX + (e.clientX - dragStartClientX);
		offsetY = dragStartOffsetY + (e.clientY - dragStartClientY);
		const max = 4000;
		offsetX = Math.max(-max, Math.min(max, offsetX));
		offsetY = Math.max(-max, Math.min(max, offsetY));
	}

	function onDragUp(e: PointerEvent) {
		dragActive = false;
		window.removeEventListener('pointermove', onDragMove);
		window.removeEventListener('pointerup', onDragUp);
		if (dragHandleEl) {
			try {
				dragHandleEl.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
			dragHandleEl = null;
		}
		savePosition();
	}

	function doFlipSelection() {
		g.flipSelectedPiecesSync();
	}

	function doSpread() {
		g.runSpreadCustom(ARRANGEMENT_GAP_PRESET.small, $arrangementPrefs.spreadAngleDeg);
	}

	function doFan() {
		void g.runArrangeFanFromPrefs();
	}

	function doSmartArrange() {
		g.runArrangeSmart();
	}
</script>

<DealToDialog
	open={dealOpen}
	roster={stashRoster}
	maxCards={sel.filter((p) => hasAttr(p, 'move')).length}
	reducedMotion={prefersReducedMotion()}
	onConfirm={(cardCount, rosterIndices) => {
		void g.runDealCardsToRoster(rosterIndices, cardCount, {
			reducedMotion: prefersReducedMotion()
		});
	}}
	onClose={() => (dealOpen = false)}
/>

{#if !replayMode}
	<div
		class="assist-root"
		data-play-assist-bar
		style:transform="translate(calc(-50% + {offsetX}px), {offsetY}px)"
	>
		<div class="assist-inner">
			<button
				type="button"
				class="drag-handle"
				aria-label="Move assist bar"
				title="Drag to reposition"
				onpointerdown={onDragHandleDown}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="9" cy="7" r="1.5" fill="currentColor" />
					<circle cx="15" cy="7" r="1.5" fill="currentColor" />
					<circle cx="9" cy="12" r="1.5" fill="currentColor" />
					<circle cx="15" cy="12" r="1.5" fill="currentColor" />
					<circle cx="9" cy="17" r="1.5" fill="currentColor" />
					<circle cx="15" cy="17" r="1.5" fill="currentColor" />
				</svg>
			</button>

			<div class="assist-body">
				{#if idleHints}
					<div
						class="row hints hint-legend"
						role="group"
						aria-label="Pointer and keyboard reference. Drag the bar from the grip on the left."
					>
						<div class="hint-seg" title="Drag empty table to move the view">
							<svg
								class="hint-ico"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								aria-hidden="true"
							>
								<path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke-linecap="round" />
								<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
							</svg>
							<div class="hint-labels">
								<span class="hint-name">Pan</span>
								<span class="hint-means">drag empty table</span>
							</div>
						</div>
						<span class="sep" aria-hidden="true"></span>
						<div class="hint-seg">
							<div class="hint-labels">
								{#if scrollWheelPans}
									<span class="hint-name">Pan (wheel)</span>
									<span class="hint-means">scroll wheel</span>
								{:else}
									<span class="hint-name">Zoom</span>
									<span class="hint-means">scroll wheel</span>
								{/if}
							</div>
						</div>
						<span class="sep" aria-hidden="true"></span>
						<div class="hint-seg">
							<div class="hint-labels">
								<span class="hint-name">Multi-select</span>
								<span class="hint-means">Shift + click</span>
							</div>
						</div>
						<span class="sep" aria-hidden="true"></span>
						<div class="hint-seg">
							<div class="hint-labels">
								<span class="hint-name">Select</span>
								<span class="hint-means">click a piece</span>
							</div>
						</div>
						<span class="sep" aria-hidden="true"></span>
						<div class="hint-seg">
							<div class="hint-labels">
								<span class="hint-name">Menu</span>
								<span class="hint-means">right-click · long-press</span>
							</div>
						</div>
					</div>
				{:else if singlePiece}
					<div class="row actions">
						{#if showSinglePreview}
							<button
								type="button"
								class="act-btn"
								title="Large preview on your screen only (same as hold P)"
								onclick={() => onTogglePiecePeek?.(singlePiece.id)}
							>
								<PlayAssistActionIcon kind="preview" />
								<span class="act-btn-caption">
									<span class="act-label">Preview</span>
									<kbd class="kbd sm">P</kbd>
								</span>
							</button>
						{/if}
						{#if showSingleFlip}
							<button type="button" class="act-btn" onclick={() => g.flipSelectedPiecesSync()}>
								<PlayAssistActionIcon kind="flip" />
								<span class="act-btn-caption">
									<span class="act-label">Flip</span>
									<kbd class="kbd sm">F</kbd>
								</span>
							</button>
						{/if}
						{#if showSingleDup}
							<button type="button" class="act-btn" onclick={() => g.duplicatePiece(singlePiece.id)}>
								<PlayAssistActionIcon kind="duplicate" />
								<span class="act-btn-caption">
									<span class="act-label">Duplicate</span>
									<kbd class="kbd sm">D</kbd>
								</span>
							</button>
						{/if}
						{#if showSingleDest}
							<button type="button" class="act-btn danger" onclick={() => g.destroyPiece(singlePiece.id)}>
								<PlayAssistActionIcon kind="trash" />
								<span class="act-btn-caption">
									<span class="act-label">Remove</span>
									<kbd class="kbd sm">⌫</kbd>
								</span>
							</button>
						{/if}
						{#if !singleHasAnyAction}
							<span class="subtle">No quick actions for this piece.</span>
						{/if}
					</div>
				{:else}
					<div class="row actions wrap">
						{#if showDeal}
							<button type="button" class="act-btn" onclick={() => (dealOpen = true)}>
								<PlayAssistActionIcon kind="deal" />
								<span class="act-btn-caption">
									<span class="act-label">Deal…</span>
								</span>
							</button>
						{/if}
						{#if showMultiArrange}
							<button
								type="button"
								class="act-btn primary"
								onclick={doSpread}
								title="Straight line spread — direction from Arrange → Spread direction (default horizontal). Small gap."
							>
								<PlayAssistActionIcon kind="spreadRow" />
								<span class="act-btn-caption">
									<span class="act-label">Spread</span>
								</span>
							</button>
							<button
								type="button"
								class="act-btn"
								onclick={doFan}
								title="Always arc fan (right-click Arrange → Fan), using your gap settings — even when the top card is face-down."
							>
								<PlayAssistActionIcon kind="fan" />
								<span class="act-btn-caption">
									<span class="act-label">Fan</span>
								</span>
							</button>
							<button
								type="button"
								class="act-btn"
								onclick={doSmartArrange}
								title="Uses the first selected piece: face-down → pile; face-up → arc fan. Keyboard A."
							>
								<PlayAssistActionIcon kind={smartArrangeShowsPile ? 'pile' : 'fan'} />
								<span class="act-btn-caption">
									<span class="act-label">{smartArrangeShowsPile ? 'Pile' : 'Fan'}</span>
									<kbd class="kbd sm">A</kbd>
								</span>
							</button>
						{/if}
						{#if showFlip}
							<button type="button" class="act-btn" onclick={doFlipSelection}>
								<PlayAssistActionIcon kind="flip" />
								<span class="act-btn-caption">
									<span class="act-label"
										>{sel.filter((p) => pieceSupportsFlip(p)).length > 1 ? 'Flip all' : 'Flip'}</span
									>
									<kbd class="kbd sm">F</kbd>
								</span>
							</button>
						{/if}
						{#if showShuffle}
							<button type="button" class="act-btn" onclick={() => g.runShuffleMovableSelection()}>
								<PlayAssistActionIcon kind="shuffle" />
								<span class="act-btn-caption">
									<span class="act-label">Shuffle</span>
									<kbd class="kbd sm">S</kbd>
								</span>
							</button>
						{/if}
						{#if showGroupByType}
							<button
								type="button"
								class="act-btn"
								title="Reorder by piece type along the current layout"
								onclick={() => g.runArrangeGroupByPieceType()}
							>
								<PlayAssistActionIcon kind="sort" />
								<span class="act-btn-caption">
									<span class="act-label">Sort</span>
								</span>
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.assist-root {
		position: fixed;
		left: 50%;
		bottom: max(12px, env(safe-area-inset-bottom, 0px));
		z-index: 2000000002;
		pointer-events: auto;
		max-width: min(960px, calc(100vw - 24px));
	}

	.assist-inner {
		display: flex;
		align-items: stretch;
		gap: 0;
		background: color-mix(in srgb, var(--color-context-bg) 88%, transparent);
		backdrop-filter: blur(10px);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	.drag-handle {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		padding: 0;
		border: none;
		border-right: 1px solid var(--color-border);
		background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
		color: var(--color-text-muted);
		cursor: grab;
		touch-action: none;
	}
	.drag-handle:active {
		cursor: grabbing;
	}

	.assist-body {
		flex: 1;
		min-width: 0;
		padding: 8px 12px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: nowrap;
	}

	.row.wrap {
		flex-wrap: wrap;
		justify-content: flex-start;
	}

	.hints {
		font-size: 12px;
		color: var(--color-text-muted);
		overflow-x: auto;
		scrollbar-width: thin;
	}

	/** Legend only: not interactive — avoids looking like toolbar buttons */
	.hint-legend {
		pointer-events: none;
		user-select: none;
		cursor: default;
		align-items: stretch;
	}

	.hint-seg {
		display: inline-flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.hint-labels {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1px;
		line-height: 1.15;
	}

	.hint-ico {
		width: 14px;
		height: 14px;
		opacity: 0.85;
		flex-shrink: 0;
		align-self: flex-start;
		margin-top: 2px;
	}

	.hint-name {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--color-text);
	}

	.hint-means {
		font-size: 10px;
		font-weight: 400;
		color: var(--color-text-muted);
		letter-spacing: 0.02em;
	}

	.sep {
		width: 1px;
		align-self: stretch;
		min-height: 28px;
		background: var(--color-border);
		flex-shrink: 0;
		opacity: 0.7;
	}

	.kbd {
		display: inline-block;
		padding: 1px 6px;
		font-size: 11px;
		font-family: inherit;
		line-height: 1.3;
		border: 1px solid var(--color-border-strong);
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-bg) 92%, var(--color-text) 8%);
		color: var(--color-text);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--color-text) 12%, transparent);
	}
	.kbd.sm {
		padding: 0 5px;
		font-size: 10px;
		margin-left: 4px;
	}

	.actions {
		gap: 6px;
	}

	.act-btn {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 7px 8px 6px;
		font-size: 12px;
		font-weight: 500;
		border-radius: 8px;
		border: 1px solid var(--color-border-strong);
		background: color-mix(in srgb, var(--color-btn-secondary-bg) 95%, transparent);
		color: var(--color-text);
		cursor: pointer;
		min-width: 3.25rem;
	}
	.act-btn-caption {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		flex-wrap: wrap;
		text-align: center;
		line-height: 1.2;
	}
	.act-btn :global(.assist-act-ico) {
		opacity: 0.95;
	}
	.act-label {
		min-width: 0;
	}
	.act-btn-caption .kbd.sm {
		margin-left: 0;
	}
	.act-btn:hover {
		background: var(--color-ctx-hover-bg);
		color: #fff;
		border-color: var(--color-ctx-hover-bg);
	}
	.act-btn:hover .kbd.sm {
		color: #fff;
		border-color: rgba(255, 255, 255, 0.45);
		background: transparent;
	}
	.act-btn.primary {
		border-color: color-mix(in srgb, var(--color-accent, #4a90d9) 70%, var(--color-border-strong));
	}
	.act-btn.danger:hover {
		background: var(--color-endgame);
		border-color: var(--color-endgame);
	}

	.subtle {
		font-size: 12px;
		color: var(--color-text-muted);
		padding: 4px 0;
	}
</style>
