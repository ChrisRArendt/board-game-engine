<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, tick } from 'svelte';
	import type { StashRosterEntry } from '$lib/engine/stash';

	export let open = false;
	export let roster: StashRosterEntry[] = [];
	/** Max cards (selected movable pieces). */
	export let maxCards = 0;
	export let reducedMotion = false;
	export let onConfirm: (cardCount: number, rosterIndices: number[]) => void;
	export let onClose: () => void;

	let dialogEl: HTMLDialogElement | undefined;

	let countStr = '1';
	/** Roster indices selected as deal targets. */
	let selectedIndices = new Set<number>();
	let lastDealOpen = false;

	/** Reset form only when the dialog opens, not when `roster` identity churns while open. */
	$: if (open && browser && open !== lastDealOpen) {
		lastDealOpen = open;
		countStr = '1';
		selectedIndices = new Set(roster.map((_, i) => i));
	}
	$: if (!open && browser) lastDealOpen = false;

	$: mc = Math.max(0, maxCards);
	$: perPlayer = Math.max(1, parseInt(countStr, 10) || 1);
	$: targetCount = selectedIndices.size;
	$: totalToDeal = mc < 1 || targetCount < 1 ? 0 : Math.min(mc, perPlayer * targetCount);

	/** Native `<dialog>.showModal()` uses the top layer — wins z-index without portals. */
	$: if (browser && dialogEl && open) {
		void tick().then(() => {
			if (!dialogEl || !open) return;
			if (!dialogEl.open) {
				try {
					dialogEl.showModal();
				} catch {
					/* ignore duplicate showModal */
				}
			}
		});
	}
	$: if (browser && dialogEl && !open && dialogEl.open) {
		dialogEl.close();
	}

	onDestroy(() => {
		if (browser && dialogEl?.open) dialogEl.close();
	});

	function toggleRoster(i: number) {
		const next = new Set(selectedIndices);
		if (next.has(i)) next.delete(i);
		else next.add(i);
		selectedIndices = next;
	}

	function apply() {
		if (mc === 0) return;
		const indices = [...selectedIndices].filter((i) => i >= 0 && i < roster.length).sort((a, b) => a - b);
		if (indices.length === 0) return;
		const pp = Math.max(1, parseInt(countStr, 10) || 1);
		const n = Math.min(mc, pp * indices.length);
		onConfirm(n, indices);
		onClose();
	}

	let shellEl: HTMLDivElement | undefined;
	let panelEl: HTMLDivElement | undefined;

	/** True while the primary button is down after pointerdown inside `.panel`. */
	let pointerDownInsidePanel = false;
	/** After selecting text / dragging from inside the panel, `mouseup` outside can synthesize a backdrop `click` — skip one dismiss. */
	let suppressNextOutsideDismiss = false;

	function onDialogPointerDown(e: PointerEvent) {
		if (!panelEl) return;
		const t = e.target;
		pointerDownInsidePanel = t instanceof Node && panelEl.contains(t);
	}

	function onDialogPointerUp(e: PointerEvent) {
		if (!panelEl) return;
		const t = e.target;
		const endOutsidePanel = t instanceof Node && !panelEl.contains(t);
		if (pointerDownInsidePanel && endOutsidePanel) suppressNextOutsideDismiss = true;
		pointerDownInsidePanel = false;
	}

	function consumeSuppressOutsideDismiss(): boolean {
		if (!suppressNextOutsideDismiss) return false;
		suppressNextOutsideDismiss = false;
		return true;
	}

	/** Clicks on ::backdrop often use the <dialog> node as target (MDN pattern). */
	function onDialogClick(e: MouseEvent) {
		if (e.target !== dialogEl) return;
		if (consumeSuppressOutsideDismiss()) return;
		onClose();
	}

	/** Flex padding around the centered panel (not the panel itself). */
	function onShellClick(e: MouseEvent) {
		if (e.target !== shellEl) return;
		if (consumeSuppressOutsideDismiss()) return;
		onClose();
	}

	/** Top-layer dialog must live under `body`, not inside `main`, or hit-testing can fail on /play. */
	$: if (browser && dialogEl && dialogEl.parentNode && dialogEl.parentNode !== document.body) {
		document.body.appendChild(dialogEl);
	}
</script>

