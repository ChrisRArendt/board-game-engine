<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { connectLobbyChannel, disconnectLobby, emitLobby } from '$lib/stores/network';
	import { users } from '$lib/stores/users';
	import { startGame, deleteLobby, leaveLobby } from '$lib/lobby';
	import CopyInviteCode from '$lib/components/CopyInviteCode.svelte';
	import LobbyRoomChat from '$lib/components/LobbyRoomChat.svelte';
	import UserIdentity from '$lib/components/UserIdentity.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	type MemberRow = {
		user_id: string;
		sort_order: number;
		display_name: string;
		avatar_url: string | null;
	};

	const supabase = createSupabaseBrowserClient();
	const isHost = data.lobby.host_id === data.session.user.id;

	let errMsg = '';
	let starting = false;
	let reordering = false;
	let deleting = false;
	let leaving = false;

	let membersOrdered: MemberRow[] = [...data.members];

	const profileById = new Map(data.members.map((m) => [m.user_id, m]));

	function subtitleFor(uid: string) {
		if (uid === data.session.user.id) return 'You';
		if ($users.some((u) => u.id === uid)) return 'Connected';
		return 'In lobby';
	}

	function applyOrderFromIds(userIds: string[]) {
		membersOrdered = userIds
			.map((id) => profileById.get(id))
			.filter((m): m is MemberRow => m != null);
	}

	function onLobbyOrderEv(ev: Event) {
		const d = (ev as CustomEvent<{ userIds: string[] }>).detail;
		if (Array.isArray(d?.userIds)) applyOrderFromIds(d.userIds);
	}

	function swap(i: number, j: number) {
		const next = [...membersOrdered];
		[next[i], next[j]] = [next[j], next[i]];
		membersOrdered = next;
	}

	async function persistOrder(previous: MemberRow[]) {
		if (membersOrdered.length === 0) return;
		reordering = true;
		errMsg = '';
		const userIds = membersOrdered.map((m) => m.user_id);
		const { error } = await supabase.rpc('set_lobby_member_order', {
			p_lobby_id: data.lobby.id,
			p_user_ids: userIds
		});
		reordering = false;
		if (error) {
			errMsg = error.message;
			membersOrdered = previous;
			return;
		}
		emitLobby('lobby_order', { userIds });
	}

	async function moveUp(i: number) {
		if (i <= 0) return;
		const previous = membersOrdered;
		swap(i, i - 1);
		await persistOrder(previous);
	}

	async function moveDown(i: number) {
		if (i >= membersOrdered.length - 1) return;
		const previous = membersOrdered;
		swap(i, i + 1);
		await persistOrder(previous);
	}

	function onGameStart() {
		disconnectLobby();
		void goto(`/play/${data.lobby.id}`);
	}

	async function hostStart() {
		if (!isHost) return;
		starting = true;
		errMsg = '';
		try {
			await startGame(supabase, data.lobby.id, data.session.user.id);
			emitLobby('game_start', {});
			disconnectLobby();
			await goto(`/play/${data.lobby.id}`);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not start';
		}
		starting = false;
	}

	async function hostDeleteLobby() {
		if (!isHost) return;
		if (!confirm('Delete this lobby for everyone? This cannot be undone.')) return;
		deleting = true;
		errMsg = '';
		try {
			emitLobby('lobby_deleted', {});
			await deleteLobby(supabase, data.lobby.id, data.session.user.id);
			disconnectLobby();
			await goto('/lobby');
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not delete lobby';
		}
		deleting = false;
	}

	async function leaveRoom() {
		leaving = true;
		errMsg = '';
		try {
			if (isHost) {
				emitLobby('lobby_finished', {});
			}
			await leaveLobby(supabase, data.lobby.id, data.session.user.id);
			disconnectLobby();
			await goto('/lobby');
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not leave';
		}
		leaving = false;
	}

	onMount(() => {
		void (async () => {
			if (!data.profile) return;
			try {
				await connectLobbyChannel(data.lobby.id, {
					userId: data.session.user.id,
					displayName: data.profile.display_name,
					avatarUrl: data.profile.avatar_url
				});
			} catch (e) {
				errMsg = e instanceof Error ? e.message : 'Could not connect to lobby';
			}
		})();

		function onLobbyDeleted() {
			disconnectLobby();
			void goto('/lobby');
		}
		function onLobbyFinished() {
			disconnectLobby();
			void goto('/lobby');
		}

		window.addEventListener('bge:game_start', onGameStart);
		window.addEventListener('bge:lobby_order', onLobbyOrderEv);
		window.addEventListener('bge:lobby_deleted', onLobbyDeleted);
		window.addEventListener('bge:lobby_finished', onLobbyFinished);
		return () => {
			window.removeEventListener('bge:game_start', onGameStart);
			window.removeEventListener('bge:lobby_order', onLobbyOrderEv);
			window.removeEventListener('bge:lobby_deleted', onLobbyDeleted);
			window.removeEventListener('bge:lobby_finished', onLobbyFinished);
			disconnectLobby();
		};
	});
