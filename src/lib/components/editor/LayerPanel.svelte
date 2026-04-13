<script lang="ts">
	import type { CardLayer } from '$lib/editor/types';

	export let layers: CardLayer[];
	export let selectedId: string | null;
	export let onSelect: (id: string) => void;
	export let onReorder: (layers: CardLayer[]) => void;
	export let onToggleVis: (id: string) => void;
	export let onToggleLock: (id: string) => void;
	export let onDelete: (id: string) => void;

	let dragId: string | null = null;

	function zSorted(): CardLayer[] {
		return [...layers].sort((a, b) => a.zIndex - b.zIndex);
	}

	function reorderFromOrderedList(ordered: CardLayer[]) {
		const next = ordered.map((x, i) => ({ ...x, zIndex: i }));
		onReorder(next);
	}

	function onDragStart(id: string, e: DragEvent) {
		dragId = id;
		e.dataTransfer?.setData('text/plain', id);
		e.dataTransfer!.effectAllowed = 'move';
	}

	function onDragEnd() {
		dragId = null;
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function onDrop(targetId: string, e: DragEvent) {
		e.preventDefault();
		const fromId = dragId ?? e.dataTransfer?.getData('text/plain') ?? '';
		dragId = null;
		if (!fromId || fromId === targetId) return;
		const ord = zSorted();
		const from = ord.findIndex((x) => x.id === fromId);
		const to = ord.findIndex((x) => x.id === targetId);
		if (from < 0 || to < 0) return;
		const cp = [...ord];
		const [item] = cp.splice(from, 1);
		cp.splice(to, 0, item);
		reorderFromOrderedList(cp);
	}
</script>

<ul class="layers">
	{#each zSorted() as L (L.id)}
		<li
			class="row"
			class:sel={selectedId === L.id}
			class:dragging={dragId === L.id}
			ondragover={onDragOver}
			ondrop={(e) => onDrop(L.id, e)}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span
				class="drag-handle"
				role="presentation"
				tabindex="-1"
				draggable="true"
				ondragstart={(e) => onDragStart(L.id, e)}
				ondragend={onDragEnd}
				title="Drag to reorder"
			>⠿</span>
			<button type="button" class="eye" title="Visibility" onclick={() => onToggleVis(L.id)}>
				{L.visible ? '👁' : '◌'}
			</button>
			<button type="button" class="name" onclick={() => onSelect(L.id)}>
				{L.name} <span class="muted">({L.type})</span>
			</button>
			<button type="button" class="lock" title="Lock" onclick={() => onToggleLock(L.id)}>
				{L.locked ? '🔒' : '🔓'}
			</button>
			<button type="button" class="del" onclick={() => onDelete(L.id)} title="Delete">×</button>
		</li>
	{/each}
</ul>

<style>
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
		grid-template-columns: 22px 28px 1fr 28px 24px;
		gap: 4px;
		align-items: center;
		padding: 6px 8px;
		border-radius: 6px;
		border: 1px solid transparent;
	}
	.row.sel {
		border-color: var(--editor-selection, #3b82f6);
		background: rgba(59, 130, 246, 0.1);
	}
	.row.dragging {
		opacity: 0.55;
	}
	.drag-handle {
		cursor: grab;
		user-select: none;
		font-size: 14px;
		line-height: 1;
		color: var(--color-text-muted);
		text-align: center;
	}
	.drag-handle:active {
		cursor: grabbing;
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
	.del {
		color: #f87171;
	}
</style>
