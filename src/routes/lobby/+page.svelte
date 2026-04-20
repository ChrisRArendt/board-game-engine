<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import {
		searchUsers,
		sendFriendRequest,
		acceptRequest,
		declineRequest,
		removeFriend,
		getFriends,
		getPendingIncoming,
		getPendingOutgoing,
		type FriendWithProfile,
		type PendingRequest,
		type PendingOutgoing
	} from '$lib/friends';
	import {
		createLobby,
		joinLobbyByCode,
		listMyWaitingLobbies,
		listMyActiveGames,
		listPublicLobbies,
		deleteLobby,
		endGame,
		getPublicLobbyDetail,
		type LobbyRow,
		type PublicLobbyDetail
	} from '$lib/lobby';
	import type { Database } from '$lib/supabase/database.types';
	import { goto } from '$app/navigation';
	import { presenceByUserId } from '$lib/stores/onlinePresence';
	import { sendLobbyInvite } from '$lib/invites';
	import { openConversationWith } from '$lib/dm';
	import { openConversationUi } from '$lib/dmNavigation';
	import { pushToast } from '$lib/stores/toast';
	import type { RealtimeChannel } from '@supabase/supabase-js';
	import CopyInviteCode from '$lib/components/CopyInviteCode.svelte';
	import {
		coverUrlForGameKey,
		loadPlayableGameOptions,
		type PlayableGameOption
	} from '$lib/customGames';
	import type { PageData } from './$types';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import LobbyHubTabs from '$lib/components/lobby/LobbyHubTabs.svelte';
	import InProgressGames from '$lib/components/lobby/InProgressGames.svelte';
	import GameCatalogGrid from '$lib/components/lobby/GameCatalogGrid.svelte';
	import JoinByCode from '$lib/components/lobby/JoinByCode.svelte';
	import PublicLobbyBrowser from '$lib/components/lobby/PublicLobbyBrowser.svelte';
	import FriendsRail from '$lib/components/lobby/FriendsRail.svelte';

	export let data: PageData;

	function currentUserId(): string {
		const s = data.session;
		if (!s?.user?.id) throw new Error('Not signed in');
		return s.user.id;
	}

	const supabase = createSupabaseBrowserClient();

	let profile: Database['public']['Tables']['profiles']['Row'] | null = null;
	let friends: FriendWithProfile[] = [];
	let pending: PendingRequest[] = [];
	let outgoing: PendingOutgoing[] = [];
	let myWaitingLobbies: LobbyRow[] = [];
	let myGames: LobbyRow[] = [];
	let gameOptions: PlayableGameOption[] = [];
	let searchQ = '';
	let searchResults: Database['public']['Tables']['profiles']['Row'][] = [];
	let loading = false;
	let errMsg = '';

	let hubTab: 'my' | 'public' = 'my';
	let joinCode = '';
	let creatingGameKey: string | null = null;

	let publicRows: LobbyRow[] = [];
	let publicLoading = false;
	/** After first successful fetch, list updates use quiet mode (no skeleton) to avoid flashing on Realtime. */
	let publicListHasLoadedOnce = false;
	let publicSearchQ = '';
	let publicGameFilter = '';
	let selectedPublicId: string | null = null;
	let publicDetail: PublicLobbyDetail | null = null;
	let loadingPublicDetail = false;
	let busyJoinId: string | null = null;
	let publicListTimer: ReturnType<typeof setTimeout> | null = null;

	let friendshipsCh: RealtimeChannel | null = null;
	let friendPingCh: RealtimeChannel | null = null;
	let lobbiesCh: RealtimeChannel | null = null;
	let customGamesCh: RealtimeChannel | null = null;

	const FRIEND_LIST_BROADCAST = 'friend_lists_refresh';

	let friendHostLobbies = new Map<string, LobbyRow>();

	async function refreshFriendHostLobbies() {
		try {
			const ids = friends.map((f) => f.profile.id);
			if (!ids.length) {
				friendHostLobbies = new Map();
				return;
			}
			const { data, error } = await supabase
				.from('lobbies')
				.select('*')
				.in('host_id', ids)
				.eq('status', 'waiting');
			if (error) throw error;
			const m = new Map<string, LobbyRow>();
			for (const row of data ?? []) {
				if (row.host_id) m.set(row.host_id, row);
			}
			friendHostLobbies = m;
		} catch {
			friendHostLobbies = new Map();
		}
	}

	async function notifyPeerFriendshipRefresh(peerId: string) {
		const ch = supabase.channel(`friendship_ping:${peerId}`, {
			config: { broadcast: { ack: true } }
		});
		await new Promise<void>((resolve, reject) => {
			const t = setTimeout(() => reject(new Error('subscribe timeout')), 8000);
			ch.subscribe(async (status) => {
				if (status !== 'SUBSCRIBED') return;
				clearTimeout(t);
				try {
					await ch.send({
						type: 'broadcast',
						event: FRIEND_LIST_BROADCAST,
						payload: {}
					});
				} finally {
					await supabase.removeChannel(ch);
				}
				resolve();
			});
		});
	}

	async function refreshFriendLists() {
		try {
			const id = currentUserId();
			friends = await getFriends(supabase, id);
			pending = await getPendingIncoming(supabase, id);
			outgoing = await getPendingOutgoing(supabase, id);
			await refreshFriendHostLobbies();
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Error';
		}
	}

	async function refreshLobbyLists() {
		try {
			const id = currentUserId();
			myGames = await listMyActiveGames(supabase, id);
			myWaitingLobbies = await listMyWaitingLobbies(supabase, id);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Error';
		}
	}

	async function loadPublicList(opts?: { quiet?: boolean }) {
		const quiet = opts?.quiet === true;
		if (!quiet) publicLoading = true;
		try {
			publicRows = await listPublicLobbies(supabase, {
				q: publicSearchQ || undefined,
				gameKey: publicGameFilter || undefined
			});
			if (selectedPublicId && !publicRows.some((r) => r.id === selectedPublicId)) {
				selectedPublicId = null;
				publicDetail = null;
			}
			publicListHasLoadedOnce = true;
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Error';
		} finally {
			if (!quiet) publicLoading = false;
		}
	}

	function schedulePublicList() {
		if (hubTab !== 'public') return;
		if (publicListTimer) clearTimeout(publicListTimer);
		publicListTimer = setTimeout(() => {
			/* Quiet after first paint so search debounce + Realtime do not toggle the skeleton. */
			void loadPublicList({ quiet: publicListHasLoadedOnce });
			publicListTimer = null;
		}, 320);
	}

	$: {
		hubTab;
		publicSearchQ;
		publicGameFilter;
		if (hubTab !== 'public') {
			if (publicListTimer) clearTimeout(publicListTimer);
			publicListTimer = null;
		} else {
			schedulePublicList();
		}
	}

	$: myHostedWaitingLobby =
		myWaitingLobbies.find((l) => l.host_id === currentUserId()) ?? null;

	async function refresh() {
		loading = true;
		errMsg = '';
		try {
			const { data: p } = await supabase.from('profiles').select('*').eq('id', currentUserId()).single();
			profile = p;
			await refreshFriendLists();
			await refreshLobbyLists();
			gameOptions = await loadPlayableGameOptions(supabase, PUBLIC_SUPABASE_URL);
			if (hubTab === 'public') {
				await loadPublicList({ quiet: false });
			}
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Error';
		}
		loading = false;
	}

	async function onInviteFriendToHost(friendId: string) {
		const host = myHostedWaitingLobby;
		if (!host) return;
		try {
			await sendLobbyInvite(supabase, {
				lobbyId: host.id,
				inviteeId: friendId,
				inviterId: currentUserId()
			});
			pushToast({ kind: 'success', title: 'Invite sent' });
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not invite';
		}
	}

	function onJoinFriendLobby(lobbyId: string) {
		void goto(`/lobby/${lobbyId}`);
	}

	async function onMessageFriend(friendId: string) {
		try {
			const cid = await openConversationWith(supabase, friendId);
			openConversationUi(cid);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not open chat';
		}
	}

	async function doSearch() {
		searchResults = await searchUsers(supabase, searchQ, currentUserId());
	}

	async function addFriend(uid: string) {
		await sendFriendRequest(supabase, uid, currentUserId());
		searchResults = [];
		searchQ = '';
		await refresh();
	}

	async function accept(id: string) {
		await acceptRequest(supabase, id);
		await refresh();
	}

	async function decline(id: string) {
		const row = pending.find((p) => p.id === id);
		await declineRequest(supabase, id);
		if (row?.requester.id) {
			try {
				await notifyPeerFriendshipRefresh(row.requester.id);
			} catch {
				/* peer may refresh via unfiltered postgres_changes */
			}
		}
		await refresh();
	}

	async function cancelOutgoing(friendshipId: string) {
		const row = outgoing.find((o) => o.id === friendshipId);
		await removeFriend(supabase, friendshipId);
		if (row?.addressee.id) {
			try {
				await notifyPeerFriendshipRefresh(row.addressee.id);
			} catch {
				/* peer may refresh via unfiltered postgres_changes */
			}
		}
		await refresh();
	}

	function defaultLobbyNameForGame(gameKey: string): string {
		const g = gameOptions.find((x) => x.key === gameKey);
		return g ? `${g.label} — Game night` : 'Game night';
	}

	async function pickGame(gameKey: string) {
		if (!profile) return;
		creatingGameKey = gameKey;
		errMsg = '';
		try {
			const lobby = await createLobby(supabase, {
				hostId: currentUserId(),
				name: defaultLobbyNameForGame(gameKey),
				gameKey,
				maxPlayers: 6,
				description: '',
				visibility: 'private'
			});
			await goto(`/lobby/${lobby.id}`);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not create lobby';
		}
		creatingGameKey = null;
	}

	async function join() {
		loading = true;
		errMsg = '';
		try {
			const lobby = await joinLobbyByCode(supabase, joinCode, currentUserId());
			await goto(`/lobby/${lobby.id}`);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not join';
		}
		loading = false;
	}

	async function deleteMyLobby(lobby: LobbyRow) {
		if (!confirm(`Delete "${lobby.name}"? This cannot be undone.`)) return;
		try {
			await deleteLobby(supabase, lobby.id, currentUserId());
			await refresh();
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not delete';
		}
	}

	async function endMyGame(lobby: LobbyRow) {
		if (!confirm(`End "${lobby.name}"? Board state will be lost.`)) return;
		try {
			await endGame(supabase, lobby.id, currentUserId());
			await refresh();
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not end game';
		}
	}

	async function onPublicSelectRow(id: string) {
		selectedPublicId = id;
		loadingPublicDetail = true;
		publicDetail = null;
		try {
			publicDetail = await getPublicLobbyDetail(supabase, id);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not load lobby';
		}
		loadingPublicDetail = false;
	}

	async function joinPublicLobby(id: string) {
		busyJoinId = id;
		errMsg = '';
		try {
			await goto(`/lobby/${id}`);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not open lobby';
		} finally {
			busyJoinId = null;
		}
	}

	onMount(async () => {
		await refresh();

		const myId = currentUserId();
		friendshipsCh = supabase
			.channel(`friendships:${myId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'friendships'
				},
				() => {
					void refreshFriendLists();
				}
			);
		void friendshipsCh.subscribe();

		friendPingCh = supabase.channel(`friendship_ping:${myId}`, {
			config: { broadcast: { self: false } }
		});
		friendPingCh.on('broadcast', { event: FRIEND_LIST_BROADCAST }, () => {
			void refreshFriendLists();
		});
		void friendPingCh.subscribe();

		lobbiesCh = supabase
			.channel(`lobbies_hub:${myId}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'lobbies' },
				() => {
					void refreshLobbyLists();
					void refreshFriendHostLobbies();
					/* Quiet: full-screen skeleton on every row change caused visible flashing. */
					if (hubTab === 'public') void loadPublicList({ quiet: true });
				}
			);
		void lobbiesCh.subscribe();

		customGamesCh = supabase
			.channel('custom_board_games_list')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'custom_board_games' },
				() => {
					void loadPlayableGameOptions(supabase, PUBLIC_SUPABASE_URL).then((o) => {
						gameOptions = o;
					});
				}
			);
		void customGamesCh.subscribe();
	});

	onDestroy(() => {
		if (publicListTimer) clearTimeout(publicListTimer);
		if (friendshipsCh) {
			void supabase.removeChannel(friendshipsCh);
			friendshipsCh = null;
		}
		if (friendPingCh) {
			void supabase.removeChannel(friendPingCh);
			friendPingCh = null;
		}
		if (lobbiesCh) {
			void supabase.removeChannel(lobbiesCh);
			lobbiesCh = null;
		}
		if (customGamesCh) {
			void supabase.removeChannel(customGamesCh);
			customGamesCh = null;
		}
	});
