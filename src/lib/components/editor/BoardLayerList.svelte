<script lang="ts">
	import { get } from 'svelte/store';
	import type { BoardWidget, PieceInstance, WidgetType } from '$lib/engine/types';
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';

	export let assetBaseUrl: string | null;
	/** Called after edits from this panel so the board editor can record undo history. */
	export let onAfterEdit: (() => void) | undefined = undefined;

	type LayerRow =
		| { kind: 'piece'; piece: PieceInstance }
		| { kind: 'widget'; widget: BoardWidget };

	function thumbUrl(p: PieceInstance) {
		if (!assetBaseUrl) return '';
		return `${assetBaseUrl}${p.bg}`;
	}

	function zSortedLayers(pieces: PieceInstance[], widgets: BoardWidget[]): LayerRow[] {
		const rows: LayerRow[] = [
			...pieces.map((piece) => ({ kind: 'piece' as const, piece })),
			...widgets.map((widget) => ({ kind: 'widget' as const, widget }))
		];
		rows.sort((a, b) => {
			const za = a.kind === 'piece' ? a.piece.zIndex : a.widget.zIndex;
			const zb = b.kind === 'piece' ? b.piece.zIndex : b.widget.zIndex;
			return za - zb;
		});
		return rows;
	}

	function layerKey(row: LayerRow): string {
		return row.kind === 'piece' ? `piece:${row.piece.id}` : `widget:${row.widget.id}`;
	}

	function reorderFromOrderedList(ordered: Array<{ kind: 'piece' | 'widget'; id: number }>) {
		g.reorderBoardFromOrderedList(ordered);
	}

	let dragKey: string | null = null;
	let insertAtIndex: number | null = null;
	let activePointerId: number | null = null;
	let dragPointerCaptureEl: HTMLElement | null = null;

	function applyReorderFromInsert(fromKey: string, insertAt: number) {
		const ord = zSortedLayers($game.pieces, $game.widgets);
		const n = ord.length;
		const fromIdx = ord.findIndex((r) => layerKey(r) === fromKey);
		if (fromIdx < 0) return;

		const orderedIds = ord.map((r) =>
			r.kind === 'piece'
				? { kind: 'piece' as const, id: r.piece.id }
				: { kind: 'widget' as const, id: r.widget.id }
		);

		let at = Math.max(0, Math.min(insertAt, n));
		const cp = [...orderedIds];
		const [item] = cp.splice(fromIdx, 1);
		if (fromIdx < at) at -= 1;
		at = Math.max(0, Math.min(at, cp.length));
		cp.splice(at, 0, item);

		const before = orderedIds.map((x) => `${x.kind}:${x.id}`).join('\0');
		const after = cp.map((x) => `${x.kind}:${x.id}`).join('\0');
		if (before === after) return;
		reorderFromOrderedList(cp);
		onAfterEdit?.();
	}

	function rowUnder(clientX: number, clientY: number): HTMLElement | null {
		const stack = document.elementsFromPoint(clientX, clientY);
		for (const el of stack) {
			if (!(el instanceof HTMLElement)) continue;
			const row = el.closest('[data-board-layer-id]');
			if (row instanceof HTMLElement) {
				const id = row.getAttribute('data-board-layer-id');
				if (dragKey !== null && id === dragKey) continue;
				return row;
			}
		}
		return null;
	}

	function computeInsertAt(clientX: number, clientY: number): number | null {
		const row = rowUnder(clientX, clientY);
		if (!row) return null;
		const id = row.getAttribute('data-board-layer-id');
		const ord = zSortedLayers($game.pieces, $game.widgets);
		const idx = ord.findIndex((r) => layerKey(r) === id);
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
		dragKey = null;
		insertAtIndex = null;
		removeGlobalListeners();
	}

	function onPointerMove(e: PointerEvent) {
		if (e.pointerId !== activePointerId) return;
		insertAtIndex = computeInsertAt(e.clientX, e.clientY);
	}

	function onPointerUp(e: PointerEvent) {
		if (e.pointerId !== activePointerId) return;
		const fromKey = dragKey;
		const insertAt = computeInsertAt(e.clientX, e.clientY);
		endDrag();
		if (fromKey != null && insertAt != null) {
			applyReorderFromInsert(fromKey, insertAt);
		}
	}

	function onPointerCancel(e: PointerEvent) {
		if (e.pointerId !== activePointerId) return;
		endDrag();
	}

	function handleHandlePointerDown(fromKey: string, e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		insertAtIndex = computeInsertAt(e.clientX, e.clientY);
		dragKey = fromKey;
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

	let menu: { key: string; x: number; y: number } | null = null;

	function closeMenu() {
		menu = null;
	}

	function onRowContextMenu(e: MouseEvent, key: string) {
		e.preventDefault();
		const s = get(game);
		if (key.startsWith('piece:')) {
			const id = parseInt(key.slice(6), 10);
			if (!s.selectedIds.has(id)) g.selectPieceForEditor(id, false);
		} else if (key.startsWith('widget:')) {
			const id = parseInt(key.slice(7), 10);
			if (!s.selectedWidgetIds.has(id)) g.selectWidgetForEditor(id, false);
		}
		menu = { key, x: e.clientX, y: e.clientY };
	}

	function widgetLabel(t: WidgetType): string {
		switch (t) {
			case 'counter':
				return 'Counter';
			case 'label':
				return 'Label';
			case 'textbox':
				return 'Text box';
			case 'dice':
				return 'Dice';
			case 'toggle':
				return 'Toggle';
			default:
				return 'Widget';
		}
	}
</script>

<svelte:window onclick={closeMenu} />

<section class="layer-panel" aria-labelledby="board-layers-heading">
	<h3 id="board-layers-heading" class="layers-title">Layers</h3>
	<ul class="layers" class:dnd-active={dragKey !== null}>
		{#each zSortedLayers($game.pieces, $game.widgets) as L, i (layerKey(L))}
			{@const key = layerKey(L)}
			<li
				class="row"
				data-board-layer-id={key}
				class:sel={L.kind === 'piece'
					? $game.selectedIds.has(L.piece.id)
					: $game.selectedWidgetIds.has(L.widget.id)}
				class:dragging={dragKey === key}
				class:insert-before={dragKey !== null && insertAtIndex === i}
				class:insert-after={dragKey !== null &&
					insertAtIndex !== null &&
					insertAtIndex === i + 1 &&
					i === zSortedLayers($game.pieces, $game.widgets).length - 1}
				oncontextmenu={(e) => onRowContextMenu(e, key)}
			>
				<button
					type="button"
					class="drag-handle"
					aria-label="Drag to reorder"
					onpointerdown={(e) => handleHandlePointerDown(key, e)}
				>⠿</button>
				{#if L.kind === 'piece'}
					<button
						type="button"
						class="eye"
						class:eye-off={L.piece.hidden}
						title={L.piece.hidden ? 'Show on board' : 'Hide on board'}
						aria-pressed={!L.piece.hidden}
						onclick={(e) => {
							e.stopPropagation();
							g.togglePieceHidden(L.piece.id);
						}}
					>
						{#if !L.piece.hidden}
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
							<img class="thumb" src={thumbUrl(L.piece)} alt="" />
						{:else}
							<div class="thumb-fallback"></div>
						{/if}
					</div>
					<button type="button" class="name" onclick={() => g.selectPieceForEditor(L.piece.id, false)}>
						<span class="cls">{L.piece.classes || 'piece'}</span>
						<span class="muted">z:{L.piece.zIndex}</span>
					</button>
					<button
						type="button"
						class="lock"
						class:lock-on={L.piece.locked === true}
						title={L.piece.locked === true ? 'Unlock piece' : 'Lock piece'}
						aria-pressed={L.piece.locked === true}
						onclick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							g.togglePieceLocked(L.piece.id);
						}}
					>
						{#if L.piece.locked === true}
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
				{:else}
					<button
						type="button"
						class="eye"
						class:eye-off={L.widget.hidden}
						title={L.widget.hidden ? 'Show on board' : 'Hide on board'}
						aria-pressed={!L.widget.hidden}
						onclick={(e) => {
							e.stopPropagation();
							g.toggleWidgetHidden(L.widget.id);
						}}
					>
						{#if !L.widget.hidden}
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
					<div class="thumb-wrap widget-thumb" aria-hidden="true">
						<span class="w-icon">{widgetLabel(L.widget.type).slice(0, 1)}</span>
					</div>
					<button type="button" class="name" onclick={() => g.selectWidgetForEditor(L.widget.id, false)}>
						<span class="cls">{widgetLabel(L.widget.type)}</span>
						<span class="muted">z:{L.widget.zIndex}</span>
					</button>
					<button
						type="button"
						class="lock"
						class:lock-on={L.widget.locked === true}
						title={L.widget.locked === true ? 'Unlock widget' : 'Lock widget'}
						aria-pressed={L.widget.locked === true}
						onclick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							g.toggleWidgetLocked(L.widget.id);
						}}
					>
						{#if L.widget.locked === true}
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
				{/if}
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
		{#if menu.key.startsWith('piece:')}
			<button
				type="button"
				onclick={() => {
					const id = parseInt(menu!.key.slice(6), 10);
					g.duplicatePieceForEditor(id);
					closeMenu();
					onAfterEdit?.();
				}}>Duplicate</button
			>
			{#if $game.selectedIds.size > 1 && $game.selectedIds.has(parseInt(menu.key.slice(6), 10))}
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
					const id = parseInt(menu!.key.slice(6), 10);
					g.removePiecesForEditor([id]);
					closeMenu();
					onAfterEdit?.();
				}}>{$game.selectedIds.size > 1 ? 'Delete this piece' : 'Delete'}</button
			>
			<button
				type="button"
				onclick={() => {
					const id = parseInt(menu!.key.slice(6), 10);
					g.bringToFront(id);
					closeMenu();
					onAfterEdit?.();
				}}>Bring to front</button
			>
			<button
				type="button"
				onclick={() => {
					const id = parseInt(menu!.key.slice(6), 10);
					g.sendToBack(id);
					closeMenu();
					onAfterEdit?.();
				}}>Send to back</button
			>
		{:else}
			<button
				type="button"
				onclick={() => {
					const id = parseInt(menu!.key.slice(7), 10);
					g.duplicateWidgetForEditor(id);
					closeMenu();
					onAfterEdit?.();
				}}>Duplicate</button
			>
			{#if $game.selectedWidgetIds.size > 1 && $game.selectedWidgetIds.has(parseInt(menu.key.slice(7), 10))}
				<button
					type="button"
					onclick={() => {
						g.removeWidgetsForEditor([...$game.selectedWidgetIds]);
						closeMenu();
						onAfterEdit?.();
					}}>Delete all ({$game.selectedWidgetIds.size})</button
				>
			{/if}
			<button
				type="button"
				onclick={() => {
					const id = parseInt(menu!.key.slice(7), 10);
					g.removeWidgetsForEditor([id]);
					closeMenu();
					onAfterEdit?.();
				}}>{$game.selectedWidgetIds.size > 1 ? 'Delete this widget' : 'Delete'}</button
			>
			<button
				type="button"
				onclick={() => {
					const id = parseInt(menu!.key.slice(7), 10);
					g.bringWidgetToFront(id);
					closeMenu();
					onAfterEdit?.();
				}}>Bring to front</button
			>
			<button
				type="button"
				onclick={() => {
					const id = parseInt(menu!.key.slice(7), 10);
					g.sendWidgetToBack(id);
					closeMenu();
					onAfterEdit?.();
				}}>Send to back</button
			>
		{/if}
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
	.thumb-wrap.widget-thumb {
		display: flex;
		align-items: center;
		justify-content: center;
		background: #1e293b;
		border: 1px solid var(--color-border);
	}
	.w-icon {
		font-size: 14px;
		font-weight: 700;
		color: var(--color-accent, #3b82f6);
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
