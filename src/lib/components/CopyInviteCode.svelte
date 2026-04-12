<script lang="ts">
	import { onDestroy } from 'svelte';

	/** Invite code to copy (and optionally show inline). */
	export let code: string;
	/** Show the code text next to the button; if false, only the icon is shown. */
	export let showCode = true;

	let copied = false;
	let clearTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			if (clearTimer) clearTimeout(clearTimer);
			clearTimer = setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			/* clipboard API unavailable */
		}
	}

	onDestroy(() => {
		if (clearTimer) clearTimeout(clearTimer);
	});
</script>

<span class="wrap">
	{#if showCode}
		<strong class="mono">{code}</strong>
	{/if}
	<button
		type="button"
		class="copy"
		on:click={copy}
		title={copied ? 'Copied' : 'Copy invite code'}
		aria-label="Copy invite code"
	>
		{#if copied}
			<span class="ok" aria-hidden="true">✓</span>
		{:else}
			<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
				<rect
					x="9"
					y="9"
					width="13"
					height="13"
					rx="2"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				/>
				<path
					d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				/>
			</svg>
		{/if}
	</button>
</span>

<style>
	.wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		vertical-align: middle;
	}
	.mono {
		font-family: ui-monospace, monospace;
		letter-spacing: 0.04em;
	}
	.copy {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.2rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: #64748b;
		cursor: pointer;
		line-height: 0;
	}
	.copy:hover {
		background: #f1f5f9;
		color: #0f172a;
	}
	.icon {
		width: 1.1rem;
		height: 1.1rem;
	}
	.ok {
		font-size: 0.85rem;
		color: #16a34a;
		font-weight: 700;
	}
</style>