{#if browser}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<dialog
		bind:this={dialogEl}
		class="deal-root"
		data-bge-deal-dialog
		aria-labelledby="deal-to-title"
		onclose={() => onClose()}
		onpointerdown={onDialogPointerDown}
		onpointerup={onDialogPointerUp}
		onclick={onDialogClick}
	>
		<!-- Full-viewport shell: clicks on padding around panel close the dialog. -->
		<div bind:this={shellEl} class="deal-shell" role="presentation" onclick={onShellClick}>
			<div bind:this={panelEl} class="panel" role="document">
			<h2 id="deal-to-title" class="title">Deal cards</h2>
			<p class="hint">Highest stack first. Per-player count; round-robin to checked players.</p>
			{#if maxCards < 1}
				<p class="warn">No movable cards selected. Close and select cards on the table.</p>
			{:else}
				<label class="field">
					<span>Per player</span>
					<input type="number" bind:value={countStr} min="1" max={maxCards} step="1" />
				</label>
				{#if targetCount > 0}
					<p class="sub">
						Up to <strong>{totalToDeal}</strong> of {maxCards} selected
						{#if totalToDeal < perPlayer * targetCount}
							(capped)
						{/if}
					</p>
				{:else}
					<p class="sub warn-inline">Choose at least one player.</p>
				{/if}
				<div class="targets">
					<span class="targets-label">To</span>
					{#each roster as p, i (p.id)}
						<label class="check">
							<input
								type="checkbox"
								checked={selectedIndices.has(i)}
								onchange={() => toggleRoster(i)}
							/>
							<span class="swatch" style:background={p.color}></span>
							<span>{p.name}</span>
						</label>
					{/each}
				</div>
				{#if reducedMotion}
					<p class="sub muted">Instant move (reduced motion).</p>
				{/if}
			{/if}
			<div class="actions">
				<button type="button" class="btn secondary" onclick={onClose}>Cancel</button>
				<button
					type="button"
					class="btn primary"
					disabled={maxCards < 1 || selectedIndices.size === 0}
					onclick={apply}
				>
					Deal
				</button>
			</div>
		</div>
		</div>
	</dialog>
{/if}

<style>
	.deal-root {
		margin: 0;
		border: none;
		padding: 0;
		max-width: none;
		width: 100vw;
		height: 100vh;
		max-height: 100vh;
		background: transparent;
		overflow: visible;
	}
	/* Global `*` sets user-select:none — restore interaction for modal controls. */
	.deal-root :global(button),
	.deal-root :global(input),
	.deal-root :global(label) {
		user-select: auto;
		-webkit-user-select: auto;
		cursor: auto;
	}
	.deal-root :global(.check),
	.deal-root :global(.btn) {
		cursor: pointer;
	}
	.deal-root::backdrop {
		background: rgba(0, 0, 0, 0.45);
	}
	.deal-shell {
		box-sizing: border-box;
		min-height: 100%;
		min-width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: transparent;
	}
	.panel {
		background: var(--color-context-bg);
		border: 1px solid var(--color-border-strong);
		border-radius: 8px;
		padding: 20px 22px;
		max-width: 400px;
		width: 100%;
		box-shadow: var(--shadow-md);
	}
	.title {
		margin: 0 0 8px;
		font-size: 18px;
	}
	.hint {
		margin: 0 0 14px;
		font-size: 13px;
		line-height: 1.45;
		color: var(--color-text-muted, #94a3b8);
	}
	.warn {
		color: #f87171;
		margin: 0 0 12px;
		font-size: 14px;
	}
	.warn-inline {
		color: #fbbf24;
		margin: 0 0 8px;
		font-size: 12px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 6px;
	}
	.field span {
		font-size: 13px;
	}
	.field input {
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
		font-size: 15px;
		max-width: 120px;
	}
	.sub {
		margin: 0 0 12px;
		font-size: 12px;
		color: var(--color-text-muted, #94a3b8);
	}
	.sub.muted {
		margin-top: 8px;
	}
	.targets {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}
	.targets-label {
		font-size: 13px;
		font-weight: 600;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		cursor: pointer;
	}
	.swatch {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		flex-shrink: 0;
		border: 1px solid rgba(255, 255, 255, 0.25);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}
	.btn {
		padding: 10px 18px;
		border-radius: 6px;
		font-size: 14px;
		cursor: pointer;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
	}
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
	}
	.btn.primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.btn.secondary {
		background: transparent;
	}
</style>
