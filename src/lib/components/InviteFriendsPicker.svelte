<script lang="ts">
	import { tick } from 'svelte';
	import type { FriendWithProfile } from '$lib/friends';
	import type { LobbyInviteRow } from '$lib/invites';
	import { sendLobbyInvite } from '$lib/invites';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { onlineUserIds } from '$lib/stores/onlinePresence';
	import UserIdentity from '$lib/components/UserIdentity.svelte';

	export let open = false;
	export let lobbyId: string;
	export let hostId: string;
	export let gameKey: string;
	export let friends: FriendWithProfile[] = [];
	export let memberUserIds: Set<string> = new Set();
	export let pendingInvites: LobbyInviteRow[] = [];

	const supabase = createSupabaseBrowserClient();

	let q = '';
	let sending: string | null = null;
	let err = '';

	$: pendingByUser = new Map(pendingInvites.map((p) => [p.invitee_id, p]));

	function filtered(online: Set<string>): FriendWithProfile[] {
		const n = q.trim().toLowerCase();
		let list = friends;
		if (n) {
			list = friends.filter(
				(f) =>
					f.profile.display_name.toLowerCase().includes(n) ||
					f.profile.username.toLowerCase().includes(n)
			);
		}
		const sortFn = (a: FriendWithProfile, b: FriendWithProfile) => {
			const ao = online.has(a.profile.id) ? 0 : 1;
			const bo = online.has(b.profile.id) ? 0 : 1;
			return ao - bo || a.profile.display_name.localeCompare(b.profile.display_name);
		};
		return [...list].sort(sortFn);
	}

	async function invite(uid: string) {
		if (uid === hostId) return;
		sending = uid;
		err = '';
		try {
			await sendLobbyInvite(supabase, { lobbyId, inviteeId: uid, inviterId: hostId });
			open = false;
		} catch (e) {
			err = e instanceof Error ? e.message : 'Could not invite';
		}
		sending = null;
	}

	let panelEl: HTMLDivElement | null = null;

	function onGlobalKey(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			open = false;
		}
	}

	$: if (open) {
		void tick().then(() => panelEl?.querySelector<HTMLInputElement>('input')?.focus());
	}
</script>

<svelte:window on:keydown={onGlobalKey} />

{#if open}
	<div class="backdrop" role="presentation" on:click={() => (open = false)}></div>
	<div class="panel" bind:this={panelEl} role="dialog" aria-label="Invite friends">
		<header class="ph">
			<h3 class="pt">Invite friends</h3>
			<button type="button" class="x" on:click={() => (open = false)} aria-label="Close">×</button>
		</header>
		<input
			type="search"
			class="search"
			placeholder="Search friends"
			bind:value={q}
			autocomplete="off"
		/>
		{#if err}
			<p class="err">{err}</p>
		{/if}
		<ul class="list">
			{#each filtered($onlineUserIds) as f (f.profile.id)}
				<li class="row">
					<span class="dot" class:online={$onlineUserIds.has(f.profile.id)}></span>
					<UserIdentity
						variant="compact"
						displayName={f.profile.display_name}
						avatarUrl={f.profile.avatar_url}
						subtitle={$onlineUserIds.has(f.profile.id) ? 'Online' : 'Offline'}
					/>
					{#if memberUserIds.has(f.profile.id)}
						<span class="chip">In lobby</span>
					{:else if pendingByUser.has(f.profile.id)}
						<span class="chip pending">Invited</span>
					{:else}
						<button
							type="button"
							class="go"
							disabled={sending === f.profile.id}
							on:click={() => invite(f.profile.id)}
						>
							{sending === f.profile.id ? '…' : 'Invite'}
						</button>
					{/if}
				</li>
			{:else}
				<li class="muted">No friends match.</li>
			{/each}
		</ul>
		<p class="hint">Game: {gameKey}</p>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		z-index: 85;
	}
	.panel {
		position: fixed;
		z-index: 86;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(360px, calc(100vw - 32px));
		max-height: min(420px, 70vh);
		display: flex;
		flex-direction: column;
		border-radius: var(--social-radius);
		background: var(--social-surface-strong);
		border: 1px solid var(--social-border-strong);
		box-shadow: var(--social-shadow-2);
		backdrop-filter: blur(var(--social-blur)) saturate(140%);
		padding: 0.65rem 0.75rem 0.75rem;
	}
	.ph {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	.pt {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}
	.x {
		border: none;
		background: transparent;
		font-size: 1.35rem;
		line-height: 1;
		cursor: pointer;
		color: var(--color-text-muted);
	}
	.search {
		width: 100%;
		padding: 0.45rem 0.5rem;
		border-radius: var(--social-radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-input-bg);
		color: var(--color-text);
		margin-bottom: 0.5rem;
		font: inherit;
	}
	.search:focus-visible {
		outline: none;
		box-shadow: var(--social-ring);
	}
	.err {
		color: var(--color-danger);
		font-size: 0.82rem;
		margin: 0 0 0.35rem;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow: auto;
		flex: 1;
		min-height: 0;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0.4rem 0;
	}
	.row :global(.identity) {
		flex: 1;
		min-width: 0;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-text-muted);
		flex-shrink: 0;
	}
	.dot.online {
		background: #22c55e;
	}
	.chip {
		font-size: 0.72rem;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		background: var(--color-surface-muted);
		color: var(--color-text-muted);
	}
	.chip.pending {
		border: 1px solid var(--social-border-strong);
	}
	.go {
		border-radius: var(--social-radius-sm);
		border: 1px solid var(--social-border-strong);
		background: color-mix(in oklab, var(--color-accent) 22%, transparent);
		color: var(--color-text);
		font: inherit;
		font-size: 0.78rem;
		padding: 0.2rem 0.55rem;
		cursor: pointer;
	}
	.go:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.go:focus-visible {
		box-shadow: var(--social-ring);
	}
	.muted {
		color: var(--color-text-muted);
		font-size: 0.85rem;
		padding: 0.5rem 0;
	}
	.hint {
		margin: 0.5rem 0 0;
		font-size: 0.72rem;
		color: var(--color-text-muted);
	}
</style>
