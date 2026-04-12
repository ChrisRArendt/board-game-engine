<script lang="ts">
	import { users } from '$lib/stores/users';
	import {
		activeUserId,
		getLocalPlayerColor,
		playerOrder,
		toggleTurnHighlight,
		turnHighlightUserIds
	} from '$lib/stores/network';
	import UserIdentity from '$lib/components/UserIdentity.svelte';

	export let selfUserId: string;
	export let selfDisplayName = 'You';
	export let selfAvatarUrl: string | null | undefined = undefined;

	type RosterRow = {
		id: string;
		name: string;
		avatarUrl: string | null;
		color: string;
	};

	$: roster = (() => {
		$activeUserId;
		const me: RosterRow = {
			id: selfUserId,
			name: selfDisplayName,
			avatarUrl: selfAvatarUrl ?? null,
			color: getLocalPlayerColor()
		};
		const others: RosterRow[] = $users.map((u) => ({
			id: u.id,
			name: u.name,
			avatarUrl: u.avatarUrl ?? null,
			color: u.color
		}));
		return [...others, me].sort((a, b) => a.id.localeCompare(b.id));
	})();

	$: byId = new Map(roster.map((r) => [r.id, r]));

	/** Same order as lobby (playerOrder from lobby_members.sort_order). */
	$: orderedRoster = (() => {
		const order = $playerOrder;
		if (!order.length) return roster;
		const present = new Set(roster.map((r) => r.id));
		const out: RosterRow[] = [];
		for (const id of order) {
			if (!present.has(id)) continue;
			const r = byId.get(id);
			if (r) out.push(r);
		}
		for (const r of roster) {
			if (!order.includes(r.id)) out.push(r);
		}
		return out;
	})();

	function hasTurn(id: string) {
		return $turnHighlightUserIds.includes(id);
	}
</script>

<ul class="users" aria-label="Players">
	{#each orderedRoster as player (player.id)}
		<li class="row">
			<div class="turn-rail" aria-hidden="true">
				{#if hasTurn(player.id)}
					<span class="turn-label">MY TURN</span>
				{/if}
			</div>
			<div class="portrait-shell" class:has-turn={hasTurn(player.id)}>
				<button
					type="button"
					class="portrait"
					aria-pressed={hasTurn(player.id)}
					title="Toggle “my turn” for this player"
					on:click|stopPropagation={() => toggleTurnHighlight(player.id)}
				>
					<UserIdentity
						variant="board"
						displayName={player.name}
						avatarUrl={player.avatarUrl}
						showRing={true}
						ringColor={player.color}
					/>
				</button>
			</div>
		</li>
	{/each}
</ul>

<style>
	.users {
		position: fixed;
		right: 0;
		top: 70px;
		list-style: none;
		z-index: 2000000000;
		margin: 0;
		padding: 0 8px 0 0;
	}
	.row {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		width: 118px;
		min-height: 76px;
		margin-bottom: 8px;
		box-sizing: border-box;
	}
	.turn-rail {
		flex: 0 0 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100%;
	}
	.turn-label {
		font-size: 7.5px;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: #f59e0b;
		text-transform: uppercase;
		font-family: system-ui, sans-serif;
		line-height: 1;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		white-space: nowrap;
	}
	.portrait-shell {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(15, 23, 42, 0.35);
		box-sizing: border-box;
		transition:
			border-color 0.12s,
			box-shadow 0.12s;
	}
	.portrait-shell.has-turn {
		border-color: rgba(251, 191, 36, 0.85);
		box-shadow:
			0 0 0 1px rgba(251, 191, 36, 0.5),
			0 0 14px rgba(251, 191, 36, 0.25);
		background: rgba(251, 191, 36, 0.85);
	}
	.portrait {
		all: unset;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 64px;
		cursor: pointer;
		border-radius: 8px;
	}
	.portrait:hover {
		background: rgba(255, 255, 255, 0.05);
	}
	.portrait:focus-visible {
		outline: 2px solid #93c5fd;
		outline-offset: 2px;
	}
	.portrait :global(.identity.board) {
		max-width: 100%;
	}
</style>
