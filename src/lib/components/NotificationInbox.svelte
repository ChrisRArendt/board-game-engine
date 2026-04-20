<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { onDestroy, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { openConversationUi } from '$lib/dmNavigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import {
		listNotifications,
		markRead,
		markAllRead,
		type NotificationRow
	} from '$lib/notifications';
	import { respondToLobbyInvite } from '$lib/invites';
	import { acceptRequest, declineRequest } from '$lib/friends';
	import { unreadNotificationCount } from '$lib/stores/notificationInbox';
	import type { RealtimeChannel } from '@supabase/supabase-js';

	export let userId: string;

	const supabase = createSupabaseBrowserClient();

	let open = false;
	let tab: 'all' | 'invites' | 'messages' | 'friends' = 'all';
	let items: NotificationRow[] = [];
	let loading = false;
	let markAllBusy = false;
	let bellSwing = false;
	let segWrap: HTMLDivElement | null = null;
	let segInd: HTMLSpanElement | null = null;
	let tabBtns: Record<string, HTMLButtonElement | undefined> = {};

	let prevUnread = 0;
	$: if ($unreadNotificationCount > prevUnread) {
		prevUnread = $unreadNotificationCount;
		if (!open && typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
			bellSwing = true;
			setTimeout(() => (bellSwing = false), 520);
		}
	} else {
		prevUnread = $unreadNotificationCount;
	}

	function placeSegIndicator() {
		const btn = tabBtns[tab];
		if (!btn || !segWrap || !segInd) return;
		const pr = segWrap.getBoundingClientRect();
		const br = btn.getBoundingClientRect();
		segInd.style.left = `${br.left - pr.left}px`;
		segInd.style.width = `${br.width}px`;
	}

	$: tab, open, segWrap, filtered, void tick().then(() => placeSegIndicator());

	let ch: RealtimeChannel | null = null;

	async function refreshList() {
		loading = true;
		try {
			items = await listNotifications(supabase, userId, 80);
		} finally {
			loading = false;
		}
	}

	function subscribe() {
		if (ch) {
			void supabase.removeChannel(ch);
			ch = null;
		}
		ch = supabase
			.channel(`inbox_panel:${userId}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
				() => {
					void refreshList();
				}
			);
		void ch.subscribe();
	}

	$: if (open) {
		void refreshList();
		subscribe();
	} else if (ch) {
		void supabase.removeChannel(ch);
		ch = null;
	}

	onDestroy(() => {
		if (ch) void supabase.removeChannel(ch);
	});

	function filterRows(list: NotificationRow[]): NotificationRow[] {
		if (tab === 'all') return list;
		if (tab === 'invites') return list.filter((r) => r.kind === 'lobby_invite');
		if (tab === 'messages') return list.filter((r) => r.kind === 'dm');
		return list.filter((r) => r.kind === 'friend_request' || r.kind === 'friend_accept');
	}

	$: filtered = filterRows(items);

	function relTime(iso: string): string {
		const t = new Date(iso).getTime();
		const d = Date.now() - t;
		const m = Math.floor(d / 60000);
		if (m < 1) return 'now';
		if (m < 60) return `${m}m`;
		const h = Math.floor(m / 60);
		if (h < 48) return `${h}h`;
		return new Date(iso).toLocaleDateString();
	}

	function titleFor(n: NotificationRow): string {
		if (n.kind === 'lobby_invite') return 'Lobby invite';
		if (n.kind === 'dm') return 'Direct message';
		if (n.kind === 'friend_request') return 'Friend request';
		if (n.kind === 'friend_accept') return 'Friend request accepted';
		return 'Notification';
	}

	async function onMarkAllRead() {
		markAllBusy = true;
		try {
			await markAllRead(supabase, userId);
			await refreshList();
			unreadNotificationCount.set(0);
		} finally {
			markAllBusy = false;
		}
	}

	async function onDismiss(n: NotificationRow) {
		await markRead(supabase, userId, [n.id]);
		items = items.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
		unreadNotificationCount.update((c) => Math.max(0, c - 1));
	}

	async function openRow(n: NotificationRow) {
		if (n.kind === 'lobby_invite') {
			const pl = n.payload as { lobby_id?: string };
			if (pl.lobby_id) void goto(`/lobby/${pl.lobby_id}`);
		} else if (n.kind === 'dm') {
			const pl = n.payload as { conversation_id?: string };
			if (pl.conversation_id) openConversationUi(pl.conversation_id);
		} else if (n.kind === 'friend_request') {
			void goto('/lobby');
		}
		if (!n.read_at) await onDismiss(n);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<svelte:window on:keydown={onKeydown} />

<div class="inbox-root">
	<button
		type="button"
		class="bell"
		class:swing={bellSwing}
		aria-label="Notifications"
		aria-expanded={open}
		on:click={() => (open = !open)}
	>
		<span class="bell-ico" aria-hidden="true">🔔</span>
		{#if $unreadNotificationCount > 0}
			<span class="badge" class:pop={$unreadNotificationCount > 0}>{$unreadNotificationCount > 9 ? '9+' : $unreadNotificationCount}</span>
		{/if}
	</button>

	{#if open}
		<div
			class="popover"
			transition:fly={{ y: -6, duration: 180, easing: cubicOut }}
			role="dialog"
			aria-label="Notifications"
		>
			<header class="pop-head">
				<h2 class="pop-title">Notifications</h2>
				<button
					type="button"
					class="mark-all"
					disabled={$unreadNotificationCount === 0 || markAllBusy}
					on:click={() => onMarkAllRead()}
				>
					Mark all read
				</button>
			</header>

			<div class="seg" bind:this={segWrap}>
				<span class="seg-ind" bind:this={segInd}></span>
				{#each ['all', 'invites', 'messages', 'friends'] as seg}
					<button
						type="button"
						class="seg-btn"
						class:active={tab === seg}
						bind:this={tabBtns[seg]}
						on:click={() => (tab = seg as typeof tab)}
					>
						{seg === 'all'
							? 'All'
							: seg === 'invites'
								? 'Invites'
								: seg === 'messages'
									? 'Messages'
									: 'Friends'}
					</button>
				{/each}
			</div>

			<div class="pop-body">
				{#if loading}
					<div class="skel"></div>
					<div class="skel short"></div>
					<div class="skel"></div>
				{:else if filtered.length === 0}
					<div class="empty">
						<p class="empty-title">You're all caught up</p>
						<p class="empty-sub">No notifications here. Go play something.</p>
					</div>
				{:else}
					<ul class="rows">
						{#each filtered as n (n.id)}
							<!-- Row is a list item with nested buttons; primary area opens detail. -->
							<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
							<li
								class="row"
								class:unread={!n.read_at}
								on:click={() => openRow(n)}
								on:keydown={(e) => e.key === 'Enter' && openRow(n)}
								role="button"
								tabindex="0"
							>
								<div class="row-main">
									<p class="row-title">{titleFor(n)}</p>
									<p class="row-meta">{relTime(n.created_at)}</p>
								</div>
								<div class="row-actions">
									{#if n.kind === 'lobby_invite' && !n.read_at}
										<button
											type="button"
											class="mini"
											on:click|stopPropagation={async () => {
												const pl = n.payload as { invite_id?: string };
												if (pl.invite_id) {
													try {
														await respondToLobbyInvite(supabase, {
															inviteId: pl.invite_id,
															userId,
															decision: 'accepted'
														});
														const pl2 = n.payload as { lobby_id?: string };
														if (pl2.lobby_id) void goto(`/lobby/${pl2.lobby_id}`);
													} catch {
														/* ignore */
													}
												}
											}}
										>
											Accept
										</button>
										<button
											type="button"
											class="mini ghost"
											on:click|stopPropagation={async () => {
												const pl = n.payload as { invite_id?: string };
												if (pl.invite_id) {
													await respondToLobbyInvite(supabase, {
														inviteId: pl.invite_id,
														userId,
														decision: 'declined'
													});
												}
												await onDismiss(n);
											}}
										>
											Decline
										</button>
									{/if}
									{#if n.kind === 'friend_request' && !n.read_at}
										<button
											type="button"
											class="mini"
											on:click|stopPropagation={async () => {
												const pl = n.payload as { friendship_id?: string };
												if (pl.friendship_id) await acceptRequest(supabase, pl.friendship_id);
												await onDismiss(n);
											}}
										>
											OK
										</button>
										<button
											type="button"
											class="mini ghost"
											on:click|stopPropagation={async () => {
												const pl = n.payload as { friendship_id?: string };
												if (pl.friendship_id) await declineRequest(supabase, pl.friendship_id);
												await onDismiss(n);
											}}
										>
											No
										</button>
									{/if}
									<button type="button" class="mini ghost" on:click|stopPropagation={() => onDismiss(n)}>
										Dismiss
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.inbox-root {
		position: relative;
		display: flex;
		align-items: center;
	}
	.bell {
		position: relative;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-nav-link);
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.bell:hover {
		background: rgba(148, 163, 184, 0.15);
	}
	.bell:focus-visible {
		outline: none;
		box-shadow: var(--social-ring);
	}
	.bell.swing {
		animation: bellSwing 0.5s ease-out;
	}
	@keyframes bellSwing {
		0% {
			transform: rotate(-12deg);
		}
		35% {
			transform: rotate(10deg);
		}
		70% {
			transform: rotate(-6deg);
		}
		100% {
			transform: rotate(0);
		}
	}
	.bell-ico {
		font-size: 1.1rem;
	}
	.badge {
		position: absolute;
		top: 2px;
		right: 2px;
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.28rem;
		border-radius: 999px;
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		font-size: 0.65rem;
		font-weight: 700;
		display: grid;
		place-items: center;
		line-height: 1;
		animation: badgePop 0.22s var(--social-ease-out);
	}
	@keyframes badgePop {
		0% {
			transform: scale(0.6);
		}
		60% {
			transform: scale(1.12);
		}
		100% {
			transform: scale(1);
		}
	}
	.popover {
		position: absolute;
		right: 0;
		top: calc(100% + 8px);
		width: min(380px, calc(100vw - 24px));
		max-height: min(70vh, 560px);
		display: flex;
		flex-direction: column;
		border-radius: var(--social-radius);
		background: var(--social-surface-strong);
		border: 1px solid var(--social-border-strong);
		box-shadow: var(--social-shadow-2);
		backdrop-filter: blur(var(--social-blur)) saturate(140%);
		-webkit-backdrop-filter: blur(var(--social-blur)) saturate(140%);
		z-index: 120;
	}
	.pop-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 0.85rem;
		border-bottom: 1px solid var(--social-border);
		gap: 0.5rem;
	}
	.pop-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}
	.mark-all {
		border: none;
		background: transparent;
		color: var(--color-nav-link);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0.2rem 0.35rem;
		border-radius: 6px;
	}
	.mark-all:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.mark-all:hover:not(:disabled) {
		text-decoration: underline;
	}
	.seg {
		position: relative;
		display: flex;
		gap: 0.25rem;
		padding: 0.45rem 0.65rem 0.55rem;
		border-bottom: 1px solid var(--social-border);
	}
	.seg-ind {
		position: absolute;
		bottom: 0.35rem;
		height: 28px;
		border-radius: 8px;
		background: color-mix(in oklab, var(--color-accent) 16%, transparent);
		transition:
			left var(--social-dur) var(--social-ease),
			width var(--social-dur) var(--social-ease);
		pointer-events: none;
		z-index: 0;
	}
	.seg-btn {
		position: relative;
		z-index: 1;
		flex: 1;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		font: inherit;
		font-size: 0.72rem;
		text-transform: capitalize;
		padding: 0.35rem 0.25rem;
		border-radius: 8px;
		cursor: pointer;
	}
	.seg-btn.active {
		color: var(--color-text);
		font-weight: 600;
	}
	.pop-body {
		overflow: auto;
		padding: 0.35rem 0;
		min-height: 120px;
		max-height: min(52vh, 420px);
	}
	.skel {
		height: 44px;
		margin: 0.5rem 0.75rem;
		border-radius: 8px;
		background: linear-gradient(
			90deg,
			var(--social-surface) 0%,
			color-mix(in oklab, var(--color-accent) 12%, var(--social-surface)) 50%,
			var(--social-surface) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.2s ease-in-out infinite;
	}
	.skel.short {
		height: 32px;
		width: 70%;
	}
	@keyframes shimmer {
		0% {
			background-position: 0% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
	.empty {
		padding: 1.5rem 1rem;
		text-align: center;
	}
	.empty-title {
		margin: 0 0 0.35rem;
		font-weight: 600;
	}
	.empty-sub {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.55rem 0.85rem;
		cursor: pointer;
		border-left: 3px solid transparent;
		transition:
			background var(--social-dur-fast) var(--social-ease),
			transform var(--social-dur-fast) var(--social-ease);
	}
	.row.unread {
		border-left-color: var(--color-accent);
		background: color-mix(in oklab, var(--color-accent) 8%, transparent);
	}
	.row:hover {
		background: var(--social-surface-strong);
		transform: translateX(2px);
	}
	.row:focus-visible {
		outline: none;
		box-shadow: inset var(--social-ring);
	}
	.row-main {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		align-items: baseline;
	}
	.row-title {
		margin: 0;
		font-size: 0.88rem;
		font-weight: 600;
	}
	.row-meta {
		margin: 0;
		font-size: 0.72rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}
	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		justify-content: flex-end;
	}
	.mini {
		border-radius: var(--social-radius-sm);
		border: 1px solid var(--social-border-strong);
		background: color-mix(in oklab, var(--color-accent) 22%, transparent);
		color: var(--color-text);
		font: inherit;
		font-size: 0.72rem;
		padding: 0.15rem 0.45rem;
		cursor: pointer;
	}
	.mini.ghost {
		background: transparent;
	}
	.mini:focus-visible {
		box-shadow: var(--social-ring);
	}
</style>
