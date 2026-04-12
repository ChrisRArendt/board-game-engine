<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import type { Session } from '@supabase/supabase-js';

	export let data: { session: Session | null };

	const supabase = createSupabaseBrowserClient();

	async function signOut() {
		await supabase.auth.signOut();
		window.location.href = '/login';
	}

	$: hideNav = $page.url.pathname === '/login' || $page.url.pathname.startsWith('/play');
</script>

{#if !hideNav}
	<header class="nav">
		<a class="brand" href="/">Board Game Engine</a>
		<nav>
			{#if data.session}
				<a href="/lobby">Lobby</a>
				<span class="user">{data.session.user.email ?? data.session.user.id.slice(0, 8)}</span>
				<button type="button" class="linkish" on:click={signOut}>Sign out</button>
			{:else}
				<a href="/login">Sign in</a>
			{/if}
		</nav>
	</header>
{/if}

<main class:pad={!hideNav}>
	<slot />
</main>

<style>
	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 1.25rem;
		background: #1e293b;
		color: #f8fafc;
		font-family: Roboto, system-ui, sans-serif;
		font-size: 0.95rem;
	}
	.brand {
		color: inherit;
		text-decoration: none;
		font-weight: 600;
	}
	.nav nav {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.nav a {
		color: #93c5fd;
		text-decoration: none;
	}
	.nav a:hover {
		text-decoration: underline;
	}
	.user {
		color: #94a3b8;
		font-size: 0.85rem;
	}
	.linkish {
		background: none;
		border: none;
		color: #93c5fd;
		cursor: pointer;
		font: inherit;
		padding: 0;
	}
	.linkish:hover {
		text-decoration: underline;
	}
	main.pad {
		min-height: calc(100vh - 48px);
	}
</style>