</script>

<div class="room">
	<main class="chat-col">
		<section class="card chat-card">
			<LobbyRoomChat
				userId={data.session.user.id}
				displayName={data.profile?.display_name ?? 'Player'}
				avatarUrl={data.profile?.avatar_url}
			/>
		</section>
	</main>

	<aside class="side">
		<h1 class="side-title">{data.lobby.name}</h1>
		<p class="meta">
			Game: {data.lobby.game_key} · Code:
			<CopyInviteCode code={data.lobby.invite_code} />·
			{data.members.length} / {data.lobby.max_players} players
		</p>
		{#if errMsg}
			<p class="err">{errMsg}</p>
		{/if}

		<section class="card in-room">
			<h2>Players</h2>
			<p class="hint">Order is saved for the in-game player list. Anyone in the room can reorder.</p>
			<ul class="presence">
				{#each membersOrdered as m, i (m.user_id)}
					<li class="member-row">
						<UserIdentity
							variant="row"
							displayName={m.display_name}
							avatarUrl={m.avatar_url}
							subtitle={subtitleFor(m.user_id)}
						/>
						<span class="reorder">
							<button
								type="button"
								class="rebtn"
								disabled={reordering || i === 0}
								onclick={() => moveUp(i)}
								aria-label="Move up"
							>
								↑
							</button>
							<button
								type="button"
								class="rebtn"
								disabled={reordering || i >= membersOrdered.length - 1}
								onclick={() => moveDown(i)}
								aria-label="Move down"
							>
								↓
							</button>
						</span>
					</li>
				{/each}
			</ul>
		</section>

		{#if isHost}
			<button type="button" class="btn primary full" disabled={starting} onclick={hostStart}>
				Start game
			</button>
			<button
				type="button"
				class="btn danger full"
				disabled={deleting || leaving}
				onclick={hostDeleteLobby}
			>
				Delete lobby
			</button>
		{:else}
			<p class="muted">Waiting for host to start…</p>
		{/if}

		<button type="button" class="btn full" disabled={leaving || deleting} onclick={leaveRoom}>
			Leave lobby
		</button>

		<p class="back"><a href="/lobby">← Back to lobby list</a></p>
	</aside>
</div>

<style>
	.room {
		max-width: 1280px;
		margin: 0 auto;
		padding: 1.5rem;
		font-family: Roboto, system-ui, sans-serif;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
		gap: 1.25rem;
		align-items: start;
	}
	@media (max-width: 900px) {
		.room {
			grid-template-columns: 1fr;
		}
	}
	.chat-col {
		min-width: 0;
	}
	.chat-card {
		padding: 0.85rem 1rem;
	}
	.chat-col :global(.chat .log) {
		height: min(420px, 52vh);
	}
	.side-title {
		margin: 0 0 0.35rem;
		font-size: 1.15rem;
		line-height: 1.25;
	}
	.meta {
		color: #475569;
		line-height: 1.6;
	}
	.hint {
		font-size: 0.85rem;
		color: #64748b;
		margin: 0 0 0.5rem;
	}
	.err {
		color: #b91c1c;
	}
	.muted {
		color: #64748b;
	}
	.btn {
		padding: 0.55rem 1rem;
		border-radius: 6px;
		border: 1px solid #cbd5e1;
		background: #f1f5f9;
		cursor: pointer;
		font-size: 1rem;
	}
	.btn.primary {
		background: #2563eb;
		color: #fff;
		border-color: #1d4ed8;
	}
	.btn:disabled {
		opacity: 0.6;
	}
	.btn.full {
		width: 100%;
		box-sizing: border-box;
	}
	.btn.danger {
		background: #fef2f2;
		color: #b91c1c;
		border-color: #fecaca;
	}
	.btn.danger:hover:not(:disabled) {
		background: #fee2e2;
	}
	.back {
		margin-top: 1.25rem;
	}
	.back a {
		color: #2563eb;
	}
	.card {
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1rem 1.1rem;
		background: #fff;
	}
	.card h2 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
	}
	.in-room {
		margin: 1rem 0;
	}
	.presence {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.member-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin: 0.35rem 0;
	}
	.member-row :global(.identity.row) {
		flex: 1;
		min-width: 0;
	}
	.reorder {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex-shrink: 0;
	}
	.rebtn {
		width: 28px;
		height: 22px;
		padding: 0;
		font-size: 12px;
		line-height: 1;
		border: 1px solid #cbd5e1;
		border-radius: 4px;
		background: #f8fafc;
		cursor: pointer;
	}
	.rebtn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
