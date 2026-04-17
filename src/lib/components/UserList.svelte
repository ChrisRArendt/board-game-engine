<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { users } from '$lib/stores/users';
	import {
		activeUserId,
		emit,
		getLocalPlayerColor,
		playerColorOverrides,
		playerOrder,
		toggleTurnHighlight,
		turnHighlightUserIds
	} from '$lib/stores/network';
	import { settings } from '$lib/stores/settings';
	import { friendVoicePrefs, setFriendVoicePref } from '$lib/stores/voiceSettings';
	import UserIdentity from '$lib/components/UserIdentity.svelte';

	export let selfUserId: string;
	export let selfDisplayName = 'You';
	export let selfAvatarUrl: string | null | undefined = undefined;

	const MENU_PAD = 8;

	let orderMenuOpen = false;
	/** Left edge of the menu (fixed), chosen so the menu stays on-screen (extends left from the click). */
	let orderMenuLeft = 0;
	let orderMenuTop = 0;
	let orderMenuPlayerId: string | null = null;
	/** Pointer position when opening — used to clamp after real menu size is known. */
	let orderMenuAnchorX = 0;
	let orderMenuAnchorY = 0;
	let orderMenuEl: HTMLUListElement | undefined;

	function closeOrderMenu() {
		if (!orderMenuOpen) return;
		orderMenuOpen = false;
		orderMenuPlayerId = null;
	}

	/** Full id list for reorder (same rules as orderedRoster / merge). */
	$: fullPlayerOrderIds = (() => {
		const po = $playerOrder;
		if (po.length > 0) return [...po];
		const others = $users
			.map((u) => u.id)
			.sort((a, b) => a.localeCompare(b));
		return [...others, selfUserId].sort((a, b) => a.localeCompare(b));
	})();

	function movePlayerOneStep(playerId: string, dir: -1 | 1) {
		const ids = [...fullPlayerOrderIds];
		const i = ids.indexOf(playerId);
		if (i < 0) return;
		const j = i + dir;
		if (j < 0 || j >= ids.length) return;
		const next = [...ids];
		[next[i], next[j]] = [next[j], next[i]];
		playerOrder.set(next);
		emit('player_order', { userIds: next });
		closeOrderMenu();
	}

	function fitOrderMenuToViewport() {
		if (typeof window === 'undefined' || !orderMenuEl) return;
		const pad = MENU_PAD;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const w = orderMenuEl.offsetWidth;
		const h = orderMenuEl.offsetHeight;
		// Anchor menu so it grows left from the cursor (right edge near avatars on the right dock)
		let rightEdge = orderMenuAnchorX;
		rightEdge = Math.min(rightEdge, vw - pad);
		rightEdge = Math.max(rightEdge, pad + w);
		orderMenuLeft = rightEdge - w;
		const maxT = Math.max(pad, vh - h - pad);
		orderMenuTop = Math.min(Math.max(pad, orderMenuAnchorY), maxT);
	}

	function onPortraitContextMenu(e: MouseEvent, playerId: string) {
		e.preventDefault();
		e.stopPropagation();
		orderMenuPlayerId = playerId;
		orderMenuAnchorX = e.clientX;
		orderMenuAnchorY = e.clientY;
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
		const estW = 220;
		const estH = 200;
		let rightEdge = e.clientX;
		rightEdge = Math.min(rightEdge, vw - MENU_PAD);
		rightEdge = Math.max(rightEdge, MENU_PAD + estW);
		orderMenuLeft = rightEdge - estW;
		orderMenuTop = Math.min(Math.max(MENU_PAD, e.clientY), vh - estH - MENU_PAD);
		orderMenuOpen = true;
		void tick().then(() =>
			requestAnimationFrame(() => {
				fitOrderMenuToViewport();
				requestAnimationFrame(fitOrderMenuToViewport);
			})
		);
	}

	onMount(() => {
		if (typeof window === 'undefined') return;
		const onResize = () => {
			if (orderMenuOpen) requestAnimationFrame(fitOrderMenuToViewport);
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	type RosterRow = {
		id: string;
		name: string;
		avatarUrl: string | null;
		color: string;
	};

	$: roster = (() => {
		$activeUserId;
		$settings;
		$playerColorOverrides;
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
			color: $playerColorOverrides[u.id] ?? u.color
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

	$: orderMenuFullIndex =
		orderMenuPlayerId != null ? fullPlayerOrderIds.indexOf(orderMenuPlayerId) : -1;
	$: canMoveUp = orderMenuFullIndex > 0;
	$: canMoveDown =
		orderMenuFullIndex >= 0 && orderMenuFullIndex < fullPlayerOrderIds.length - 1;

	$: voicePrefForMenu =
		orderMenuPlayerId && orderMenuPlayerId !== selfUserId
			? ($friendVoicePrefs[orderMenuPlayerId] ?? { volume: 1, muted: false })
			: null;

	function onVoiceVolumeInput(e: Event) {
		const v = parseFloat((e.currentTarget as HTMLInputElement).value);
		if (orderMenuPlayerId && orderMenuPlayerId !== selfUserId) {
			setFriendVoicePref(selfUserId, orderMenuPlayerId, { volume: v });
		}
	}

	function toggleVoiceMuteForMenu() {
		if (!orderMenuPlayerId || orderMenuPlayerId === selfUserId) return;
		const cur = $friendVoicePrefs[orderMenuPlayerId] ?? { volume: 1, muted: false };
		setFriendVoicePref(selfUserId, orderMenuPlayerId, { muted: !cur.muted });
	}
</script>

<svelte:window onclick={closeOrderMenu} />

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
					title="Left click: toggle “my turn”. Right click: move up/down in list."
					onclick={(e) => {
						e.stopPropagation();
						toggleTurnHighlight(player.id);
					}}
					oncontextmenu={(e) => {
						e.stopPropagation();
						onPortraitContextMenu(e, player.id);
					}}
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

{#if orderMenuOpen && orderMenuPlayerId}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<ul
		bind:this={orderMenuEl}
		class="order-ctx"
		style:top="{orderMenuTop}px"
		style:left="{orderMenuLeft}px"
		onpointerdown={(e) => e.stopPropagation()}
		onclick={(e) => e.stopPropagation()}
	>
		<li
			class:disabled={!canMoveUp}
			onpointerdown={() => canMoveUp && movePlayerOneStep(orderMenuPlayerId!, -1)}
		>
			Move up
		</li>
		<li
			class:disabled={!canMoveDown}
			onpointerdown={() => canMoveDown && movePlayerOneStep(orderMenuPlayerId!, 1)}
		>
			Move down
		</li>
		{#if orderMenuPlayerId !== selfUserId && voicePrefForMenu}
			<li class="voice-sep" aria-hidden="true"></li>
			<li class="voice-header">Voice (this player)</li>
			<li class="voice-slider">
				<label>
					Volume {Math.round(voicePrefForMenu.volume * 100)}%
					<input
						type="range"
						min="0"
						max="2"
						step="0.05"
						value={voicePrefForMenu.volume}
						oninput={onVoiceVolumeInput}
					/>
				</label>
			</li>
			<li
				class="voice-mute"
				onpointerdown={() => {
					toggleVoiceMuteForMenu();
				}}
			>
				{voicePrefForMenu.muted ? 'Unmute voice' : 'Mute voice'}
			</li>
		{/if}
	</ul>
{/if}

<style>
	.users {
		position: fixed;
		right: 0;
		top: 70px;
		/* Block <ul> would otherwise span full viewport width and steal clicks below the toolbar */
		width: fit-content;
		max-width: 100%;
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
	.order-ctx {
		position: fixed;
		z-index: 2000000004;
		list-style: none;
		margin: 0;
		padding: 4px 0;
		min-width: 200px;
		max-width: min(280px, calc(100vw - 16px));
		max-height: min(90vh, calc(100vh - 16px));
		overflow-x: hidden;
		overflow-y: auto;
		background: var(--color-context-bg);
		border: 1px solid var(--color-border-strong);
		border-radius: 4px;
		box-shadow: var(--shadow-md);
	}
	.order-ctx li {
		padding: 4px 20px;
		font-size: 14px;
		color: var(--color-text);
		cursor: pointer;
	}
	.order-ctx li:hover:not(.disabled) {
		background: var(--color-ctx-hover-bg);
		color: #fff;
	}
	.order-ctx li.disabled {
		opacity: 0.4;
		cursor: default;
	}
	.order-ctx li.voice-sep {
		height: 1px;
		padding: 0;
		margin: 6px 8px;
		background: var(--color-border);
		cursor: default;
	}
	.order-ctx li.voice-header {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		cursor: default;
		padding: 6px 12px 2px;
	}
	.order-ctx li.voice-slider {
		padding: 4px 12px 8px;
		cursor: default;
	}
	.order-ctx li.voice-slider label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 12px;
		color: var(--color-text);
	}
	.order-ctx li.voice-slider input[type='range'] {
		width: 100%;
	}
	.order-ctx li.voice-mute {
		font-size: 13px;
	}
</style>
