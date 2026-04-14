<script lang="ts">
	import { browser } from '$app/environment';
	import {
		voiceChatState,
		joinVoiceRoom,
		leaveVoiceRoom,
		toggleMuted,
		toggleDeafened
	} from '$lib/stores/voiceChat';
	import { friendVoicePrefs, setFriendVoicePref } from '$lib/stores/voiceSettings';
	import UserIdentity from '$lib/components/UserIdentity.svelte';

	export let lobbyId: string;
	export let selfUserId: string;
	export let displayName: string;
	/** Your avatar in the voice list */
	export let selfAvatarUrl: string | null | undefined = undefined;
	/** Shown under your name (e.g. account email) — only local, not broadcast */
	export let selfEmail: string | null | undefined = undefined;
	/** Shown to others under your name when shared via presence (e.g. @username) */
	export let broadcastSubtitle: string | null | undefined = undefined;
	/** Only used on lobby (no main Settings window); opens voice/audio window. */
	export let onOpenSettings: (() => void) | undefined = undefined;

	let joining = false;
	let err = '';

	function prefFor(userId: string) {
		return $friendVoicePrefs[userId] ?? { volume: 1, muted: false };
	}

	function onPeerVolume(userId: string, e: Event) {
		const v = parseFloat((e.currentTarget as HTMLInputElement).value);
		setFriendVoicePref(selfUserId, userId, { volume: v });
	}

	function togglePeerMute(userId: string) {
		const cur = prefFor(userId);
		setFriendVoicePref(selfUserId, userId, { muted: !cur.muted });
	}

	async function join() {
		if (!browser || !lobbyId) return;
		joining = true;
		err = '';
		try {
			await joinVoiceRoom(lobbyId, {
				userId: selfUserId,
				displayName,
				avatarUrl: selfAvatarUrl ?? null,
				subtitle: broadcastSubtitle ?? null
			});
		} catch (e) {
			err = e instanceof Error ? e.message : 'Could not join voice';
		} finally {
			joining = false;
		}
	}

	function leave() {
		err = '';
		void leaveVoiceRoom();
	}
</script>