</script>

<div class="hub">
	<header class="hub-header">
		<h1>Lobbies</h1>
		<p class="subnav">
			<a href="/editor">Board editor</a>
			<span class="muted">— create games your friends can pick when hosting.</span>
		</p>
	</header>

	{#if errMsg}
		<p class="err">{errMsg}</p>
	{/if}

	<LobbyHubTabs bind:active={hubTab} />

	<div id="hub-tab-panel" class="hub-body" role="tabpanel" aria-labelledby="hub-tab-{hubTab}">
		<div class="hub-main">
			{#if hubTab === 'my'}
				<InProgressGames
					games={myGames}
					loading={loading}
					coverUrlForGame={(gk) => coverUrlForGameKey(gk, gameOptions)}
					currentUserId={currentUserId()}
					onEnd={endMyGame}
				/>

				<hr class="divider" />

				<section class="section my-open" aria-labelledby="my-open-h">
					<h2 id="my-open-h" class="section-title">Your open lobbies</h2>
					{#if loading}
						<p class="muted skeleton-line">Loading…</p>
					{:else if myWaitingLobbies.length === 0}
						<p class="empty">None yet — pick a game below to host.</p>
					{:else}
						<ul class="slim-lobby-list">
							{#each myWaitingLobbies as L (L.id)}
								<li class="slim-row">
									<a class="slim-link" href="/lobby/{L.id}">{L.name}</a>
									<span class="vis-badge" title="Visibility">{L.visibility}</span>
									<span class="code-wrap"><CopyInviteCode code={L.invite_code} /></span>
									{#if L.host_id === currentUserId()}
										<button
											type="button"
											class="trash-btn"
											title="Delete this lobby"
											on:click={() => deleteMyLobby(L)}
										>🗑</button>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<hr class="divider" />

				<GameCatalogGrid
					games={gameOptions}
					loading={loading}
					disabled={loading}
					creatingKey={creatingGameKey}
					onPick={pickGame}
				/>

				<JoinByCode bind:joinCode loading={loading} onJoin={join} />
			{:else}
				<PublicLobbyBrowser
					rows={publicRows}
					loading={publicLoading}
					bind:searchQ={publicSearchQ}
					bind:gameKeyFilter={publicGameFilter}
					gameKeys={gameOptions.map((g) => ({ key: g.key, label: g.label }))}
					selectedId={selectedPublicId}
					detail={publicDetail}
					loadingDetail={loadingPublicDetail}
					{busyJoinId}
					onSelectRow={onPublicSelectRow}
					onJoin={joinPublicLobby}
				/>
			{/if}
		</div>

		<FriendsRail
			bind:searchQ
			{searchResults}
			{friends}
			{pending}
			{outgoing}
			presenceMap={$presenceByUserId}
			{friendHostLobbies}
			myHostedLobby={myHostedWaitingLobby}
			currentUserId={currentUserId()}
			onSearch={doSearch}
			onAddFriend={addFriend}
			onAccept={accept}
			onDecline={decline}
			onCancelOutgoing={cancelOutgoing}
			onInviteFriend={onInviteFriendToHost}
			onJoinFriendLobby={onJoinFriendLobby}
			onMessageFriend={onMessageFriend}
		/>
	</div>
</div>

<style>
	.hub {
		max-width: 1120px;
		margin: 0 auto;
		padding: 1.25rem 1.5rem 2rem;
		font-family: Roboto, system-ui, sans-serif;
		color: var(--color-text);
	}
	.hub-header h1 {
		margin-top: 0;
		margin-bottom: 0.25rem;
		color: var(--color-text);
		font-size: 1.75rem;
	}
	.subnav {
		margin: 0 0 1rem;
		font-size: 0.95rem;
	}
	.subnav a {
		color: var(--color-accent, #3b82f6);
	}
	.hub-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
		gap: 1.75rem;
		align-items: start;
	}
	@media (max-width: 900px) {
		.hub-body {
			grid-template-columns: 1fr;
		}
	}
	.hub-main {
		min-width: 0;
	}
	.divider {
		border: none;
		border-top: 1px solid color-mix(in oklab, var(--color-text) 8%, transparent);
		margin: 1.25rem 0;
	}
	.section-title {
		margin: 0 0 0.65rem;
		font-size: 1.05rem;
		font-weight: 600;
	}
	.empty {
		margin: 0;
		font-size: 0.92rem;
		color: var(--color-text-muted);
	}
	.slim-lobby-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.slim-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin: 0.4rem 0;
		font-size: 0.92rem;
	}
	.slim-link {
		color: var(--color-link);
		font-weight: 500;
		text-decoration: none;
	}
	.slim-link:hover {
		text-decoration: underline;
	}
	.vis-badge {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.12rem 0.35rem;
		border-radius: 4px;
		background: color-mix(in oklab, var(--color-text) 10%, transparent);
		color: var(--color-text-muted);
	}
	.code-wrap {
		display: inline-flex;
		align-items: center;
	}
	.trash-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		padding: 0 0.25rem;
		opacity: 0.5;
		transition: opacity 0.15s;
	}
	.trash-btn:hover {
		opacity: 1;
	}
	.err {
		color: var(--color-danger);
	}
	.muted {
		color: var(--color-text-muted);
	}
	.skeleton-line {
		height: 1rem;
		max-width: 180px;
		border-radius: 4px;
		background: linear-gradient(
			110deg,
			var(--color-surface-muted) 0%,
			color-mix(in oklab, var(--color-text) 8%, var(--color-surface-muted)) 45%,
			var(--color-surface-muted) 90%
		);
		background-size: 200% 100%;
		animation: shimmer 1.2s ease-in-out infinite;
	}
	@media (prefers-reduced-motion: reduce) {
		.skeleton-line {
			animation: none;
		}
	}
	@keyframes shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
</style>
