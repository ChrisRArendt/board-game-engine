<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { connectLobbyChannel, disconnectLobby, emitLobby } from '$lib/stores/network';
	import { users } from '$lib/stores/users';
	import { startGame } from '$lib/lobby';
	import CopyInviteCode from '$lib/components/CopyInviteCode.svelte';
	import LobbyRoomChat from '$lib/components/LobbyRoomChat.svelte';
	import UserIdentity from '$lib/components/UserIdentity.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	const supabase = createSupabaseBrowserClient();
	const isHost = data.lobby.host_id === data.session.user.id;

	let errMsg = '';
	let starting = false;

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

		window.addEventListener('bge:game_start', onGameStart);
		return () => {
			window.removeEventListener('bge:game_start', onGameStart);
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
			<h2>In this room</h2>
			<p class="hint">Other players in this lobby show up here.</p>
			<ul class="presence">
				<li>
					<UserIdentity
						variant="row"
						displayName={data.profile?.display_name ?? 'You'}
						avatarUrl={data.profile?.avatar_url}
						subtitle="You"
					/>
				</li>
				{#each $users as u (u.id)}
					<li>
						<UserIdentity
							variant="row"
							displayName={u.name}
							avatarUrl={u.avatarUrl}
							subtitle="Connected"
						/>
					</li>
				{/each}
			</ul>
		</section>

		{#if isHost}
			<button type="button" class="btn primary full" disabled={starting} on:click={hostStart}>
				Start game
			</button>
		{:else}
			<p class="muted">Waiting for host to start…</p>
		{/if}

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
		grid-template-columns: minmax(0, 1fr) minmax(260px, 300px);
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
	.presence li {
		margin: 0.35rem 0;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
