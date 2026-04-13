<script lang="ts">
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import type { CardForBoardPiece } from '$lib/editor/types';
	import type { PlacementLayout, WidgetType } from '$lib/engine/types';
	import type { PlacementSpacingMode } from '$lib/editor/placementLayouts';

	export let cardsForBoard: CardForBoardPiece[] = [];
	export let onAddBlank: () => void;
	/** Viewport client coords → table world coords (px). */
	export let clientToWorld: (clientX: number, clientY: number) => { x: number; y: number };
	/** World table coords + placement args */
	export let onAddWidget: ((type: WidgetType) => void) | undefined = undefined;
	export let onDropCard: (
		card: CardForBoardPiece,
		opts: {
			quantity: number;
			layout: PlacementLayout;
			offset: number;
			baseX: number;
			baseY: number;
			spacingMode: PlacementSpacingMode;
			gridCols?: number;
		}
	) => void;

	let quantity = 1;
	let layout: PlacementLayout = 'grid';
	let spacingMode: PlacementSpacingMode = 'overlap';
	let gridCols = 3;
	let offset = 32;
	let dragCard: CardForBoardPiece | null = null;
	let dragX = 0;
	let dragY = 0;
	let dragGhost: { x: number; y: number } | null = null;

	function thumbUrl(card: CardForBoardPiece) {
		if (!card.rendered_image_path) return '';
		return publicStorageUrl(card.rendered_image_path);
	}

	function onThumbPointerDown(card: CardForBoardPiece, e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		dragCard = card;
		dragX = e.clientX;
		dragY = e.clientY;
		dragGhost = { x: e.clientX, y: e.clientY };
		window.addEventListener('pointermove', onDragMove);
		window.addEventListener('pointerup', onDragUp, { once: true });
		window.addEventListener('pointercancel', onDragUp, { once: true });
	}

	function onDragMove(e: PointerEvent) {
		if (dragGhost) {
			dragGhost = { x: e.clientX, y: e.clientY };
		}
	}

	function onDragUp(e: PointerEvent) {
		window.removeEventListener('pointermove', onDragMove);
		const card = dragCard;
		dragCard = null;
		dragGhost = null;
		if (!card?.rendered_image_path) return;
		const el = document.elementFromPoint(e.clientX, e.clientY);
		const canvas = el?.closest?.('[data-board-editor-canvas]');
		if (!canvas) return;
		const q = Math.max(1, Math.min(99, Math.floor(quantity) || 1));
		const off =
			spacingMode === 'separate'
				? Math.max(0, Math.min(500, Number(offset) || 0))
				: Math.max(1, Math.min(500, Math.floor(Number(offset)) || 32));
		const cols = Math.max(1, Math.min(99, Math.floor(gridCols) || 3));
		const w = clientToWorld(e.clientX, e.clientY);
		/** Ghost uses translate(-50%,-50%) — first piece top-left so its center matches the cursor. */
		const pw = card.canvas_width;
		const ph = card.canvas_height;
		const baseX = w.x - pw / 2;
		const baseY = w.y - ph / 2;
		onDropCard(card, {
			quantity: q,
			layout,
			offset: off,
			baseX,
			baseY,
			spacingMode,
			gridCols: layout === 'grid' ? cols : undefined
		});
	}
</script>

