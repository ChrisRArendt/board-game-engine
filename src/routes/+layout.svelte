<script lang="ts">
	import { pageTitle } from '$lib/site';
	import '../app.css';
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { onlineUserIds } from '$lib/stores/onlinePresence';
	import { persistSettings, settings } from '$lib/stores/settings';
	import {
		applyThemePreference,
		subscribeSystemThemeChange,
		themeColorForMeta
	} from '$lib/theme';
	import { registerFriendVoiceSaver } from '$lib/stores/voiceSettings';
	import { leaveVoiceRoom } from '$lib/stores/voiceChat';
	import UserIdentity from '$lib/components/UserIdentity.svelte';
	import type { RealtimeChannel, Session } from '@supabase/supabase-js';
	import type { ProfileRow } from '$lib/supabase/database.types';

	export let data: { session: Session | null; profile: ProfileRow | null; title?: string };

	const supabase = createSupabaseBrowserClient();

	let presenceCh: RealtimeChannel | null = null;
	let activePresenceUserId: string | null = null;
	let lastTrackedName: string | undefined;
	/** Only re-run global presence when session / display name actually changes (avoids reconnect storms). */
	let presenceSyncKey = '';
	/** Apply server-stored player color once per profile load (account source of truth). */
	let lastAppliedProfileColorKey = '';

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

	$: if (browser && data.session?.user?.id && data.profile) {
		const srv = data.profile.player_color?.trim() ?? '';
		const key = `${data.session.user.id}:${srv}`;
		if (key !== lastAppliedProfileColorKey) {
			lastAppliedProfileColorKey = key;
			if (srv && /^#[0-9A-Fa-f]{6}$/.test(srv)) {
				persistSettings({ playerColor: srv.toLowerCase() });
			}
		}
	}

	let unsubscribeTheme: (() => void) | null = null;
	let unsubscribeSystemTheme: (() => void) | null = null;

	onMount(() => {
		unsubscribeTheme = settings.subscribe((s) => {
			applyThemePreference(s.themePreference);
			unsubscribeSystemTheme?.();
			unsubscribeSystemTheme =
				s.themePreference === 'system'
					? subscribeSystemThemeChange(() => applyThemePreference('system'))
					: null;
		});
		return () => {
			unsubscribeTheme?.();
			unsubscribeSystemTheme?.();
		};
	});

	onDestroy(() => {
		teardownGlobalPresence();
		registerFriendVoiceSaver(null);
		void leaveVoiceRoom();
	});

	async function signOut() {
		teardownGlobalPresence();
		registerFriendVoiceSaver(null);
		void leaveVoiceRoom();
		await supabase.auth.signOut();
		window.location.href = '/login';
	}

	$: hideNav = $page.url.pathname === '/login' || $page.url.pathname.startsWith('/play');

	/** Only /play locks the viewport (tabletop); lobby and login scroll normally */
	$: lockTabletopViewport = $page.url.pathname.startsWith('/play');

	$: docTitle = typeof data.title === 'string' ? data.title : pageTitle('Home');

	$: if (browser && typeof document !== 'undefined') {
		document.body.classList.remove('app-shell', 'app-tabletop');
		document.body.classList.add(lockTabletopViewport ? 'app-tabletop' : 'app-shell');
	}
</script>

<svelte:head>
	<title>{docTitle}</title>
	<meta name="theme-color" content={themeColorForMeta($settings.themePreference)} />
</svelte:head>

{#if !hideNav}
	<header class="nav">
		<a class="brand" href="/">
			<span class="brand-full">Board Game Engine</span>
			<span class="brand-short">BGE</span>
		</a>
		<nav class="nav-desktop" aria-label="Account">
			{#if data.session}
				<a href="/lobby">Lobbies</a>
				<a href="/editor">Editor</a>
				<a href="/settings">Settings</a>
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
		{#if data.session}
			<details class="nav-mobile">
				<summary class="nav-mobile-trigger">Menu</summary>
				<div class="nav-mobile-panel">
					<a href="/lobby">Lobbies</a>
					<a href="/editor">Editor</a>
					<a href="/settings">Settings</a>
					<span class="nav-mobile-name">{data.profile?.display_name ?? data.session.user.email ?? 'Player'}</span>
					<button type="button" class="linkish nav-mobile-out" on:click={signOut}>Sign out</button>
				</div>
			</details>
		{:else}
			<a class="nav-mobile-signin" href="/login">Sign in</a>
		{/if}
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
		background: var(--color-nav-bg);
		color: var(--color-nav-text);
		font-family: Roboto, system-ui, sans-serif;
		font-size: 0.95rem;
	}
	/* app.css sets user-select: none globally (for the tabletop); allow copying in the shell UI */
	.nav :global(*) {
		user-select: text;
		cursor: revert;
	}
	.brand {
		color: inherit;
		text-decoration: none;
		font-weight: 600;
		flex-shrink: 0;
	}
	.brand-short {
		display: none;
	}
	.nav-desktop {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.nav a {
		color: var(--color-nav-link);
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
		color: var(--color-nav-muted);
		font-size: 0.72rem;
	}
	.linkish {
		background: none;
		border: none;
		color: var(--color-nav-link);
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
	.nav-mobile,
	.nav-mobile-signin {
		display: none;
	}
	@media (max-width: 639px) {
		.nav {
			padding: 0.5rem 0.75rem;
			gap: 0.5rem;
		}
		.brand-full {
			display: none;
		}
		.brand-short {
			display: inline;
		}
		.nav-desktop {
			display: none;
		}
		.nav-mobile {
			display: block;
			margin-left: auto;
			position: relative;
		}
		.nav-mobile-signin {
			display: inline-block;
			margin-left: auto;
			color: var(--color-nav-link);
			font-size: 0.9rem;
		}
		.nav-mobile-trigger {
			list-style: none;
			cursor: pointer;
			color: var(--color-nav-link);
			font-size: 0.85rem;
			font-weight: 500;
			padding: 0.35rem 0.5rem;
			border: 1px solid rgba(148, 163, 184, 0.45);
			border-radius: 6px;
			background: rgba(15, 23, 42, 0.5);
		}
		.nav-mobile-trigger::-webkit-details-marker {
			display: none;
		}
		.nav-mobile-panel {
			position: absolute;
			right: 0;
			top: calc(100% + 6px);
			min-width: 200px;
			padding: 0.65rem 0.85rem;
			background: var(--color-surface-muted);
			border: 1px solid var(--color-border);
			border-radius: 8px;
			box-shadow: var(--shadow-lg);
			display: flex;
			flex-direction: column;
			gap: 0.65rem;
			z-index: 100;
		}
		.nav-mobile-panel a {
			color: var(--color-nav-link);
			text-decoration: none;
		}
		.nav-mobile-name {
			font-size: 0.8rem;
			color: var(--color-nav-muted);
			word-break: break-word;
		}
		.nav-mobile-out {
			text-align: left;
			padding: 0;
		}
	}
</style>
