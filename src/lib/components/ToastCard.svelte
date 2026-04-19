<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { dismissToast, type ToastItem } from '$lib/stores/toast';

	export let t: ToastItem;

	let hovered = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	function arm() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		if (!t.ttlMs || t.ttlMs <= 0) return;
		if (hovered && t.pauseOnHover) return;
		timer = setTimeout(() => {
			timer = null;
			dismissToast(t.id);
		}, t.ttlMs);
	}

	$: t.id, t.ttlMs, hovered, arm();

	onDestroy(() => {
		if (timer) clearTimeout(timer);
	});

	function accentFor(kind: ToastItem['kind']): string {
		switch (kind) {
			case 'success':
				return '#22c55e';
			case 'warn':
				return '#eab308';
			case 'error':
				return 'var(--color-danger)';
			case 'invite':
				return 'var(--color-accent)';
			case 'dm':
				return '#a855f7';
			default:
				return 'var(--color-accent)';
		}
	}
</script>

<div
	class="toast-card"
	class:pulse-invite={t.kind === 'invite'}
	style:--accent-bar={accentFor(t.kind)}
	in:fly={{ y: -12, duration: 220, easing: cubicOut }}
	out:fly={{ y: -8, duration: 180, easing: cubicOut }}
	on:mouseenter={() => {
		hovered = true;
	}}
	on:mouseleave={() => {
		hovered = false;
	}}
	role={t.actions?.length ? 'alertdialog' : 'status'}
	aria-label={t.title}
>
	<div class="toast-inner">
		<div class="toast-accent" aria-hidden="true"></div>
		<div class="toast-body">
			<p class="toast-title">{t.title}</p>
			{#if t.body}
				<p class="toast-sub">{t.body}</p>
			{/if}
		</div>
		{#if t.actions?.length}
			<div class="toast-actions">
				{#each t.actions as a}
					<button type="button" class="toast-btn" on:click={() => a.onClick()}>{a.label}</button>
				{/each}
			</div>
		{/if}
	</div>
	{#if t.ttlMs && t.ttlMs > 0}
		<div
			class="ttl-bar"
			style:animation-duration="{t.ttlMs}ms"
			class:ttl-paused={hovered && t.pauseOnHover}
		></div>
	{/if}
</div>

<style>
	.toast-card {
		position: relative;
		border-radius: var(--social-radius);
		background: var(--social-surface-strong);
		border: 1px solid var(--social-border-strong);
		box-shadow: var(--social-shadow-2);
		backdrop-filter: blur(var(--social-blur)) saturate(140%);
		-webkit-backdrop-filter: blur(var(--social-blur)) saturate(140%);
		overflow: hidden;
		max-width: 380px;
	}
	.toast-card.pulse-invite {
		animation: invitePulse 0.6s ease-out 2;
	}
	@keyframes invitePulse {
		0% {
			box-shadow: var(--social-shadow-2), 0 0 0 0 color-mix(in oklab, var(--color-accent) 45%, transparent);
		}
		100% {
			box-shadow: var(--social-shadow-2), 0 0 0 14px transparent;
		}
	}
	.toast-inner {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding: 0.75rem 0.85rem 0.5rem;
	}
	.toast-accent {
		width: 3px;
		align-self: stretch;
		min-height: 2.5rem;
		border-radius: 2px;
		background: var(--accent-bar);
		flex-shrink: 0;
	}
	.toast-body {
		flex: 1;
		min-width: 0;
	}
	.toast-title {
		margin: 0;
		font-weight: 600;
		font-size: 0.92rem;
		line-height: 1.25;
		color: var(--color-text);
	}
	.toast-sub {
		margin: 0.25rem 0 0;
		font-size: 0.82rem;
		color: var(--color-text-muted);
		line-height: 1.35;
	}
	.toast-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: flex-start;
		padding-top: 0.15rem;
	}
	.toast-btn {
		border-radius: var(--social-radius-sm);
		border: 1px solid var(--social-border-strong);
		background: color-mix(in oklab, var(--color-accent) 18%, transparent);
		color: var(--color-text);
		font: inherit;
		font-size: 0.78rem;
		padding: 0.25rem 0.55rem;
		cursor: pointer;
		transition:
			transform var(--social-dur-fast) var(--social-ease),
			background var(--social-dur-fast) var(--social-ease);
	}
	.toast-btn:hover {
		transform: translateY(-1px);
		background: color-mix(in oklab, var(--color-accent) 28%, transparent);
	}
	.toast-btn:focus-visible {
		outline: none;
		box-shadow: var(--social-ring);
	}
	.toast-btn:active {
		transform: translateY(0) scale(0.98);
	}
	.ttl-bar {
		height: 2px;
		background: color-mix(in oklab, var(--color-accent) 55%, transparent);
		transform-origin: left center;
		animation-name: ttlShrink;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
	}
	.ttl-paused {
		animation-play-state: paused;
	}
	@keyframes ttlShrink {
		from {
			transform: scaleX(1);
		}
		to {
			transform: scaleX(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.toast-card.pulse-invite {
			animation: none;
		}
	}
</style>
