<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import {
		searchUsers,
		sendFriendRequest,
		acceptRequest,
		declineRequest,
		getFriends,
		getPendingIncoming,
		type FriendWithProfile,
		type PendingRequest
	} from '$lib/friends';
	import {
		createLobby,
		joinLobbyByCode,
		listOpenLobbies,
		type LobbyRow
	} from '$lib/lobby';
	import type { Database } from '$lib/supabase/database.types';
	import { goto } from '$app/navigation';
	import type { RealtimeChannel } from '@supabase/supabase-js';

	export let data: { session: { user: { id: string; email?: string } } };

	const supabase = createSupabaseBrowserClient();

	let profile: Database['public']['Tables']['profiles']['Row'] | null = null;
	let friends: FriendWithProfile[] = [];
	let pending: PendingRequest[] = [];
	let lobbies: Database['public']['Tables']['lobbies']['Row'][] = [];
	let searchQ = '';
	let searchResults: Database['public']['Tables']['profiles']['Row'][] = [];
	let loading = false;
	let errMsg = '';

	let newLobbyName = 'Game night';
	let newLobbyGame = 'bsg_1';
	let newLobbyMax = 6;
	let joinCode = '';

	let onlineIds = new Set<string>();
	let presenceCh: RealtimeChannel | null = null;

	async function refresh() {
		loading = true;
		errMsg = '';
		try {
			const { data: p } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).single();
			profile = p;
			friends = await getFriends(supabase, data.session.user.id);
			pending = await getPendingIncoming(supabase, data.session.user.id);
			lobbies = await listOpenLobbies(supabase);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Error';
		}
		loading = false;
	}

	async function doSearch() {
		searchResults = await searchUsers(supabase, searchQ, data.session.user.id);
	}

	async function addFriend(uid: string) {
		await sendFriendRequest(supabase, uid, data.session.user.id);
		searchResults = [];
		searchQ = '';
		await refresh();
	}

	async function accept(id: string) {
		await acceptRequest(supabase, id);
		await refresh();
	}

	async function decline(id: string) {
		await declineRequest(supabase, id);
		await refresh();
	}

	async function create() {
		if (!profile) return;
		loading = true;
		try {
			const lobby: LobbyRow = await createLobby(supabase, {
				hostId: data.session.user.id,
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
			const lobby: LobbyRow = await joinLobbyByCode(supabase, joinCode, data.session.user.id);
			await goto(`/lobby/${lobby.id}`);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not join';
		}
		loading = false;
	}

	function friendOnline(fid: string) {
		return onlineIds.has(fid);
	}

	onMount(async () => {
		await refresh();

		presenceCh = supabase.channel('online:global', {
			config: { presence: { key: data.session.user.id } }
		});
		presenceCh.on('presence', { event: 'sync' }, () => {
			if (!presenceCh) return;
			const state = presenceCh.presenceState();
			const next = new Set<string>();
			for (const k of Object.keys(state)) {
				const arr = state[k] as { user_id?: string }[];
				const uid = arr?.[0]?.user_id;
				if (uid) next.add(uid);
			}
			onlineIds = next;
		});
		presenceCh.subscribe(async (status) => {
			if (status === 'SUBSCRIBED' && presenceCh && profile) {
				await presenceCh.track({
					user_id: data.session.user.id,
					name: profile.display_name
				});
			}
		});
	});

	onDestroy(() => {
		if (presenceCh) {
			void supabase.removeChannel(presenceCh);
			presenceCh = null;
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
						<li>
							<span>{u.display_name} (@{u.username})</span>
							<button type="button" class="btn small" on:click={() => addFriend(u.id)}>Add</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if pending.length}
				<h3>Requests</h3>
				<ul>
					{#each pending as r}
						<li>
							{r.requester.display_name}
							<button type="button" class="btn small" on:click={() => accept(r.id)}>Accept</button>
							<button type="button" class="btn small" on:click={() => decline(r.id)}>Decline</button>
						</li>
					{/each}
				</ul>
			{/if}

			<h3>Your friends</h3>
			<ul class="friends">
				{#each friends as f}
					<li>
						<span class="dot" class:online={friendOnline(f.profile.id)} title="Online"></span>
						{f.profile.display_name}
					</li>
				{:else}
					<li class="muted">No friends yet — search above.</li>
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
						<span class="muted">{L.invite_code}</span>
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
	.muted {
		color: #64748b;
		font-size: 0.9rem;
	}
	.results li,
	.friends li,
	.lobbies li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.35rem 0;
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
