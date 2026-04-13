<script lang="ts">
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
</script>

<div class="settings-page">
	<h1>Settings</h1>
	<p class="intro">Interface, tabletop controls, your color, and voice devices — same options as in a game.</p>
	<div class="panel-wrap">
		<SettingsPanel />
	</div>
	<p class="back">
		<a href="/lobby">← Back to lobbies</a>
	</p>
</div>

<style>
	.settings-page {
		max-width: 520px;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 3rem;
		font-family: Roboto, system-ui, sans-serif;
	}
	@media (max-width: 639px) {
		.settings-page {
			padding-bottom: calc(3.5rem + env(safe-area-inset-bottom, 0px));
		}
	}
	h1 {
		margin: 0 0 0.35rem;
		font-size: 1.65rem;
		color: var(--color-text);
	}
	.intro {
		margin: 0 0 1.25rem;
		font-size: 0.95rem;
		line-height: 1.45;
		color: var(--color-text-muted);
	}
	.panel-wrap {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}
	.panel-wrap :global(.set) {
		width: 100%;
		max-height: none;
		padding: 12px 14px 16px;
	}
	@media (max-width: 639px) {
		.panel-wrap :global(.set) {
			padding-bottom: calc(16px + 1.35rem + env(safe-area-inset-bottom, 0px));
		}
	}
	.back {
		margin: 1.5rem 0 0;
		font-size: 0.9rem;
	}
	.back a {
		color: var(--color-link);
		text-decoration: none;
	}
	.back a:hover {
		text-decoration: underline;
	}
</style>
