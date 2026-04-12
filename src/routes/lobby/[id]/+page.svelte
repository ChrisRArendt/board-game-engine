<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { connectLobbyChannel, disconnectLobby, emitLobby } from '$lib/stores/network';
	import { startGame } from '$lib/lobby';
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
					displayName: data.profile.display_name
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
	<h1>{data.lobby.name}</h1>
	<p class="meta">
		Game: {data.lobby.game_key} · Code: <strong>{data.lobby.invite_code}</strong> ·
		{data.members.length} / {data.lobby.max_players} players
	</p>
	{#if errMsg}
		<p class="err">{errMsg}</p>
	{/if}

	<p class="hint">Players in this room appear in the list when connected via Realtime.</p>

	{#if isHost}
		<button type="button" class="btn primary" disabled={starting} on:click={hostStart}>
			Start game
		</button>
	{:else}
		<p class="muted">Waiting for host to start…</p>
	{/if}

	<p class="back"><a href="/lobby">← Back to lobby list</a></p>
</div>

<style>
	.room {
		max-width: 560px;
		margin: 0 auto;
		padding: 1.5rem;
		font-family: Roboto, system-ui, sans-serif;
	}
	h1 {
		margin-top: 0;
	}
	.meta {
		color: #475569;
	}
	.hint {
		font-size: 0.9rem;
		color: #64748b;
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
	.back {
		margin-top: 2rem;
	}
	.back a {
		color: #2563eb;
	}
</style>
