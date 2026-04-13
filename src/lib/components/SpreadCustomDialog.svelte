<script lang="ts">
	import { browser } from '$app/environment';

	export let open = false;
	export let onApply: (gap: number, angleDeg: number) => void;
	export let onClose: () => void;

	let gapStr = '32';
	let angleStr = '0';

	$: if (open) {
		gapStr = '32';
		angleStr = '0';
	}

	function apply() {
		const gap = Math.max(0, parseFloat(gapStr) || 0);
		let angle = parseFloat(angleStr);
		if (!Number.isFinite(angle)) angle = 0;
		onApply(gap, angle);
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
			aria-labelledby="spread-custom-title"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
		>
			<h2 id="spread-custom-title" class="title">Spread custom</h2>
			<p class="hint">
				Gap is the distance between piece centers along the line. Angle: 0° = right, 90° = down.
			</p>
			<label class="field">
				<span>Gap (px)</span>
				<input type="number" bind:value={gapStr} min="0" step="1" />
			</label>
			<label class="field">
				<span>Angle (degrees)</span>
				<input type="number" bind:value={angleStr} step="1" />
			</label>
			<div class="actions">
				<button type="button" class="btn secondary" onclick={onClose}>Cancel</button>
				<button type="button" class="btn primary" onclick={apply}>Apply</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 2000000004;
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
		padding: 20px;
		min-width: min(320px, 100%);
		max-width: 400px;
		box-shadow: var(--shadow-md);
	}
	.title {
		margin: 0 0 8px;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--color-text);
	}
	.hint {
		margin: 0 0 16px;
		font-size: 13px;
		color: var(--color-text-muted, #888);
		line-height: 1.4;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
		font-size: 14px;
		color: var(--color-text);
	}
	.field input {
		padding: 8px 10px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-input-bg, #1a1a1a);
		color: inherit;
	}
	.actions {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
		margin-top: 8px;
	}
	.btn {
		padding: 10px 16px;
		border-radius: 4px;
		font-size: 14px;
		cursor: pointer;
		border: 1px solid var(--color-border);
	}
	.btn.secondary {
		background: transparent;
		color: var(--color-text);
	}
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
	}
</style>
