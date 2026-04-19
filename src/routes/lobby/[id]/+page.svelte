<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { connectLobbyChannel, disconnectLobby, emitLobby } from '$lib/stores/network';
	import { users } from '$lib/stores/users';
	import {
		getLobby,
		startGame,
		deleteLobby,
		leaveLobby,
		persistLobbyMemberOrderWithoutRpc,
		updateLobby,
		type LobbyRow
	} from '$lib/lobby';
	import {
		fetchLobbyMembersOrdered,
		isRpcMissingFromCacheError,
		isSortOrderMissingError
	} from '$lib/lobby/sortOrderFallback';
	import CopyInviteCode from '$lib/components/CopyInviteCode.svelte';
	import LobbyRoomChat from '$lib/components/LobbyRoomChat.svelte';
	import UserIdentity from '$lib/components/UserIdentity.svelte';
	import VoiceControls from '$lib/components/VoiceControls.svelte';
	import VoiceSettings from '$lib/components/windows/VoiceSettings.svelte';
	import WindowFrame from '$lib/components/windows/WindowFrame.svelte';
	import { loadFriendVoicePrefsFromSupabase, registerFriendVoiceSaver } from '$lib/stores/voiceSettings';
	import { leaveVoiceRoom, tryAutoJoinVoice } from '$lib/stores/voiceChat';
	import type { RealtimeChannel } from '@supabase/supabase-js';
	import type { PageData } from './$types';
	import { getFriends, type FriendWithProfile } from '$lib/friends';
	import { listPendingInvitesForLobby, type LobbyInviteRow } from '$lib/invites';
	import { markLobbyInviteNotificationsReadForLobby } from '$lib/notifications';
	import { selfPresenceMeta } from '$lib/stores/onlinePresence';
	import InviteFriendsPicker from '$lib/components/InviteFriendsPicker.svelte';

	export let data: PageData;

	/** DB DELETE watch — host may delete the lobby from the hub list with no broadcast; members still see this row vanish. */
	let lobbyDeleteCh: RealtimeChannel | null = null;
	/** DB lobby_members changes — keep player list in sync when others join/leave (SSR snapshot is stale). */
	let lobbyMembersCh: RealtimeChannel | null = null;
	let lobbyRowCh: RealtimeChannel | null = null;
	let inviteCh: RealtimeChannel | null = null;

	let friendsForInvite: FriendWithProfile[] = [];
	let pendingInvites: LobbyInviteRow[] = [];
	let invitePickerOpen = false;

	$: memberIds = new Set(membersOrdered.map((m) => m.user_id));

	$: if (browser) {
		selfPresenceMeta.set({
			status: 'in_lobby',
			lobby_id: data.lobby.id,
			lobby_name: room.name,
			game_key: room.game_key
		});
	}

	async function loadInviteContext() {
		try {
			friendsForInvite = await getFriends(supabase, data.session.user.id);
			if (isHost) {
				pendingInvites = await listPendingInvitesForLobby(supabase, data.lobby.id);
			}
		} catch {
			/* ignore */
		}
	}

	async function resolveInviteEntry() {
		try {
			await markLobbyInviteNotificationsReadForLobby(supabase, data.session.user.id, data.lobby.id);
			const { data: inv } = await supabase
				.from('lobby_invites')
				.select('*')
				.eq('lobby_id', data.lobby.id)
				.eq('invitee_id', data.session.user.id)
				.eq('status', 'pending')
				.maybeSingle();
			if (inv && new Date(inv.expires_at).getTime() > Date.now()) {
				await supabase
					.from('lobby_invites')
					.update({
						status: 'accepted',
						responded_at: new Date().toISOString()
					})
					.eq('id', inv.id);
			}
		} catch {
			/* ignore */
		}
	}

	type MemberRow = {
		user_id: string;
		sort_order: number;
		display_name: string;
		avatar_url: string | null;
	};

	const supabase = createSupabaseBrowserClient();
	const isHost = data.lobby.host_id === data.session.user.id;

	let room: LobbyRow = data.lobby;
	let editName = data.lobby.name;
	let editDescription = data.lobby.description ?? '';
	let editMax = data.lobby.max_players;
	let editVisibility: LobbyRow['visibility'] = data.lobby.visibility ?? 'private';

	const LOBBY_SAVE_DEBOUNCE_MS = 1000;
	let lobbySaveTimer: ReturnType<typeof setTimeout> | null = null;
	let lobbySaveBusy = false;

	function applyLobbyRow(row: LobbyRow) {
		room = row;
		editName = row.name;
		editDescription = row.description ?? '';
		editMax = row.max_players;
		editVisibility = row.visibility ?? 'private';
	}

	function clearLobbySaveDebounce() {
		if (lobbySaveTimer) {
			clearTimeout(lobbySaveTimer);
			lobbySaveTimer = null;
		}
	}

	function scheduleLobbyFieldsSave() {
		if (!isHost) return;
		clearLobbySaveDebounce();
		lobbySaveTimer = setTimeout(() => {
			lobbySaveTimer = null;
			void persistLobbyFields();
		}, LOBBY_SAVE_DEBOUNCE_MS);
	}

	async function persistLobbyFields() {
		if (!isHost) return;
		lobbySaveBusy = true;
		errMsg = '';
		try {
			const nextName = editName.trim() || 'Lobby';
			const nextMax = Math.min(20, Math.max(2, Math.floor(Number(editMax))));
			await updateLobby(supabase, data.lobby.id, data.session.user.id, {
				name: nextName,
				description: editDescription.trim(),
				max_players: nextMax,
				visibility: editVisibility
			});
			const row = await getLobby(supabase, data.lobby.id);
			if (row) applyLobbyRow(row);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not save settings';
		}
		lobbySaveBusy = false;
	}

	function setVisibility(vis: LobbyRow['visibility']) {
		editVisibility = vis;
		clearLobbySaveDebounce();
		void persistLobbyFields();
	}

	let errMsg = '';
	/** True when order was synced over the socket but DB writes failed (PostgREST schema cache). */
	let lobbyOrderBroadcastOnly = false;
	let starting = false;
	let reordering = false;
	let deleting = false;
	let leaving = false;

	let winVoice = false;
	let voicePanelVisible = true;

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

	async function refreshMembersFromDb() {
		try {
			const rows = await fetchLobbyMembersOrdered(supabase, data.lobby.id);
			const userIds = rows.map((r) => r.user_id);
			if (userIds.length === 0) {
				membersOrdered = [];
				profileById.clear();
				return;
			}
			const { data: profs, error } = await supabase
				.from('profiles')
				.select('id, display_name, avatar_url')
				.in('id', userIds);
			if (error) {
				errMsg = error.message;
				return;
			}
			const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
			membersOrdered = rows.map((r) => {
				const p = pmap.get(r.user_id);
				const row: MemberRow = {
					user_id: r.user_id,
					sort_order: r.sort_order,
					display_name: p?.display_name ?? 'Player',
					avatar_url: p?.avatar_url ?? null
				};
				return row;
			});
			profileById.clear();
			for (const m of membersOrdered) profileById.set(m.user_id, m);
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not refresh players';
		}
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
		lobbyOrderBroadcastOnly = false;
		const userIds = membersOrdered.map((m) => m.user_id);
		let err = (
			await supabase.rpc('set_lobby_member_order', {
				p_lobby_id: data.lobby.id,
				p_user_ids: userIds
			})
		).error;

		/* RPC can fail with "function not in cache" OR "sort_order column not in cache" — try row updates. */
		if (err && (isRpcMissingFromCacheError(err) || isSortOrderMissingError(err))) {
			const fb = await persistLobbyMemberOrderWithoutRpc(supabase, data.lobby.id, userIds);
			err = fb.error;
		}

		/* UPDATE also touches sort_order in PostgREST — broadcast order so all clients match until NOTIFY pgrst. */
		if (err && isSortOrderMissingError(err)) {
			await emitLobby('lobby_order', { userIds });
			reordering = false;
			lobbyOrderBroadcastOnly = true;
			return;
		}

		reordering = false;
		if (err) {
			errMsg = err.message;
			membersOrdered = previous;
			return;
		}
		await emitLobby('lobby_order', { userIds });
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

	const memberOrderStorageKey = `bge:member_order:${data.lobby.id}`;

	function onGameStart(ev: Event) {
		const d = (ev as CustomEvent<{ userIds?: string[] }>).detail;
		if (Array.isArray(d?.userIds) && d.userIds.length > 0) {
			try {
				sessionStorage.setItem(memberOrderStorageKey, JSON.stringify(d.userIds));
			} catch {
				/* ignore quota / private mode */
			}
		}
		disconnectLobby();
		void goto(`/play/${data.lobby.id}`);
	}

	async function hostStart() {
		if (!isHost) return;
		starting = true;
		errMsg = '';
		try {
			const userIds = membersOrdered.map((m) => m.user_id);
			await startGame(supabase, data.lobby.id, data.session.user.id);
			await emitLobby('game_start', { userIds });
			try {
				sessionStorage.setItem(memberOrderStorageKey, JSON.stringify(userIds));
			} catch {
				/* ignore */
			}
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
			await emitLobby('lobby_deleted', {});
			await deleteLobby(supabase, data.lobby.id, data.session.user.id);
			disconnectLobby();
			await leaveVoiceRoom();
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
				await emitLobby('lobby_finished', {});
			}
			await leaveLobby(supabase, data.lobby.id, data.session.user.id);
			disconnectLobby();
			await leaveVoiceRoom();
			await goto('/lobby');
		} catch (e) {
			errMsg = e instanceof Error ? e.message : 'Could not leave';
		}
		leaving = false;
	}

	onMount(() => {
		void loadInviteContext();
		void resolveInviteEntry();

		if (isHost) {
			inviteCh = supabase
				.channel(`lobby_invites_room:${data.lobby.id}`)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'lobby_invites',
						filter: `lobby_id=eq.${data.lobby.id}`
					},
					() => {
						void loadInviteContext();
					}
				);
			void inviteCh.subscribe();
		}

		lobbyDeleteCh = supabase
			.channel(`lobby_delete_watch:${data.lobby.id}`)
			.on(
				'postgres_changes',
				{
					event: 'DELETE',
					schema: 'public',
					table: 'lobbies',
					filter: `id=eq.${data.lobby.id}`
				},
				() => {
					disconnectLobby();
					void leaveVoiceRoom();
					void goto('/lobby');
				}
			);
		void lobbyDeleteCh.subscribe();

		lobbyMembersCh = supabase
			.channel(`lobby_members_watch:${data.lobby.id}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'lobby_members',
					filter: `lobby_id=eq.${data.lobby.id}`
				},
				() => {
					void refreshMembersFromDb();
				}
			);
		void lobbyMembersCh.subscribe();

		lobbyRowCh = supabase
			.channel(`lobby_row_watch:${data.lobby.id}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'lobbies',
					filter: `id=eq.${data.lobby.id}`
				},
				(payload) => {
					const n = payload.new as LobbyRow | undefined;
					if (n) applyLobbyRow(n);
				}
			);
		void lobbyRowCh.subscribe();

		void (async () => {
			if (!data.profile) return;
			try {
				await connectLobbyChannel(data.lobby.id, {
					userId: data.session.user.id,
					displayName: data.profile.display_name,
					avatarUrl: data.profile.avatar_url
				});
				registerFriendVoiceSaver(supabase);
				await loadFriendVoicePrefsFromSupabase(supabase, data.session.user.id);
				tryAutoJoinVoice(data.lobby.id, {
					userId: data.session.user.id,
					displayName: data.profile.display_name,
					avatarUrl: data.profile.avatar_url,
					subtitle: data.profile.username ? `@${data.profile.username}` : null
				});
				await refreshMembersFromDb();
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
			selfPresenceMeta.set({});
			if (inviteCh) {
				void supabase.removeChannel(inviteCh);
				inviteCh = null;
			}
			if (lobbySaveTimer && isHost) {
				clearTimeout(lobbySaveTimer);
				lobbySaveTimer = null;
				void persistLobbyFields();
			} else {
				clearLobbySaveDebounce();
			}
			window.removeEventListener('bge:game_start', onGameStart);
			window.removeEventListener('bge:lobby_order', onLobbyOrderEv);
			window.removeEventListener('bge:lobby_deleted', onLobbyDeleted);
			window.removeEventListener('bge:lobby_finished', onLobbyFinished);
			if (lobbyDeleteCh) {
				void supabase.removeChannel(lobbyDeleteCh);
				lobbyDeleteCh = null;
			}
			if (lobbyMembersCh) {
				void supabase.removeChannel(lobbyMembersCh);
				lobbyMembersCh = null;
			}
			if (lobbyRowCh) {
				void supabase.removeChannel(lobbyRowCh);
				lobbyRowCh = null;
			}
			disconnectLobby();
			/* Do not leave voice here — user may navigate to /play for the same lobby. */
		};
	});

	onDestroy(() => {
		selfPresenceMeta.set({});
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
		<h1 class="side-title">{room.name}</h1>
		<p class="meta">
			Game: {room.game_key} · Code:
			<CopyInviteCode code={room.invite_code} />·
			{membersOrdered.length} / {room.max_players} players
			· <span class="vis-pill" title="Who can discover this lobby">{room.visibility}</span>
		</p>
		{#if errMsg}
			<p class="err">{errMsg}</p>
		{/if}

		<section class="card lobby-settings">
			<h2>Lobby details</h2>
			{#if isHost}
				<label class="field">
					<span class="lbl">Name</span>
					<input
						type="text"
						bind:value={editName}
						maxlength="120"
						oninput={scheduleLobbyFieldsSave}
					/>
				</label>
				<label class="field">
					<span class="lbl">Description</span>
					<textarea
						bind:value={editDescription}
						rows="3"
						maxlength="2000"
						placeholder="Tell players what to expect…"
						oninput={scheduleLobbyFieldsSave}
					></textarea>
				</label>
				<label class="field">
					<span class="lbl">Max players</span>
					<input
						type="number"
						min="2"
						max="20"
						bind:value={editMax}
						oninput={scheduleLobbyFieldsSave}
					/>
				</label>
				<div class="field">
					<span class="lbl" id="vis-label">Visibility</span>
					<div class="vis-seg" role="group" aria-labelledby="vis-label">
						{#each ['private', 'friends', 'public'] as vis (vis)}
							<button
								type="button"
								class="vis-btn"
								class:active={editVisibility === vis}
								onclick={() => setVisibility(vis as LobbyRow['visibility'])}
							>
								{vis}
							</button>
						{/each}
					</div>
				</div>
				{#if lobbySaveBusy}
					<p class="save-status" aria-live="polite">Saving…</p>
				{/if}
			{:else}
				<p class="desc-readonly">{room.description?.trim() || 'No description yet.'}</p>
			{/if}
		</section>

		<section class="card in-room">
			<h2>Players</h2>
			{#if lobbyOrderBroadcastOnly}
				<p class="hint">Player order is updated for everyone in this room.</p>
				{#if isHost}
					<details class="admin-hint">
						<summary>If order resets after reload</summary>
						<p>In Supabase, open the SQL editor and run:</p>
						<pre>NOTIFY pgrst, 'reload schema';</pre>
					</details>
				{/if}
			{/if}
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
			<button
				type="button"
				class="btn full"
				onclick={() => {
					invitePickerOpen = true;
					void loadInviteContext();
				}}
			>
				Invite friends
			</button>
			<InviteFriendsPicker
				bind:open={invitePickerOpen}
				lobbyId={data.lobby.id}
				hostId={data.session.user.id}
				gameKey={room.game_key}
				friends={friendsForInvite}
				memberUserIds={memberIds}
				pendingInvites={pendingInvites}
			/>
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

		<p class="back"><a href="/lobby">← Back to lobbies</a></p>

		<button type="button" class="btn ghost full voice-toggle" onclick={() => (voicePanelVisible = !voicePanelVisible)}>
			{voicePanelVisible ? 'Hide voice panel' : 'Show voice panel'}
		</button>
	</aside>
</div>

{#if voicePanelVisible}
	<div class="voice-dock-lobby">
		<VoiceControls
			lobbyId={data.lobby.id}
			selfUserId={data.session.user.id}
			displayName={data.profile?.display_name ?? 'You'}
			selfAvatarUrl={data.profile?.avatar_url}
			selfEmail={data.session.user.email}
			broadcastSubtitle={data.profile?.username ? `@${data.profile.username}` : null}
			onOpenSettings={() => (winVoice = true)}
		/>
	</div>
{/if}

<div class="lobby-voice-window">
	<WindowFrame title="Voice settings" visible={winVoice} requestClose={() => (winVoice = false)}>
		<VoiceSettings />
	</WindowFrame>
</div>

<style>
	.room {
		max-width: 1280px;
		margin: 0 auto;
		padding: 1.5rem;
		font-family: Roboto, system-ui, sans-serif;
		color: var(--color-text);
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
		color: var(--color-text-muted);
		line-height: 1.6;
	}
	.vis-pill {
		display: inline-block;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		background: color-mix(in oklab, var(--color-text) 12%, transparent);
		color: var(--color-text);
	}
	.lobby-settings {
		margin-bottom: 0.75rem;
	}
	.lobby-settings h2 {
		margin-top: 0;
		font-size: 1rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.75rem;
	}
	.field .lbl {
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-text-muted);
	}
	.field input,
	.field textarea {
		padding: 0.45rem 0.55rem;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
	}
	.field textarea {
		resize: vertical;
		min-height: 4rem;
	}
	.vis-seg {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.vis-btn {
		flex: 1;
		min-width: 4.5rem;
		padding: 0.4rem 0.5rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface-muted);
		color: var(--color-text);
		font: inherit;
		font-size: 0.82rem;
		text-transform: capitalize;
		cursor: pointer;
	}
	.vis-btn.active {
		border-color: var(--color-accent);
		background: color-mix(in oklab, var(--color-accent) 22%, var(--color-surface));
		color: var(--color-text);
	}
	.vis-btn:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.save-status {
		margin: 0 0 0.5rem;
		font-size: 0.82rem;
		color: var(--color-text-muted);
	}
	.desc-readonly {
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.45;
		white-space: pre-wrap;
		color: var(--color-text);
	}
	.admin-hint {
		margin: 0.35rem 0 0.75rem;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}
	.admin-hint pre {
		margin: 0.35rem 0 0;
		padding: 0.5rem 0.65rem;
		background: var(--color-surface-muted);
		border-radius: 6px;
		font-size: 0.8rem;
		overflow-x: auto;
		color: var(--color-text);
	}
	.hint {
		font-size: 0.85rem;
		color: var(--color-text-muted);
		margin: 0 0 0.5rem;
	}
	.err {
		color: var(--color-danger);
	}
	.muted {
		color: var(--color-text-muted);
	}
	.btn {
		padding: 0.55rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface-muted);
		color: var(--color-text);
		cursor: pointer;
		font-size: 1rem;
	}
	.btn.primary {
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		border-color: var(--color-accent-hover);
	}
	.btn:disabled {
		opacity: 0.6;
	}
	.btn.full {
		width: 100%;
		box-sizing: border-box;
	}
	.btn.danger {
		background: var(--color-danger-soft-bg);
		color: var(--color-danger);
		border-color: var(--color-danger-soft-border);
	}
	.btn.danger:hover:not(:disabled) {
		filter: brightness(1.08);
	}
	.back {
		margin-top: 1.25rem;
	}
	.back a {
		color: var(--color-link);
	}
	.btn.ghost {
		background: transparent;
		color: var(--color-text-muted);
		border-color: var(--color-border-strong);
	}
	.voice-toggle {
		margin-top: 0.75rem;
	}
	.voice-dock-lobby {
		position: fixed;
		left: 12px;
		bottom: 12px;
		z-index: 50;
		pointer-events: auto;
	}
	.lobby-voice-window {
		position: fixed;
		inset: 0;
		z-index: 100;
		pointer-events: none;
	}
	.lobby-voice-window :global(.window) {
		pointer-events: auto;
	}
	.card {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1rem 1.1rem;
		background: var(--color-surface);
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
		border: 1px solid var(--color-border-strong);
		border-radius: 4px;
		background: var(--color-surface-muted);
		color: var(--color-text);
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
