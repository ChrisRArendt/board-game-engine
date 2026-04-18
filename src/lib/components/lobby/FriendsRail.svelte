<script lang="ts">
	import type { Database } from '$lib/supabase/database.types';
	import type { FriendWithProfile, PendingRequest, PendingOutgoing } from '$lib/friends';
	import { onlineUserIds } from '$lib/stores/onlinePresence';
	import UserIdentity from '$lib/components/UserIdentity.svelte';

	export let searchQ = '';
	export let searchResults: Database['public']['Tables']['profiles']['Row'][] = [];
	export let friends: FriendWithProfile[] = [];
	export let pending: PendingRequest[] = [];
	export let outgoing: PendingOutgoing[] = [];
	export let onSearch: () => void = () => {};
	export let onAddFriend: (uid: string) => void = () => {};
	export let onAccept: (id: string) => void = () => {};
	export let onDecline: (id: string) => void = () => {};
	export let onCancelOutgoing: (friendshipId: string) => void = () => {};
</script>

<aside class="friends-rail" aria-label="Friends">
	<div class="rail-block">
		<div class="search">
			<input
				type="search"
				placeholder="Find people"
				bind:value={searchQ}
				on:keydown={(e) => e.key === 'Enter' && onSearch()}
			/>
			<button type="button" class="btn tiny" on:click={onSearch}>Search</button>
		</div>
		{#if searchResults.length}
			<ul class="mini-list">
				{#each searchResults as u}
					<li class="friend-row">
						<UserIdentity
							variant="row"
							displayName={u.display_name}
							avatarUrl={u.avatar_url}
							subtitle={`@${u.username}`}
						/>
						<button type="button" class="btn tiny" on:click={() => onAddFriend(u.id)}>Add</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if outgoing.length || pending.length}
		<hr class="sep" />
		{#if outgoing.length}
			<details class="disclosure" open>
				<summary>Outgoing ({outgoing.length})</summary>
				<ul class="mini-list">
					{#each outgoing as o}
						<li class="friend-row">
							<UserIdentity
								variant="compact"
								displayName={o.addressee.display_name}
								avatarUrl={o.addressee.avatar_url}
								subtitle="Pending"
							/>
							<button type="button" class="btn tiny" on:click={() => onCancelOutgoing(o.id)}>Cancel</button>
						</li>
					{/each}
				</ul>
			</details>
		{/if}
		{#if pending.length}
			<details class="disclosure" open>
				<summary>Incoming ({pending.length})</summary>
				<ul class="mini-list">
					{#each pending as r}
						<li class="friend-row">
							<UserIdentity
								variant="compact"
								displayName={r.requester.display_name}
								avatarUrl={r.requester.avatar_url}
								subtitle="Request"
							/>
							<div class="row-actions">
								<button type="button" class="btn tiny" on:click={() => onAccept(r.id)}>OK</button>
								<button type="button" class="btn tiny" on:click={() => onDecline(r.id)}>No</button>
							</div>
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	{/if}

	<hr class="sep" />

	<div class="rail-block">
		<h3 class="rail-h">Friends</h3>
		<ul class="mini-list friends">
			{#each friends as f}
				<li class="friend-row">
					<span
						class="dot"
						class:online={$onlineUserIds.has(f.profile.id)}
						title={$onlineUserIds.has(f.profile.id) ? 'Online' : 'Offline'}
					/>
					<UserIdentity
						variant="compact"
						displayName={f.profile.display_name}
						avatarUrl={f.profile.avatar_url}
						subtitle={`@${f.profile.username}`}
					/>
				</li>
			{:else}
				<li class="muted small">No friends yet.</li>
			{/each}
		</ul>
	</div>
</aside>

<style>
	.friends-rail {
		position: sticky;
		top: 1rem;
		align-self: start;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	@media (max-width: 900px) {
		.friends-rail {
			position: static;
		}
	}
	.rail-block {
		min-width: 0;
	}
	.rail-h {
		margin: 0 0 0.4rem;
		font-size: 0.82rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}
	.search {
		display: flex;
		gap: 0.35rem;
	}
	.search input {
		flex: 1;
		min-width: 0;
		padding: 0.35rem 0.45rem;
		font-size: 0.88rem;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
	}
	.search input:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}
	.sep {
		border: none;
		border-top: 1px solid color-mix(in oklab, var(--color-text) 10%, transparent);
		margin: 0;
	}
	.mini-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.friend-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin: 0.35rem 0;
		flex-wrap: wrap;
	}
	.friend-row :global(.identity) {
		flex: 1;
		min-width: 0;
	}
	.row-actions {
		display: flex;
		gap: 0.25rem;
	}
	.btn {
		border-radius: 6px;
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface-muted);
		color: var(--color-text);
		cursor: pointer;
		font: inherit;
	}
	.btn.tiny {
		padding: 0.15rem 0.45rem;
		font-size: 0.78rem;
	}
	.btn:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
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
		box-shadow: 0 0 0 2px color-mix(in oklab, #22c55e 35%, transparent);
	}
	.muted {
		color: var(--color-text-muted);
	}
	.small {
		font-size: 0.85rem;
	}
	.disclosure summary {
		cursor: pointer;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin-bottom: 0.35rem;
	}
	.disclosure summary:focus-visible {
		outline: 2px solid var(--color-accent);
		border-radius: 4px;
	}
</style>
