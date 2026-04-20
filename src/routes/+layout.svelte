<script lang="ts">
	import { pageTitle } from '$lib/site';
	import '../app.css';
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import {
		onlineUserIds,
		presenceByUserId,
		selfPresenceMeta,
		type PresencePayload
	} from '$lib/stores/onlinePresence';
	import { unreadNotificationCount } from '$lib/stores/notificationInbox';
	import {
		getUnreadCount,
		subscribeUserNotifications,
		type NotificationRow
	} from '$lib/notifications';
	import { pushToast, dismissToast } from '$lib/stores/toast';
	import { respondToLobbyInvite } from '$lib/invites';
	import { openConversationUi } from '$lib/dmNavigation';
	import DmSheetHost from '$lib/components/messaging/DmSheetHost.svelte';
	import ToastHost from '$lib/components/ToastHost.svelte';
	import NotificationInbox from '$lib/components/NotificationInbox.svelte';
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
	let presenceProfile: ProfileRow | null = null;

	let notifCh: RealtimeChannel | null = null;
	const recentToastNotifIds = new Set<string>();
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
		presenceProfile = null;
		onlineUserIds.set(new Set());
		presenceByUserId.set(new Map());
	}

	async function applyPresenceTrack() {
		if (!browser || !presenceCh || !activePresenceUserId) return;
		const name = presenceProfile?.display_name ?? 'Player';
		const meta = get(selfPresenceMeta) as Record<string, unknown>;
		lastTrackedName = name;
		await presenceCh.track({
			user_id: activePresenceUserId,
			name,
			...meta
		});
	}

	async function syncGlobalPresence(userId: string, profile: ProfileRow | null) {
		if (!browser) return;
		const name = profile?.display_name ?? 'Player';
		presenceProfile = profile;

		if (activePresenceUserId === userId && presenceCh) {
			lastTrackedName = name;
			await applyPresenceTrack();
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
			const nextOnline = new Set<string>();
			const nextPresence = new Map<string, PresencePayload>();
			for (const k of Object.keys(state)) {
				const arr = state[k] as Record<string, unknown>[];
				const raw = arr?.[0];
				if (!raw || typeof raw !== 'object') continue;
				const m = raw as Record<string, unknown>;
				const uid = m.user_id as string | undefined;
				if (!uid) continue;
				nextOnline.add(uid);
				const st = (m.status as PresencePayload['status']) || 'online';
				nextPresence.set(uid, {
					status: st,
					name: m.name as string | undefined,
					lobby_id: m.lobby_id as string | undefined,
					lobby_name: m.lobby_name as string | undefined,
					game_key: m.game_key as string | undefined
				});
			}
			onlineUserIds.set(nextOnline);
			presenceByUserId.set(nextPresence);
		});
		presenceCh = ch;
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED' && presenceCh) {
				await applyPresenceTrack();
			}
		});
	}

	function teardownNotifications() {
		if (notifCh) {
			void supabase.removeChannel(notifCh);
			notifCh = null;
		}
		unreadNotificationCount.set(0);
	}

	async function setupNotifications(userId: string) {
		if (!browser) return;
		teardownNotifications();
		try {
			const n = await getUnreadCount(supabase, userId);
			unreadNotificationCount.set(n);
		} catch {
			unreadNotificationCount.set(0);
		}

		notifCh = subscribeUserNotifications(supabase, userId, {
			onInsert: async (row: NotificationRow) => {
				if (row.read_at) return;
				unreadNotificationCount.update((c) => c + 1);
				if (recentToastNotifIds.has(row.id)) return;
				recentToastNotifIds.add(row.id);
				setTimeout(() => recentToastNotifIds.delete(row.id), 4000);

				if (row.kind === 'lobby_invite') {
					const pl = row.payload as {
						lobby_id?: string;
						invite_id?: string;
						inviter_id?: string;
					};
					const { data: inviter } = await supabase
						.from('profiles')
						.select('display_name')
						.eq('id', pl.inviter_id ?? '')
						.maybeSingle();
					const title = inviter?.display_name
						? `${inviter.display_name} invited you`
						: 'Lobby invite';
					let toastId = '';
					toastId = pushToast({
						kind: 'invite',
						title,
						body: 'Tap View to open the lobby.',
						ttlMs: 22000,
						actions: [
							{
								label: 'View',
								onClick: () => {
									dismissToast(toastId);
									if (pl.lobby_id) void goto(`/lobby/${pl.lobby_id}`);
								}
							},
							{
								label: 'Decline',
								onClick: async () => {
									dismissToast(toastId);
									if (pl.invite_id) {
										try {
											await respondToLobbyInvite(supabase, {
												inviteId: pl.invite_id,
												userId,
												decision: 'declined'
											});
										} catch {
											/* ignore */
										}
									}
								}
							}
						]
					});
				} else if (row.kind === 'dm') {
					const pl = row.payload as { conversation_id?: string; preview?: string };
					let dmToastId = '';
					dmToastId = pushToast({
						kind: 'dm',
						title: 'New message',
						body: pl.preview ? String(pl.preview) : 'Open your inbox',
						ttlMs: 12000,
						actions: [
							{
								label: 'Open',
								onClick: () => {
									dismissToast(dmToastId);
									if (pl.conversation_id) openConversationUi(pl.conversation_id);
								}
							}
						]
					});
				}
			},
			onUpdate: async () => {
				try {
					const n = await getUnreadCount(supabase, userId);
					unreadNotificationCount.set(n);
				} catch {
					/* ignore */
				}
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

	$: if (browser && presenceCh && activePresenceUserId) {
		$selfPresenceMeta;
		void applyPresenceTrack();
	}

	let lastNotifUid = '';
	$: if (browser && data.session?.user?.id) {
		const uid = data.session.user.id;
		if (uid !== lastNotifUid) {
			lastNotifUid = uid;
			void setupNotifications(uid);
		}
	} else if (browser) {
		lastNotifUid = '';
		teardownNotifications();
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
		teardownNotifications();
		registerFriendVoiceSaver(null);
		void leaveVoiceRoom();
	});

	async function signOut() {
		teardownGlobalPresence();
		teardownNotifications();
		registerFriendVoiceSaver(null);
		void leaveVoiceRoom();
		await supabase.auth.signOut();
		window.location.href = '/login';
	}

	$: hideNav = $page.url.pathname === '/login' || $page.url.pathname.startsWith('/play');

	/** Only /play locks the viewport (tabletop); lobby and login scroll normally */
	$: lockTabletopViewport = $page.url.pathname.startsWith('/play');

	/** Editor uses a fixed-height shell so the document does not show a viewport scrollbar */
	$: editorViewportLock = $page.url.pathname.startsWith('/editor');

	$: docTitle = typeof data.title === 'string' ? data.title : pageTitle('Home');

	$: if (browser && typeof document !== 'undefined') {
		document.body.classList.remove('app-shell', 'app-tabletop', 'app-editor');
		if (lockTabletopViewport) document.body.classList.add('app-tabletop');
		else if (editorViewportLock) document.body.classList.add('app-editor');
		else document.body.classList.add('app-shell');
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
				<a href="/messages">Messages</a>
				<NotificationInbox userId={data.session.user.id} />
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
					<a href="/messages">Messages</a>
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

<main class="app-main">
	<slot />
</main>

{#if data.session}
	<ToastHost />
	<DmSheetHost userId={data.session.user.id} />
{/if}

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
	.app-main {
		flex: 1 1 auto;
		min-height: 0;
		width: 100%;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
	}
	:global(body.app-editor) .app-main {
		flex: 1 1 0;
		overflow: hidden;
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
