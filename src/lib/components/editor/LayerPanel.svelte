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

	function moveLayer(id: string, dir: -1 | 1) {
		const list = zSorted();
		const i = list.findIndex((l) => l.id === id);
		if (i < 0) return;
		const j = i + dir;
		if (j < 0 || j >= list.length) return;
		const a = list[i];
		const b = list[j];
		const next = layers.map((L) => {
			if (L.id === a.id) return { ...L, zIndex: b.zIndex };
			if (L.id === b.id) return { ...L, zIndex: a.zIndex };
			return L;
		});
		onReorder(next);
	}
</script>

<ul class="layers">
	{#each zSorted() as L (L.id)}
		<li
			class="row"
			class:sel={selectedId === L.id}
			draggable={true}
			ondragstart={() => (dragId = L.id)}
			ondragover={(e) => e.preventDefault()}
			ondrop={() => {
				if (!dragId || dragId === L.id) return;
				const ord = zSorted();
				const from = ord.findIndex((x) => x.id === dragId);
				const to = ord.findIndex((x) => x.id === L.id);
				if (from < 0 || to < 0) return;
				const cp = [...ord];
				const [item] = cp.splice(from, 1);
				cp.splice(to, 0, item);
				const z = cp.map((x, i) => ({ ...x, zIndex: i }));
				const map = new Map(z.map((x) => [x.id, x]));
				onReorder(layers.map((x) => map.get(x.id) ?? x));
				dragId = null;
			}}
		>
			<button type="button" class="eye" title="Visibility" onclick={() => onToggleVis(L.id)}>
				{L.visible ? '👁' : '◌'}
			</button>
			<button type="button" class="name" onclick={() => onSelect(L.id)}>
				{L.name} <span class="muted">({L.type})</span>
			</button>
			<button type="button" class="lock" title="Lock" onclick={() => onToggleLock(L.id)}>
				{L.locked ? '🔒' : '🔓'}
			</button>
			<button type="button" class="mini" onclick={() => moveLayer(L.id, 1)} title="Down">↓</button>
			<button type="button" class="mini" onclick={() => moveLayer(L.id, -1)} title="Up">↑</button>
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
		grid-template-columns: 28px 1fr 28px 24px 24px 24px;
		gap: 4px;
		align-items: center;
		padding: 6px 8px;
		border-radius: 6px;
		border: 1px solid transparent;
		cursor: grab;
	}
	.row.sel {
		border-color: var(--editor-selection, #3b82f6);
		background: rgba(59, 130, 246, 0.1);
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
