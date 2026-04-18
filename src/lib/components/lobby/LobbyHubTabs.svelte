<script lang="ts">
	export let active: 'my' | 'public' = 'my';

	const tabs: { id: 'my' | 'public'; label: string }[] = [
		{ id: 'my', label: 'My lobbies' },
		{ id: 'public', label: 'Public' }
	];

	function select(id: 'my' | 'public') {
		active = id;
	}

	function onKeydown(e: KeyboardEvent, id: 'my' | 'public') {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			select(id);
		}
	}
</script>

<div class="hub-tabs" role="tablist" aria-label="Lobby views">
	{#each tabs as t}
		<button
			type="button"
			id="hub-tab-{t.id}"
			class="hub-tab"
			class:active={active === t.id}
			role="tab"
			aria-selected={active === t.id}
			aria-controls="hub-tab-panel"
			tabindex={active === t.id ? 0 : -1}
			on:click={() => select(t.id)}
			on:keydown={(e) => onKeydown(e, t.id)}
		>
			{t.label}
		</button>
	{/each}
</div>

<style>
	.hub-tabs {
		position: relative;
		display: inline-flex;
		gap: 0.25rem;
		padding: 0.2rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--color-text) 6%, transparent);
		border: 1px solid var(--color-border);
		margin-bottom: 1.25rem;
	}
	.hub-tab {
		position: relative;
		z-index: 1;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.45rem 1rem;
		border-radius: 999px;
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s;
	}
	.hub-tab:hover {
		color: var(--color-text);
	}
	.hub-tab:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.hub-tab.active {
		color: var(--color-accent-contrast, #fff);
		background: var(--color-accent);
	}
	@media (prefers-reduced-motion: reduce) {
		.hub-tab {
			transition: none;
		}
	}
</style>
