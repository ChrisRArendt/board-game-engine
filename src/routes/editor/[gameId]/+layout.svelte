<script lang="ts">
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';

	export let data: LayoutData;

	$: gid = data.game.id;
	$: path = $page.url.pathname;
</script>

<div class="shell">
	<nav class="sub">
		<a href="/editor/{gid}" class:active={path === `/editor/${gid}`}>Settings</a>
		<a href="/editor/{gid}/board" class:active={path.includes('/board')}>Board</a>
		<a href="/editor/{gid}/templates" class:active={path.includes('/templates')}>Templates</a>
		<a href="/editor/{gid}/pieces" class:active={path.includes('/pieces')}>Pieces</a>
		<a href="/editor/{gid}/media" class:active={path.includes('/media')}>Media</a>
		<a class="back" href="/editor">Open project</a>
	</nav>
	<div class="content">
		<slot />
	</div>
</div>

<style>
	.shell {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		width: 100%;
		overflow: hidden;
	}
	.sub {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		align-items: center;
	}
	.sub a {
		color: var(--color-text);
		text-decoration: none;
		font-size: 14px;
		padding: 6px 0;
		border-bottom: 2px solid transparent;
	}
	.sub a:hover {
		color: var(--color-accent, #3b82f6);
	}
	.sub a.active {
		border-bottom-color: var(--color-accent, #3b82f6);
		color: var(--color-accent, #3b82f6);
	}
	.back {
		margin-left: auto;
		opacity: 0.85;
	}
	.content {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		width: 100%;
		overflow: hidden;
	}
</style>
