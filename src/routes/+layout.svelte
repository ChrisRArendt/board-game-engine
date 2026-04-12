<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { onlineUserIds } from '$lib/stores/onlinePresence';
	import UserIdentity from '$lib/components/UserIdentity.svelte';
	import type { RealtimeChannel, Session } from '@supabase/supabase-js';
	import type { ProfileRow } from '$lib/supabase/database.types';

	export let data: { session: Session | null; profile: ProfileRow | null };

	const supabase = createSupabaseBrowserClient();

	let presenceCh: RealtimeChannel | null = null;
	let activePresenceUserId: string | null = null;
	let lastTrackedName: string | undefined;
	/** Only re-run global presence when session / display name actually changes (avoids reconnect storms). */
	let presenceSyncKey = '';

	function teardownGlobalPresence() {
		if (presenceCh) {
			void supabase.removeChannel(presenceCh);
			presenceCh = null;
		}
		activePresenceUserId = null;
		lastTrackedName = undefined;
		onlineUserIds.set(new Set());
	}

	async function syncGlobalPresence(userId: string, profile: ProfileRow | null) {
		if (!browser) return;
		const name = profile?.display_name ?? 'Player';

		if (activePresenceUserId === userId && presenceCh) {
			if (lastTrackedName !== name) {
				lastTrackedName = name;
				await presenceCh.track({ user_id: userId, name });
			}
			return;
		}

		teardownGlobalPresence();
		activePresenceUserId = userId;
		lastTrackedName = name;

		const ch = supabase.channel('online:global', {
			config: { presence: { key: userId } }
		});
		ch.on('presence', { event: 'sync' }, () => {
			const state = ch.presenceState();
			const next = new Set<string>();
			for (const k of Object.keys(state)) {
				const arr = state[k] as { user_id?: string }[];
				const uid = arr?.[0]?.user_id;
				if (uid) next.add(uid);
			}
			onlineUserIds.set(next);
		});
		presenceCh = ch;
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED' && presenceCh) {
				await presenceCh.track({
					user_id: userId,
					name
				});
			}
		});
	}

	$: if (browser && data.session?.user?.id) {
		const key = `${data.session.user.id}:${data.profile?.display_name ?? ''}`;
		if (key !== presenceSyncKey) {
			presenceSyncKey = key;
			void syncGlobalPresence(data.session.user.id, data.profile);
		}
	} else if (browser) {
		if (presenceSyncKey !== '') {
			presenceSyncKey = '';
			teardownGlobalPresence();
		}
	}

	onDestroy(() => {
		teardownGlobalPresence();
	});

	async function signOut() {
		teardownGlobalPresence();
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
				<div class="user-wrap">
					<UserIdentity
						variant="nav"
						displayName={data.profile?.display_name ?? data.session.user.email ?? 'Player'}
						avatarUrl={data.profile?.avatar_url}
						subtitle={data.session.user.email ?? undefined}
					/>
				</div>
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
	.user-wrap {
		display: flex;
		align-items: center;
		max-width: min(280px, 40vw);
	}
	.user-wrap :global(.identity.nav .sub) {
		color: #94a3b8;
		font-size: 0.72rem;
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
