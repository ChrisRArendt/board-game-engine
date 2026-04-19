<script lang="ts">
	import { fade } from 'svelte/transition';
	import { toasts } from '$lib/stores/toast';
	import ToastCard from '$lib/components/ToastCard.svelte';

	const MAX_VISIBLE = 4;

	$: ordered = $toasts;
	$: visible = ordered.slice(-MAX_VISIBLE);
	$: overflow = Math.max(0, ordered.length - MAX_VISIBLE);
</script>

<div
	class="toast-host"
	role="region"
	aria-label="Notifications"
	aria-live="polite"
>
	{#if overflow > 0}
		<div class="overflow-chip" transition:fade={{ duration: 220 }}>
			+{overflow} more
		</div>
	{/if}
	{#each visible as t (t.id)}
		<ToastCard {t} />
	{/each}
</div>

<style>
	.toast-host {
		position: fixed;
		top: 16px;
		right: 16px;
		z-index: 90;
		display: grid;
		gap: 10px;
		width: min(380px, calc(100vw - 32px));
		pointer-events: none;
	}
	.toast-host :global(.toast-card) {
		pointer-events: auto;
	}
	@media (max-width: 640px) {
		.toast-host {
			top: auto;
			bottom: 16px;
			left: 50%;
			right: auto;
			transform: translateX(-50%);
		}
	}
	.overflow-chip {
		justify-self: end;
		padding: 0.25rem 0.6rem;
		font-size: 0.75rem;
		border-radius: 999px;
		background: var(--social-surface-strong);
		border: 1px solid var(--social-border-strong);
		box-shadow: var(--social-shadow-1);
		color: var(--color-text-muted);
		pointer-events: auto;
	}
</style>
