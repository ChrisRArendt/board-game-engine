<script lang="ts">
	import type { LobbyRow, PublicLobbyDetail } from '$lib/lobby';
	import UserIdentity from '$lib/components/UserIdentity.svelte';
	import CopyInviteCode from '$lib/components/CopyInviteCode.svelte';

	export let rows: LobbyRow[] = [];
	export let loading = false;
	export let searchQ = '';
	export let gameKeyFilter = '';
	export let gameKeys: { key: string; label: string }[] = [];
	export let selectedId: string | null = null;
	export let detail: PublicLobbyDetail | null = null;
	export let loadingDetail = false;
	export let busyJoinId: string | null = null;

	export let onSelectRow: (id: string) => void = () => {};
	export let onJoin: (id: string) => void = () => {};

	function pick(id: string) {
		selectedId = id;
		onSelectRow(id);
	}
</script>

<div class="public-browser">
	<div class="filters">
		<input
			type="search"
			class="search"
			placeholder="Search by name or description"
			bind:value={searchQ}
			aria-label="Search public lobbies"
		/>
		<label class="game-filter">
			<span class="sr-only">Game</span>
			<select bind:value={gameKeyFilter}>
				<option value="">All games</option>
				{#each gameKeys as g}
					<option value={g.key}>{g.label}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="split">
		<div class="list-pane" role="listbox" aria-label="Public lobbies" tabindex="0">
			{#if loading}
				<ul class="lobby-rows skeleton-list" aria-busy="true">
					{#each [1, 2, 3, 4] as _}
						<li class="row sk"></li>
					{/each}
				</ul>
			{:else if rows.length === 0}
				<p class="empty">No public lobbies right now — check back or create one on the other tab.</p>
			{:else}
				<ul class="lobby-rows">
					{#each rows as L (L.id)}
						<li>
							<button
								type="button"
								class="row"
								class:selected={selectedId === L.id}
								id="pub-lobby-{L.id}"
								role="option"
								aria-selected={selectedId === L.id}
								on:click={() => pick(L.id)}
							>
								<span class="row-title">{L.name}</span>
								<span class="row-meta">{L.game_key} · {L.max_players} max</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="detail-pane card-like">
			{#if loadingDetail}
				<p class="muted">Loading…</p>
			{:else if detail}
				<h3 class="detail-title">{detail.lobby.name}</h3>
				<p class="detail-game">{detail.lobby.game_key}</p>
				<p class="detail-desc">
					{detail.lobby.description?.trim() || 'No description.'}
				</p>
				<div class="host-block">
					<span class="lbl">Host</span>
					<UserIdentity
						variant="row"
						displayName={detail.host.display_name}
						avatarUrl={detail.host.avatar_url}
						subtitle={detail.host.username ? `@${detail.host.username}` : null}
					/>
				</div>
				<p class="seats">{detail.memberCount} / {detail.lobby.max_players} players</p>
				<p class="code-line">
					Code: <CopyInviteCode code={detail.lobby.invite_code} />
				</p>
				<button
					type="button"
					class="btn primary join"
					disabled={busyJoinId !== null}
					on:click={() => onJoin(detail.lobby.id)}
				>
					{#if busyJoinId === detail.lobby.id}
						Joining…
					{:else}
						Join lobby
					{/if}
				</button>
			{:else}
				<p class="muted empty-detail">Select a lobby to see host and description.</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.public-browser {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.filters {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.search {
		flex: 1;
		min-width: 180px;
		padding: 0.45rem 0.6rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
	}
	.search:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}
	.game-filter select {
		padding: 0.45rem 0.5rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		max-width: 220px;
	}
	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
		min-height: 240px;
	}
	@media (max-width: 768px) {
		.split {
			grid-template-columns: 1fr;
		}
	}
	.list-pane {
		min-width: 0;
	}
	.lobby-rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
		max-height: 360px;
		overflow-y: auto;
	}
	.row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		width: 100%;
		text-align: left;
		padding: 0.65rem 0.75rem;
		border: none;
		border-bottom: 1px solid color-mix(in oklab, var(--color-text) 8%, transparent);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}
	.lobby-rows li:last-child .row {
		border-bottom: none;
	}
	.row:hover {
		background: color-mix(in oklab, var(--color-accent) 12%, var(--color-surface));
	}
	.row.selected {
		background: color-mix(in oklab, var(--color-accent) 22%, var(--color-surface));
	}
	.row:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: -2px;
	}
	.row-title {
		font-weight: 600;
		font-size: 0.95rem;
	}
	.row-meta {
		font-size: 0.78rem;
		color: var(--color-text-muted);
		font-family: ui-monospace, monospace;
	}
	.card-like {
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 1rem 1.1rem;
		background: var(--color-surface);
	}
	.detail-title {
		margin: 0 0 0.25rem;
		font-size: 1.15rem;
	}
	.detail-game {
		margin: 0 0 0.75rem;
		font-size: 0.8rem;
		color: var(--color-text-muted);
		font-family: ui-monospace, monospace;
	}
	.detail-desc {
		margin: 0 0 1rem;
		font-size: 0.92rem;
		line-height: 1.45;
		color: var(--color-text);
		white-space: pre-wrap;
	}
	.host-block {
		margin-bottom: 0.75rem;
	}
	.lbl {
		display: block;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		margin-bottom: 0.35rem;
	}
	.seats {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
	}
	.code-line {
		margin: 0 0 1rem;
		font-size: 0.88rem;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.btn {
		padding: 0.5rem 1rem;
		border-radius: 8px;
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface-muted);
		color: var(--color-text);
		cursor: pointer;
		font: inherit;
		font-weight: 500;
	}
	.btn.primary {
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		border-color: var(--color-accent-hover, var(--color-accent));
	}
	.btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
	.join {
		width: 100%;
	}
	.muted {
		color: var(--color-text-muted);
		font-size: 0.92rem;
	}
	.empty,
	.empty-detail {
		margin: 0;
	}
	.skeleton-list .sk {
		height: 3.25rem;
		background: linear-gradient(
			110deg,
			var(--color-surface-muted) 0%,
			color-mix(in oklab, var(--color-text) 8%, var(--color-surface-muted)) 45%,
			var(--color-surface-muted) 90%
		);
		background-size: 200% 100%;
		animation: shimmer 1.2s ease-in-out infinite;
		border-bottom: 1px solid color-mix(in oklab, var(--color-text) 8%, transparent);
	}
	@media (prefers-reduced-motion: reduce) {
		.skeleton-list .sk {
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
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
</style>
