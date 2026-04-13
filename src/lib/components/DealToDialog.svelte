<script lang="ts">
	import { browser } from '$app/environment';
	import type { StashRosterEntry } from '$lib/engine/stash';

	export let open = false;
	export let roster: StashRosterEntry[] = [];
	/** Max cards (selected movable pieces). */
	export let maxCards = 0;
	export let reducedMotion = false;
	export let onConfirm: (cardCount: number, rosterIndices: number[]) => void;
	export let onClose: () => void;

	let countStr = '1';
	/** Roster indices selected as deal targets. */
	let selectedIndices = new Set<number>();

	$: if (open && browser) {
		const mc = Math.max(0, maxCards);
		countStr = String(mc > 0 ? mc : 1);
		selectedIndices = new Set(roster.map((_, i) => i));
	}

	function toggleRoster(i: number) {
		const next = new Set(selectedIndices);
		if (next.has(i)) next.delete(i);
		else next.add(i);
		selectedIndices = next;
	}

	function apply() {
		const mc = Math.max(0, maxCards);
		if (mc === 0) return;
		const n = Math.min(mc, Math.max(1, parseInt(countStr, 10) || 1));
		const indices = [...selectedIndices].filter((i) => i >= 0 && i < roster.length).sort((a, b) => a - b);
		if (indices.length === 0) return;
		onConfirm(n, indices);
		onClose();
	}

	function onWinKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}
</script>

<svelte:window onkeydown={onWinKeydown} />

{#if open && browser}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={onClose} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_interactive_supports_focus a11y_click_events_have_key_events -->
		<div
			class="panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="deal-to-title"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
		>
			<h2 id="deal-to-title" class="title">Deal to…</h2>
			<p class="hint">
				Top-of-stack cards are dealt first (highest z-order). Cards are placed round-robin in order of the
				players you select below.
			</p>
			{#if maxCards < 1}
				<p class="warn">No movable cards selected.</p>
			{:else}
				<label class="field">
					<span>Number of cards</span>
					<input type="number" bind:value={countStr} min="1" max={maxCards} step="1" />
				</label>
				<p class="sub">Up to {maxCards} (from selection).</p>
				<div class="targets">
					<span class="targets-label">Players</span>
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
					<p class="sub muted">Reduced motion: cards move instantly.</p>
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
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 2000000005;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
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
