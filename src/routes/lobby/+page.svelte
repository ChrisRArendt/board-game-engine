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
		listOpenLobbies,
		type LobbyRow
	} from '$lib/lobby';
	import type { Database } from '$lib/supabase/database.types';
	import { goto } from '$app/navigation';
	import { onlineUserIds } from '$lib/stores/onlinePresence';
	import type { RealtimeChannel } from '@supabase/supabase-js';
	import UserIdentity from '$lib/components/UserIdentity.svelte';
	import CopyInviteCode from '$lib/components/CopyInviteCode.svelte';
	import type { PageData } from './$types';

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
	let lobbies: Database['public']['Tables']['lobbies']['Row'][] = [];
	let searchQ = '';
	let searchResults: Database['public']['Tables']['profiles']['Row'][] = [];
	let loading = false;
	let errMsg = '';

	let newLobbyName = 'Game night';
	let newLobbyGame = 'bsg_1';
	let newLobbyMax = 6;
	let joinCode = '';

	let friendshipsCh: RealtimeChannel | null = null;
	let friendPingCh: RealtimeChannel | null = null;

	const FRIEND_LIST_BROADCAST = 'friend_lists_refresh';

	/** Notify the other participant after a DELETE — postgres_changes filters skip DELETEs; broadcast is reliable. */
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

	/** Friends / pending only — no full-page loading (used by Realtime). */
	async function refreshFriendLists() {
		try {
			const id = currentUserId();
			friends = await getFriends(supabase, id);
			pending = await getPendingIncoming(supabase, id);
			outgoing = await getPendingOutgoing(supabase, id);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Error';
		}
	}

	async function refresh() {
		loading = true;
		errMsg = '';
		try {
			const { data: p } = await supabase.from('profiles').select('*').eq('id', currentUserId()).single();
			profile = p;
			await refreshFriendLists();
			lobbies = await listOpenLobbies(supabase);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Error';
		}
		loading = false;
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

	async function create() {
		if (!profile) return;
		loading = true;
		try {
			const lobby: LobbyRow = await createLobby(supabase, {
				hostId: currentUserId(),
				name: newLobbyName,
				gameKey: newLobbyGame,
				maxPlayers: newLobbyMax
			});
			await goto(`/lobby/${lobby.id}`);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not create lobby';
		}
		loading = false;
	}

	async function join() {
		loading = true;
		try {
			const lobby: LobbyRow = await joinLobbyByCode(supabase, joinCode, currentUserId());
			await goto(`/lobby/${lobby.id}`);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not join';
		}
		loading = false;
	}

	onMount(async () => {
		await refresh();

		const myId = currentUserId();
		// Supabase: column filters do NOT apply to DELETE events — filtered listeners never
		// see declines/cancels. One unfiltered subscription; RLS still scopes which rows you get.
		friendshipsCh = supabase
			.channel(`friendships:${myId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'friendships'
				},
				(payload) => {
					// #region agent log
					const p = payload as { eventType?: string; old?: Record<string, unknown> };
					fetch('http://localhost:7278/ingest/b8376de9-9c29-4e05-bd62-1d6be57bcdc1', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-Debug-Session-Id': '1762ed'
						},
						body: JSON.stringify({
							sessionId: '1762ed',
							location: 'lobby/+page.svelte:friendships',
							message: 'friendships postgres_changes',
							data: {
								eventType: p.eventType,
								oldKeys: p.old ? Object.keys(p.old) : []
							},
							timestamp: Date.now(),
							hypothesisId: 'H1',
							runId: 'post-fix'
						})
					}).catch(() => {});
					// #endregion
					void refreshFriendLists();
				}
			);
		void friendshipsCh.subscribe();

		friendPingCh = supabase.channel(`friendship_ping:${myId}`, {
			config: { broadcast: { self: false } }
		});
		friendPingCh.on('broadcast', { event: FRIEND_LIST_BROADCAST }, () => {
			// #region agent log
			fetch('http://localhost:7278/ingest/b8376de9-9c29-4e05-bd62-1d6be57bcdc1', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Debug-Session-Id': '1762ed'
				},
				body: JSON.stringify({
					sessionId: '1762ed',
					location: 'lobby/+page.svelte:friendPing',
					message: 'friendship broadcast refresh',
					data: {},
					timestamp: Date.now(),
					hypothesisId: 'H2',
					runId: 'post-fix'
				})
			}).catch(() => {});
			// #endregion
			void refreshFriendLists();
		});
		void friendPingCh.subscribe();
	});

	onDestroy(() => {
		if (friendshipsCh) {
			void supabase.removeChannel(friendshipsCh);
			friendshipsCh = null;
		}
		if (friendPingCh) {
			void supabase.removeChannel(friendPingCh);
			friendPingCh = null;
		}
	});
</script>

<div class="hub">
	<h1>Lobby</h1>
	{#if errMsg}
		<p class="err">{errMsg}</p>
	{/if}

	<div class="grid">
		<section class="card">
			<h2>Friends</h2>
			<div class="search">
				<input
					type="search"
					placeholder="Search by username or name"
					bind:value={searchQ}
					on:keydown={(e) => e.key === 'Enter' && doSearch()}
				/>
				<button type="button" class="btn" on:click={doSearch}>Search</button>
			</div>
			{#if searchResults.length}
				<ul class="results">
					{#each searchResults as u}
						<li class="friend-row">
							<UserIdentity
								variant="row"
								displayName={u.display_name}
								avatarUrl={u.avatar_url}
								subtitle={`@${u.username}`}
							/>
							<button type="button" class="btn small" on:click={() => addFriend(u.id)}>Add</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if outgoing.length}
				<h3>Outgoing requests</h3>
				<p class="hint">Waiting for them to accept before they appear under “Friends”.</p>
				<ul>
					{#each outgoing as o}
						<li class="friend-row">
							<UserIdentity
								variant="row"
								displayName={o.addressee.display_name}
								avatarUrl={o.addressee.avatar_url}
								subtitle="Pending"
							/>
							<button type="button" class="btn small" on:click={() => cancelOutgoing(o.id)}>Cancel</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if pending.length}
				<h3>Incoming requests</h3>
				<ul>
					{#each pending as r}
						<li class="friend-row">
							<UserIdentity
								variant="row"
								displayName={r.requester.display_name}
								avatarUrl={r.requester.avatar_url}
								subtitle="Wants to be friends"
							/>
							<div class="row-actions">
								<button type="button" class="btn small" on:click={() => accept(r.id)}>Accept</button>
								<button type="button" class="btn small" on:click={() => decline(r.id)}>Decline</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}

			<h3>Friends</h3>
			<p class="hint">Only people who accepted a request (or you accepted theirs).</p>
			<ul class="friends">
				{#each friends as f}
					<li class="friend-row">
						<span class="dot" class:online={$onlineUserIds.has(f.profile.id)} title="Online"></span>
						<UserIdentity
							variant="compact"
							displayName={f.profile.display_name}
							avatarUrl={f.profile.avatar_url}
							subtitle={`@${f.profile.username}`}
						/>
					</li>
				{:else}
					<li class="muted">No accepted friends yet — add someone above, then they must accept.</li>
				{/each}
			</ul>
		</section>

		<section class="card">
			<h2>Open lobbies</h2>
			<div class="create">
				<input bind:value={newLobbyName} placeholder="Lobby name" />
				<select bind:value={newLobbyGame}>
					<option value="bsg_1">Battlestar Galactica (bsg_1)</option>
				</select>
				<label>
					Max players
					<input type="number" min="2" max="12" bind:value={newLobbyMax} />
				</label>
				<button type="button" class="btn primary" disabled={loading} on:click={create}>Create lobby</button>
			</div>

			<div class="join">
				<input bind:value={joinCode} placeholder="Invite code" />
				<button type="button" class="btn" disabled={loading} on:click={join}>Join by code</button>
			</div>

			<ul class="lobbies">
				{#each lobbies as L}
					<li>
						<a href="/lobby/{L.id}">{L.name}</a>
						<span class="code-wrap"><CopyInviteCode code={L.invite_code} /></span>
					</li>
				{:else}
					<li class="muted">No open lobbies — create one.</li>
				{/each}
			</ul>
		</section>
	</div>
</div>

<style>
	.hub {
		max-width: 960px;
		margin: 0 auto;
		padding: 1.5rem;
		font-family: Roboto, system-ui, sans-serif;
	}
	h1 {
		margin-top: 0;
	}
	h2 {
		margin-top: 0;
		font-size: 1.15rem;
	}
	h3 {
		font-size: 1rem;
		margin: 1rem 0 0.5rem;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}
	@media (max-width: 800px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
	.card {
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1rem 1.25rem;
		background: #fff;
	}
	.search {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.search input {
		flex: 1;
		padding: 0.4rem 0.5rem;
	}
	.create,
	.join {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.create input,
	.join input,
	.create select {
		padding: 0.4rem 0.5rem;
	}
	.btn {
		padding: 0.45rem 0.75rem;
		border-radius: 6px;
		border: 1px solid #cbd5e1;
		background: #f1f5f9;
		cursor: pointer;
	}
	.btn.primary {
		background: #2563eb;
		color: #fff;
		border-color: #1d4ed8;
	}
	.btn.small {
		padding: 0.2rem 0.5rem;
		font-size: 0.85rem;
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.err {
		color: #b91c1c;
	}
	.hint {
		font-size: 0.82rem;
		color: #64748b;
		margin: 0 0 0.5rem;
		line-height: 1.35;
	}
	.muted {
		color: #64748b;
		font-size: 0.9rem;
	}
	.friend-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 0.45rem 0;
		flex-wrap: wrap;
	}
	.friend-row :global(.identity) {
		flex: 1;
		min-width: 0;
	}
	.row-actions {
		display: flex;
		gap: 0.35rem;
		flex-shrink: 0;
	}
	.lobbies li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.35rem 0;
		flex-wrap: wrap;
	}
	.code-wrap {
		display: inline-flex;
		align-items: center;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #94a3b8;
		display: inline-block;
	}
	.dot.online {
		background: #22c55e;
	}
	.lobbies a {
		color: #2563eb;
		font-weight: 500;
	}
</style>
