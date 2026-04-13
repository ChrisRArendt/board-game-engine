<script lang="ts">
	import { get } from 'svelte/store';
	import type { PieceInstance } from '$lib/engine/types';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';

	export let assetBaseUrl: string | null;
	/** Called after edits from this panel so the board editor can record undo history. */
	export let onAfterEdit: (() => void) | undefined = undefined;

	function thumbUrl(p: PieceInstance) {
		if (!assetBaseUrl) return '';
		return `${assetBaseUrl}${p.bg}`;
	}

	function zSorted(pieces: PieceInstance[]): PieceInstance[] {
		return [...pieces].sort((a, b) => a.zIndex - b.zIndex);
	}

	let dragId: number | null = null;
	let insertAtIndex: number | null = null;
	let activePointerId: number | null = null;
	let dragPointerCaptureEl: HTMLElement | null = null;

	function reorderFromOrderedList(ordered: PieceInstance[]) {
		g.reorderPiecesFromOrderedList(ordered);
	}

	function applyReorderFromInsert(fromId: number, insertAt: number) {
		const ord = zSorted($game.pieces);
		const n = ord.length;
		const fromIdx = ord.findIndex((x) => x.id === fromId);
		if (fromIdx < 0) return;

		let at = Math.max(0, Math.min(insertAt, n));
		const cp = [...ord];
		const [item] = cp.splice(fromIdx, 1);
		if (fromIdx < at) at -= 1;
		at = Math.max(0, Math.min(at, cp.length));
		cp.splice(at, 0, item);

		const before = ord.map((x) => x.id).join('\0');
		const after = cp.map((x) => x.id).join('\0');
		if (before === after) return;
		reorderFromOrderedList(cp);
	}

	function rowUnder(clientX: number, clientY: number): HTMLElement | null {
		const stack = document.elementsFromPoint(clientX, clientY);
		for (const el of stack) {
			if (!(el instanceof HTMLElement)) continue;
			const row = el.closest('[data-board-piece-id]');
			if (row instanceof HTMLElement) {
				const id = row.getAttribute('data-board-piece-id');
				if (dragId !== null && id === String(dragId)) continue;
				return row;
			}
		}
		return null;
	}

	function computeInsertAt(clientX: number, clientY: number): number | null {
		const row = rowUnder(clientX, clientY);
		if (!row) return null;
		const id = row.getAttribute('data-board-piece-id');
		const ord = zSorted($game.pieces);
		const idx = ord.findIndex((x) => String(x.id) === id);
		if (idx < 0) return null;
		const rect = row.getBoundingClientRect();
		const mid = rect.top + rect.height / 2;
		return clientY < mid ? idx : idx + 1;
	}

	function removeGlobalListeners() {
		document.removeEventListener('pointermove', onPointerMove, true);
		document.removeEventListener('pointerup', onPointerUp, true);
		document.removeEventListener('pointercancel', onPointerCancel, true);
	}

	function endDrag() {
		if (dragPointerCaptureEl && activePointerId !== null) {
			try {
				dragPointerCaptureEl.releasePointerCapture(activePointerId);
			} catch {
				/* ignore */
			}
		}
		dragPointerCaptureEl = null;
		activePointerId = null;
		dragId = null;
		insertAtIndex = null;
		removeGlobalListeners();
	}

	function onPointerMove(e: PointerEvent) {
		if (e.pointerId !== activePointerId) return;
		insertAtIndex = computeInsertAt(e.clientX, e.clientY);
	}

	function onPointerUp(e: PointerEvent) {
		if (e.pointerId !== activePointerId) return;
		const fromId = dragId;
		const insertAt = computeInsertAt(e.clientX, e.clientY);
		endDrag();
		if (fromId != null && insertAt != null) {
			applyReorderFromInsert(fromId, insertAt);
		}
	}

	function onPointerCancel(e: PointerEvent) {
		if (e.pointerId !== activePointerId) return;
		endDrag();
	}

	function handleHandlePointerDown(fromId: number, e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		insertAtIndex = computeInsertAt(e.clientX, e.clientY);
		dragId = fromId;
		activePointerId = e.pointerId;
		dragPointerCaptureEl = e.currentTarget as HTMLElement;
		try {
			dragPointerCaptureEl.setPointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
		document.addEventListener('pointermove', onPointerMove, true);
		document.addEventListener('pointerup', onPointerUp, true);
		document.addEventListener('pointercancel', onPointerCancel, true);
	}

	let menu: { id: number; x: number; y: number } | null = null;

	function closeMenu() {
		menu = null;
	}

	function onRowContextMenu(e: MouseEvent, id: number) {
		e.preventDefault();
		const s = get(game);
		if (!s.selectedIds.has(id)) {
			g.selectPieceForEditor(id, false);
		}
		menu = { id, x: e.clientX, y: e.clientY };
	}
</script>

<svelte:window onclick={closeMenu} />

<section class="layer-panel" aria-labelledby="board-layers-heading">
	<h3 id="board-layers-heading" class="layers-title">Layers</h3>
	<ul class="layers" class:dnd-active={dragId !== null}>
		{#each zSorted($game.pieces) as L, i (L.id)}
			<li
				class="row"
				data-board-piece-id={L.id}
				class:sel={$game.selectedIds.has(L.id)}
				class:dragging={dragId === L.id}
				class:insert-before={dragId !== null && insertAtIndex === i}
				class:insert-after={dragId !== null &&
					insertAtIndex !== null &&
					insertAtIndex === i + 1 &&
					i === $game.pieces.length - 1}
				oncontextmenu={(e) => onRowContextMenu(e, L.id)}
			>
				<button
					type="button"
					class="drag-handle"
					aria-label="Drag to reorder"
					onpointerdown={(e) => handleHandlePointerDown(L.id, e)}
				>⠿</button>
				<button
					type="button"
					class="eye"
					class:eye-off={L.hidden}
					title={L.hidden ? 'Show on board' : 'Hide on board'}
					aria-pressed={!L.hidden}
					onclick={(e) => {
						e.stopPropagation();
						g.togglePieceHidden(L.id);
					}}
				>
					{#if !L.hidden}
						<svg class="eye-icon" viewBox="0 0 24 24" aria-hidden="true">
							<path
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M1 12s4-8 11-8 11 8-4 8-11 8-11-8-11-8z"
							/>
							<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" />
						</svg>
					{:else}
						<svg class="eye-icon" viewBox="0 0 24 24" aria-hidden="true">
							<path
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
							/>
							<line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" />
						</svg>
					{/if}
				</button>
				<div class="thumb-wrap">
					{#if assetBaseUrl}
						<img class="thumb" src={thumbUrl(L)} alt="" />
					{:else}
						<div class="thumb-fallback"></div>
					{/if}
				</div>
				<button type="button" class="name" onclick={() => g.selectPieceForEditor(L.id, false)}>
					<span class="cls">{L.classes || 'piece'}</span>
					<span class="muted">z:{L.zIndex}</span>
				</button>
				<button
					type="button"
					class="lock"
					class:lock-on={L.locked === true}
					title={L.locked === true ? 'Unlock piece' : 'Lock piece'}
					aria-pressed={L.locked === true}
					onclick={(e) => {
						e.stopPropagation();
						e.preventDefault();
						g.togglePieceLocked(L.id);
					}}
				>
					{#if L.locked === true}
						<svg class="lock-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 4.5h10.5a2.25 2.25 0 012.25 2.25v6.75a2.25 2.25 0 01-2.25 2.25H3.75a2.25 2.25 0 01-2.25-2.25v-6.75a2.25 2.25 0 012.25-2.25z"
							/>
						</svg>
					{:else}
						<svg class="lock-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
							/>
						</svg>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</section>

{#if menu}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="ctx"
		style:left="{menu.x}px"
		style:top="{menu.y}px"
		onclick={(e) => e.stopPropagation()}
		role="menu"
		tabindex="-1"
	>
		<button
			type="button"
			onclick={() => {
				g.duplicatePieceForEditor(menu!.id);
				closeMenu();
				onAfterEdit?.();
			}}>Duplicate</button
		>
		{#if $game.selectedIds.size > 1 && $game.selectedIds.has(menu.id)}
			<button
				type="button"
				onclick={() => {
					g.removePiecesForEditor([...$game.selectedIds]);
					closeMenu();
					onAfterEdit?.();
				}}>Delete all ({$game.selectedIds.size})</button
			>
		{/if}
		<button
			type="button"
			onclick={() => {
				g.removePiecesForEditor([menu!.id]);
				closeMenu();
				onAfterEdit?.();
			}}>{$game.selectedIds.size > 1 ? 'Delete this piece' : 'Delete'}</button
		>
		<button
			type="button"
			onclick={() => {
				g.bringToFront(menu!.id);
				closeMenu();
				onAfterEdit?.();
			}}>Bring to front</button
		>
		<button
			type="button"
			onclick={() => {
				g.sendToBack(menu!.id);
				closeMenu();
				onAfterEdit?.();
			}}>Send to back</button
		>
	</div>
{/if}

<style>
	.layer-panel {
		display: flex;
		flex-direction: column;
		gap: 0;
		min-height: 0;
		margin-top: 16px;
	}
	.layers-title {
		margin: 0 0 8px;
		font-size: 0.95rem;
		font-weight: 600;
	}
	.layers {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 38vh;
		overflow: auto;
	}
	.row {
		display: grid;
		grid-template-columns: 28px 28px 36px 1fr 28px;
		gap: 4px;
		align-items: center;
		padding: 4px 6px;
		border-radius: 6px;
		border: 1px solid transparent;
	}
	.row.sel {
		border-color: var(--editor-selection, #3b82f6);
		background: rgba(59, 130, 246, 0.1);
	}
	.row.dragging {
		opacity: 0.45;
	}
	.row.insert-before {
		border-top: 3px solid var(--editor-selection, #3b82f6);
	}
	.row.insert-after {
		border-bottom: 3px solid var(--editor-selection, #3b82f6);
	}
	.drag-handle {
		cursor: grab;
		touch-action: none;
		background: transparent;
		border: none;
		color: var(--color-text-muted);
		padding: 0;
		font-size: 14px;
	}
	.row > button.eye {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		min-height: 28px;
		padding: 0;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--color-text-muted);
	}
	.row > button.eye .eye-icon {
		width: 18px;
		height: 18px;
		display: block;
	}
	.row > button.eye.eye-off .eye-icon {
		opacity: 0.55;
	}
	.thumb-wrap {
		width: 36px;
		height: 36px;
		border-radius: 4px;
		overflow: hidden;
		background: #111;
	}
	.thumb {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.thumb-fallback {
		width: 100%;
		height: 100%;
		background: #333;
	}
	.name {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		overflow: hidden;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		text-align: left;
		font-size: 12px;
	}
	.cls {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		width: 100%;
	}
	.muted {
		opacity: 0.55;
		font-size: 10px;
	}
	.row > button.lock {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		min-height: 28px;
		padding: 0;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--color-text-muted);
	}
	.row > button.lock .lock-icon {
		width: 18px;
		height: 18px;
		display: block;
	}
	.row > button.lock.lock-on {
		color: #fbbf24;
	}
	.layers.dnd-active {
		cursor: grabbing;
		user-select: none;
	}
	.ctx {
		position: fixed;
		z-index: 200000;
		min-width: 160px;
		padding: 4px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ctx button {
		text-align: left;
		padding: 8px 10px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		border-radius: 4px;
		font-size: 13px;
	}
	.ctx button:hover {
		background: rgba(59, 130, 246, 0.15);
	}
</style>
