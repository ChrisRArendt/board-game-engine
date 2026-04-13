<script lang="ts">
	import type { PieceInstance } from '$lib/engine/types';
	import type { CardForBoardPiece } from '$lib/editor/types';

	export let gameId: string;
	export let pieces: PieceInstance[];
	export let selectedIds: Set<number>;
	export let onSelect: (id: number, shift: boolean) => void;
	export let onAddPiece: () => void;
	export let cardsForBoard: CardForBoardPiece[] = [];
	export let onAddFromCard: ((card: CardForBoardPiece) => void) | undefined = undefined;
</script>

<div class="wrap">
	<div class="actions">
		<button type="button" class="add primary" onclick={onAddPiece}>Add image piece</button>
		{#if cardsForBoard.length && onAddFromCard}
			<label class="from-card">
				<span>Add from rendered piece</span>
				<select
					class="sel"
					onchange={(e) => {
						const v = (e.currentTarget as HTMLSelectElement).value;
						(e.currentTarget as HTMLSelectElement).value = '';
						if (!v) return;
						const c = cardsForBoard.find((x) => x.id === v);
						if (c) onAddFromCard(c);
					}}
				>
					<option value="">— choose —</option>
					{#each cardsForBoard as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</label>
		{/if}
	</div>
	<a class="manage" href="/editor/{gameId}/pieces">Manage rendered pieces →</a>
	<ul class="list">
		{#each pieces as p (p.id)}
			<li>
				<button
					type="button"
					class="row"
					class:sel={selectedIds.has(p.id)}
					onclick={(e) => onSelect(p.id, e.shiftKey)}
				>
					<span class="cls">{p.classes || 'piece'}</span>
					<span class="id">#{p.id}</span>
				</button>
			</li>
		{/each}
	</ul>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.manage {
		font-size: 12px;
		color: var(--color-accent, #3b82f6);
		text-decoration: none;
	}
	.manage:hover {
		text-decoration: underline;
	}
	.from-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 12px;
	}
	.sel {
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		font-size: 13px;
	}
	.add.primary {
		padding: 8px 12px;
		border-radius: 6px;
		border: none;
		background: var(--color-accent, #3b82f6);
		color: #fff;
		cursor: pointer;
		font-size: 14px;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 60vh;
		overflow: auto;
	}
	.row {
		width: 100%;
		text-align: left;
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 4px;
	}
	.row.sel {
		border-color: var(--editor-selection, #3b82f6);
		background: rgba(59, 130, 246, 0.15);
	}
	.cls {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.id {
		opacity: 0.6;
		font-size: 12px;
	}
</style>
