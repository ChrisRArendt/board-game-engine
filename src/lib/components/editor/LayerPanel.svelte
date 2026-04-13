<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import type { CardLayer } from '$lib/editor/types';

	let {
		layers,
		selectedId,
		selectLayer,
		reorderLayers,
		toggleVisibility,
		toggleLock,
		renameLayer,
		removeLayer
	}: {
		layers: CardLayer[];
		selectedId: string | null;
		selectLayer: (id: string) => void;
		reorderLayers: (layers: CardLayer[]) => void;
		toggleVisibility: (id: string) => void;
		toggleLock: (id: string) => void;
		renameLayer: (id: string, name: string) => void;
		removeLayer: (id: string) => void;
	} = $props();

	// #region agent log
	const DBG = 'http://localhost:7278/ingest/b8376de9-9c29-4e05-bd62-1d6be57bcdc1';
	function dbgLog(
		location: string,
		message: string,
		data: Record<string, unknown>,
		hypothesisId: string
	) {
		fetch(DBG, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a428b6' },
			body: JSON.stringify({
				sessionId: 'a428b6',
				location,
				message,
				data,
				timestamp: Date.now(),
				hypothesisId
			})
		}).catch(() => {});
	}
	function firstRowIdInStack(clientX: number, clientY: number): string | null {
		const stack = document.elementsFromPoint(clientX, clientY);
		for (const el of stack) {
			if (!(el instanceof HTMLElement)) continue;
			const row = el.closest('[data-layer-id]');
			if (row instanceof HTMLElement) return row.getAttribute('data-layer-id');
		}
		return null;
	}
	// #endregion

	let dragId = $state<string | null>(null);
	/** Insertion slot: 0 = before first row, …, length = after last row. */
	let insertAtIndex = $state<number | null>(null);
	let activePointerId = $state<number | null>(null);
	let dragPointerCaptureEl = $state<HTMLElement | null>(null);

	let menu = $state<{ id: string; x: number; y: number } | null>(null);

	function clipMenuPos(clientX: number, clientY: number) {
		const mw = 168;
		const mh = 88;
		const pad = 8;
		if (!browser) return { x: clientX, y: clientY };
		return {
			x: Math.min(Math.max(pad, clientX), window.innerWidth - mw - pad),
			y: Math.min(Math.max(pad, clientY), window.innerHeight - mh - pad)
		};
	}

	function onMenuDocKey(e: KeyboardEvent) {
		if (e.key === 'Escape') closeLayerMenu();
	}

	function closeLayerMenu() {
		if (browser) window.removeEventListener('keydown', onMenuDocKey);
		menu = null;
	}

	function openLayerMenuAt(id: string, clientX: number, clientY: number) {
		closeLayerMenu();
		const p = clipMenuPos(clientX, clientY);
		menu = { id, x: p.x, y: p.y };
		if (browser) window.addEventListener('keydown', onMenuDocKey);
	}

	function onRowContextMenu(e: MouseEvent, id: string) {
		e.preventDefault();
		openLayerMenuAt(id, e.clientX, e.clientY);
	}

	function menuRename() {
		if (!menu) return;
		const id = menu.id;
		const L = layers.find((l) => l.id === id);
		closeLayerMenu();
		if (!L) return;
		const n = window.prompt('Name', L.name);
		if (n === null) return;
		const t = n.trim();
		renameLayer(id, t || L.name);
	}

	function menuRemove() {
		if (!menu) return;
		const id = menu.id;
		closeLayerMenu();
		removeLayer(id);
	}

	onDestroy(() => {
		if (browser) window.removeEventListener('keydown', onMenuDocKey);
	});

	function zSorted(): CardLayer[] {
		return [...layers].sort((a, b) => a.zIndex - b.zIndex);
	}

	function reorderFromOrderedList(ordered: CardLayer[]) {
		const next = ordered.map((x, i) => ({ ...x, zIndex: i }));
		reorderLayers(next);
	}

	function applyReorderFromInsert(fromId: string, insertAt: number) {
		const ord = zSorted();
		const n = ord.length;
		const fromIdx = ord.findIndex((x) => x.id === fromId);
		if (fromIdx < 0) return;

		let at = Math.max(0, Math.min(insertAt, n));
		const cp = [...ord];
		const [item] = cp.splice(fromIdx, 1);
		const atBeforeAdjust = at;
		if (fromIdx < at) at -= 1;
		at = Math.max(0, Math.min(at, cp.length));
		cp.splice(at, 0, item);

		const before = ord.map((x) => x.id).join('\0');
		const after = cp.map((x) => x.id).join('\0');
		if (before === after) return;

		// #region agent log
		dbgLog(
			'LayerPanel.svelte:applyReorderFromInsert',
			'apply',
			{
				fromId,
				insertAt,
				fromIdx,
				n,
				atBeforeAdjust,
				atFinal: at,
				orderBefore: ord.map((x) => x.id),
				orderAfter: cp.map((x) => x.id)
			},
			'H4'
		);
		// #endregion

		reorderFromOrderedList(cp);
	}

	function rowUnder(clientX: number, clientY: number): HTMLElement | null {
		const stack = document.elementsFromPoint(clientX, clientY);
		for (const el of stack) {
			if (!(el instanceof HTMLElement)) continue;
			const row = el.closest('[data-layer-id]');
			if (row instanceof HTMLElement) {
				const id = row.getAttribute('data-layer-id');
				/* While dragging, the dragged row stays in the hit stack and blocks rows below — skip it. */
				if (dragId !== null && id === dragId) continue;
				return row;
			}
		}
		return null;
	}

	function computeInsertAt(clientX: number, clientY: number): number | null {
		const row = rowUnder(clientX, clientY);
		if (!row) return null;
		const id = row.getAttribute('data-layer-id');
		const ord = zSorted();
		const idx = ord.findIndex((x) => x.id === id);
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
		const lastMoveInsert = insertAtIndex;
		const firstRow = firstRowIdInStack(e.clientX, e.clientY);
		// #region agent log
		dbgLog(
			'LayerPanel.svelte:onPointerUp',
			'pu',
			{
				fromId,
				insertAt,
				lastMoveInsert,
				firstRowId: firstRow,
				matchMove: insertAt === lastMoveInsert
			},
			'H2'
		);
		// #endregion
		endDrag();
		if (fromId != null && insertAt != null) {
			applyReorderFromInsert(fromId, insertAt);
		} else {
			dbgLog(
				'LayerPanel.svelte:onPointerUp',
				'pu_skip',
				{ fromId, insertAt, reason: insertAt == null ? 'null_insert' : 'no_from' },
				'H3'
			);
		}
	}

	function onPointerCancel(e: PointerEvent) {
		if (e.pointerId !== activePointerId) return;
		endDrag();
	}

	function handleHandlePointerDown(fromId: string, e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		/* Compute slot while dragId is still null so rowUnder does not skip the row we are grabbing. */
		insertAtIndex = computeInsertAt(e.clientX, e.clientY);
		dragId = fromId;
		activePointerId = e.pointerId;
		dragPointerCaptureEl = e.currentTarget as HTMLElement;
		try {
			dragPointerCaptureEl.setPointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
		dbgLog(
			'LayerPanel.svelte:handleHandlePointerDown',
			'pd',
			{ fromId, insertAtIndex },
			'H1'
		);
		document.addEventListener('pointermove', onPointerMove, true);
		document.addEventListener('pointerup', onPointerUp, true);
		document.addEventListener('pointercancel', onPointerCancel, true);
	}
</script>

<section class="layer-panel" aria-labelledby="layers-heading">
	<h3 id="layers-heading" class="layers-title">Layers</h3>
	<ul class="layers" class:dnd-active={dragId !== null}>
	{#each zSorted() as L, i (L.id)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<li
			class="row"
			data-layer-id={L.id}
			class:sel={selectedId === L.id}
			class:dragging={dragId === L.id}
			class:insert-before={dragId !== null && insertAtIndex === i}
			class:insert-after={dragId !== null &&
				insertAtIndex !== null &&
				insertAtIndex === i + 1 &&
				i === layers.length - 1}
			oncontextmenu={(e) => onRowContextMenu(e, L.id)}
		>
			<button
				type="button"
				class="drag-handle"
				aria-label="Drag to reorder {L.name}"
				onpointerdown={(e) => handleHandlePointerDown(L.id, e)}
			>⠿</button>
			<button
				type="button"
				class="eye"
				class:eye-off={!L.visible}
				title={L.visible ? 'Hide on card' : 'Show on card'}
				aria-pressed={L.visible}
				onclick={() => toggleVisibility(L.id)}
			>
				{#if L.visible}
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
			<button type="button" class="name" onclick={() => selectLayer(L.id)}>
				{L.name} <span class="muted">({L.type})</span>
			</button>
			<button
				type="button"
				class="lock"
				class:lock-on={L.locked}
				title={L.locked ? 'Unlock layer' : 'Lock layer'}
				aria-pressed={L.locked}
				onclick={() => toggleLock(L.id)}
			>
				{#if L.locked}
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
		class="layer-ctx-backdrop"
		role="presentation"
		onclick={closeLayerMenu}
	></div>
	<div class="layer-ctx-pop" style:left="{menu.x}px" style:top="{menu.y}px" role="menu">
		<button type="button" class="layer-ctx-item" role="menuitem" onclick={menuRename}>Rename</button>
		<button type="button" class="layer-ctx-item danger" role="menuitem" onclick={menuRemove}
			>Remove</button>
	</div>
{/if}

<style>
	.layer-panel {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.layers-title {
		margin: 0 0 8px;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text);
	}
	.layers {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.row {
		display: grid;
		grid-template-columns: 28px 28px 1fr 28px;
		gap: 4px;
		align-items: center;
		padding: 6px 8px;
		border-radius: 6px;
		border: 1px solid transparent;
		transition:
			border-color 0.08s ease,
			box-shadow 0.08s ease;
	}
	.row.sel {
		border-color: var(--editor-selection, #3b82f6);
		background: rgba(59, 130, 246, 0.1);
	}
	.row.dragging {
		opacity: 0.45;
	}
	/* Insertion = thick line matching selection accent (not red/pink “danger”) */
	.row.insert-before {
		border-top: 3px solid var(--editor-selection, #3b82f6);
		box-shadow: 0 -1px 0 rgba(59, 130, 246, 0.25);
	}
	.row.insert-after {
		border-bottom: 3px solid var(--editor-selection, #3b82f6);
		box-shadow: 0 1px 0 rgba(59, 130, 246, 0.25);
	}
	.row > button.drag-handle {
		cursor: grab;
		user-select: none;
		touch-action: none;
		font-size: 14px;
		line-height: 1;
		color: var(--color-text-muted);
		text-align: center;
		min-width: 28px;
		min-height: 28px;
		padding: 0;
		margin: 0;
		border: none;
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.row > button.drag-handle:active {
		cursor: grabbing;
	}
	.layers.dnd-active {
		cursor: grabbing;
		user-select: none;
	}
	.row button {
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		font-size: 14px;
		padding: 2px;
	}
	.name {
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.muted {
		opacity: 0.6;
		font-size: 12px;
	}
	.layer-ctx-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99990;
		background: transparent;
	}
	.layer-ctx-pop {
		position: fixed;
		z-index: 99991;
		min-width: 160px;
		padding: 4px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.layer-ctx-item {
		text-align: left;
		padding: 8px 10px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: inherit;
		font-size: 13px;
		cursor: pointer;
	}
	.layer-ctx-item:hover {
		background: rgba(255, 255, 255, 0.06);
	}
	.layer-ctx-item.danger {
		color: #f87171;
	}
	/* Beat `.row button { padding: 2px }` so the icon centers */
	.row > button.eye {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		min-height: 28px;
		padding: 0;
	}
	.row > button.eye .eye-icon {
		width: 18px;
		height: 18px;
		display: block;
	}
	.row > button.eye.eye-off .eye-icon {
		opacity: 0.55;
	}
	.row > button.lock {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		min-height: 28px;
		padding: 0;
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
</style>