<div class="voice-panel" data-voice-panel>
	<div class="voice-head">
		<span class="title">Voice</span>
		{#if $voiceChatState.error}
			<span class="err" title={$voiceChatState.error}>⚠</span>
		{/if}
	</div>

	{#if !$voiceChatState.joined}
		<div class="join-row">
			{#if onOpenSettings}
				<button
					type="button"
					class="icon-btn"
					title="Voice & audio settings"
					onclick={() => onOpenSettings?.()}
				>
					⚙
				</button>
			{/if}
			<button type="button" class="join" disabled={joining || !lobbyId} onclick={() => void join()}>
				{joining ? 'Connecting…' : 'Join voice'}
			</button>
		</div>
		{#if err}
			<p class="err-msg">{err}</p>
		{/if}
	{:else}
		<div class="toolbar">
			<button
				type="button"
				class="icon-btn"
				title={$voiceChatState.muted ? 'Unmute' : 'Mute'}
				class:active={$voiceChatState.muted}
				onclick={() => toggleMuted()}
			>
				{$voiceChatState.muted ? '🔇' : '🎤'}
			</button>
			<button
				type="button"
				class="icon-btn"
				title={$voiceChatState.deafened ? 'Undeafen' : 'Deafen'}
				class:active={$voiceChatState.deafened}
				onclick={() => toggleDeafened()}
			>
				{$voiceChatState.deafened ? '🔕' : '🎧'}
			</button>
			<button type="button" class="leave" onclick={leave}>Leave</button>
		</div>

		<ul class="peers" aria-label="Voice participants">
			<li class="peer-row self">
				<div class="identity-wrap" class:speaking={$voiceChatState.localSpeaking}>
					<UserIdentity
						variant="compact"
						displayName={displayName}
						avatarUrl={selfAvatarUrl}
						subtitle={selfEmail}
					/>
				</div>
				<span class="state hint" title="Your connection">You</span>
			</li>
			{#each Object.values($voiceChatState.peers) as p (p.userId)}
				{@const pref = prefFor(p.userId)}
				<li class="peer-row" class:speaking={p.speaking}>
					<div class="identity-wrap" class:speaking={p.speaking}>
						<UserIdentity
							variant="compact"
							displayName={p.displayName}
							avatarUrl={p.avatarUrl}
							subtitle={p.subtitle}
						/>
					</div>
					<div class="peer-ctrl">
						<label class="vol" title="Volume for you only">
							<span class="sr-only">Volume for {p.displayName}</span>
							<input
								type="range"
								min="0"
								max="2"
								step="0.05"
								value={pref.volume}
								disabled={pref.muted}
								oninput={(e) => onPeerVolume(p.userId, e)}
							/>
						</label>
						<button
							type="button"
							class="peer-mute"
							title={pref.muted ? 'Unmute for yourself' : 'Mute for yourself'}
							onclick={() => togglePeerMute(p.userId)}
						>
							{pref.muted ? '🔇' : '🔊'}
						</button>
					</div>
					<span
						class="state"
						class:ok={p.connectionState === 'connected'}
						title={`WebRTC: ${p.connectionState}`}
					>
						{p.connectionState === 'connected' ? '●' : p.connectionState}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.voice-panel {
		background: rgba(20, 22, 28, 0.92);
		color: #e8e8ec;
		border-radius: 10px;
		padding: 10px 12px;
		min-width: 240px;
		max-width: min(380px, calc(100vw - 24px));
		font-size: 13px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.voice-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-size: 11px;
		opacity: 0.9;
	}
	.join-row {
		display: flex;
		align-items: stretch;
		gap: 8px;
	}
	.join {
		flex: 1;
		min-width: 0;
		padding: 8px 12px;
		border-radius: 8px;
		border: none;
		background: #3d5;
		color: #0a0f0a;
		font-weight: 600;
		cursor: pointer;
	}
	.join:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.err-msg {
		margin: 8px 0 0;
		font-size: 12px;
		color: #f88;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
	}
	.icon-btn {
		width: 36px;
		height: 32px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.06);
		color: #e8e8ec;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
	}
	.icon-btn.active {
		background: rgba(255, 80, 80, 0.35);
		border-color: rgba(255, 120, 120, 0.5);
	}
	.leave {
		margin-left: auto;
		padding: 6px 10px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: transparent;
		color: #ccc;
		cursor: pointer;
		font-size: 12px;
	}
	.peers {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: min(280px, 46vh);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.peer-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 22px;
		grid-template-rows: auto;
		align-items: center;
		gap: 6px 8px;
		font-size: 12px;
	}
	.peer-row.self {
		grid-template-columns: minmax(0, 1fr) auto;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		padding-bottom: 8px;
		margin-bottom: 2px;
	}
	.identity-wrap {
		min-width: 0;
	}
	.identity-wrap.speaking :global(.circle) {
		box-shadow:
			0 0 0 2px rgba(34, 197, 94, 0.9),
			0 0 14px rgba(34, 197, 94, 0.35);
		animation: voice-ring 1.1s ease-in-out infinite;
	}
	@keyframes voice-ring {
		0%,
		100% {
			box-shadow:
				0 0 0 2px rgba(34, 197, 94, 0.85),
				0 0 12px rgba(34, 197, 94, 0.3);
		}
		50% {
			box-shadow:
				0 0 0 3px rgba(52, 211, 153, 0.95),
				0 0 22px rgba(34, 197, 94, 0.55);
		}
	}
	.peer-ctrl {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.vol input[type='range'] {
		width: 72px;
		height: 4px;
		accent-color: #6d8;
		cursor: pointer;
	}
	.peer-mute {
		width: 28px;
		height: 28px;
		padding: 0;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.06);
		cursor: pointer;
		font-size: 13px;
		line-height: 1;
	}
	.peer-mute:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	.state {
		font-size: 9px;
		opacity: 0.5;
		text-transform: uppercase;
		text-align: right;
	}
	.state.ok {
		opacity: 0.75;
		color: #6d8;
	}
	.state.hint {
		text-transform: none;
		font-size: 11px;
		opacity: 0.55;
	}
	.peer-row :global(.identity.compact) {
		gap: 0.45rem;
	}
	.peer-row :global(.identity.compact .primary) {
		color: #e8eaf0;
		font-size: 0.82rem;
	}
	.peer-row :global(.identity.compact .sub) {
		font-size: 0.68rem;
		max-width: 200px;
	}
</style>