<div class="lib">
	<button type="button" class="add primary" onclick={onAddBlank}>Add image piece</button>

	{#if onAddWidget}
		<div class="widgets-block">
			<p class="widgets-title">Board widgets</p>
			<p class="hint">Place counters, labels, notes, dice, and toggles on the table.</p>
			<div class="widget-btns">
				<button type="button" class="wbtn" onclick={() => onAddWidget?.('counter')}>Counter</button>
				<button type="button" class="wbtn" onclick={() => onAddWidget?.('label')}>Label</button>
				<button type="button" class="wbtn" onclick={() => onAddWidget?.('textbox')}>Text box</button>
				<button type="button" class="wbtn" onclick={() => onAddWidget?.('dice')}>Dice</button>
				<button type="button" class="wbtn" onclick={() => onAddWidget?.('toggle')}>Toggle</button>
			</div>
		</div>
	{/if}

	<div class="defaults">
		<label>
			<span>Quantity</span>
			<input type="number" min="1" max="99" bind:value={quantity} />
		</label>
		<label>
			<span>Layout</span>
			<select bind:value={layout}>
				<option value="stack">Stack</option>
				<option value="grid">Grid</option>
				<option value="honeycomb">Honeycomb</option>
			</select>
		</label>
		{#if layout === 'grid'}
			<label>
				<span>Columns</span>
				<input type="number" min="1" max="99" bind:value={gridCols} />
			</label>
		{/if}
		<label class="toggle-row">
			<span>Spacing</span>
			<div class="segmented" role="group" aria-label="Placement spacing">
				<button
					type="button"
					class:active={spacingMode === 'overlap'}
					onclick={() => (spacingMode = 'overlap')}
				>
					Overlap
				</button>
				<button
					type="button"
					class:active={spacingMode === 'separate'}
					onclick={() => (spacingMode = 'separate')}
				>
					Separate
				</button>
			</div>
		</label>
		<label>
			<span>{spacingMode === 'separate' ? 'Gap (px)' : 'Offset (px)'}</span>
			<input type="number" min={spacingMode === 'separate' ? 0 : 1} max="500" bind:value={offset} />
		</label>
	</div>

	{#if cardsForBoard.length}
		<p class="hint">Drag a piece onto the board</p>
		<div class="grid">
			{#each cardsForBoard as card (card.id)}
				{#if card.rendered_image_path}
					<button
						type="button"
						class="thumb"
						onpointerdown={(e) => onThumbPointerDown(card, e)}
						title={card.name}
					>
						<img src={thumbUrl(card)} alt="" draggable="false" />
						<span class="name">{card.name}</span>
					</button>
				{/if}
			{/each}
		</div>
	{:else}
		<p class="muted">No rendered pieces yet. Use Templates &amp; Pieces, then render a PNG for each.</p>
	{/if}
</div>

{#if dragGhost && dragCard?.rendered_image_path}
	<div class="drag-ghost" style:left="{dragGhost.x}px" style:top="{dragGhost.y}px">
		<img src={thumbUrl(dragCard)} alt="" />
	</div>
{/if}

<style>
	.lib {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.widgets-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}
	.widgets-title {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.widget-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.wbtn {
		padding: 6px 10px;
		font-size: 12px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
	}
	.wbtn:hover {
		border-color: var(--color-accent, #3b82f6);
		color: var(--color-accent, #3b82f6);
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
	.defaults {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 12px;
	}
	.defaults label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--color-text-muted);
	}
	.defaults input,
	.defaults select {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.toggle-row .segmented {
		display: flex;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		overflow: hidden;
	}
	.segmented button {
		flex: 1;
		padding: 6px 8px;
		border: none;
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-size: 12px;
		cursor: pointer;
	}
	.segmented button + button {
		border-left: 1px solid var(--color-border);
	}
	.segmented button.active {
		background: var(--color-accent, #3b82f6);
		color: #fff;
	}
	.hint {
		margin: 0;
		font-size: 11px;
		color: var(--color-text-muted);
	}
	.muted {
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		max-height: 42vh;
		overflow: auto;
	}
	.thumb {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding: 4px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		cursor: grab;
		color: inherit;
	}
	.thumb:active {
		cursor: grabbing;
	}
	.thumb img {
		width: 100%;
		aspect-ratio: 2/3;
		object-fit: contain;
		border-radius: 4px;
		background: #111;
		pointer-events: none;
	}
	.name {
		font-size: 10px;
		margin-top: 4px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.drag-ghost {
		position: fixed;
		z-index: 100000;
		pointer-events: none;
		width: 72px;
		transform: translate(-50%, -50%);
		opacity: 0.85;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		border-radius: 6px;
		overflow: hidden;
	}
	.drag-ghost img {
		width: 100%;
		display: block;
	}
</style>
