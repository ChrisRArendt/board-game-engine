<script lang="ts">
	import { browser } from '$app/environment';
	import { voiceChatState, joinVoiceRoom, leaveVoiceRoom, toggleMuted, toggleDeafened } from '$lib/stores/voiceChat';

	export let lobbyId: string;
	export let selfUserId: string;
	export let displayName: string;
	/** Only used on lobby (no main Settings window); opens voice/audio window. */
	export let onOpenSettings: (() => void) | undefined = undefined;

	let joining = false;
	let err = '';

	async function join() {
		if (!browser || !lobbyId) return;
		joining = true;
		err = '';
		try {
			await joinVoiceRoom(lobbyId, { userId: selfUserId, displayName });
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
			<li class="self">
				<span class="dot">●</span>
				<span class="name">You</span>
			</li>
			{#each Object.values($voiceChatState.peers) as p (p.userId)}
				<li class="peer" class:speaking={p.speaking}>
					<span class="dot" class:speaking={p.speaking}>●</span>
					<span class="name">{p.displayName}</span>
					<span class="state" title={p.connectionState}>{p.connectionState}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.voice-panel {
		background: rgba(20, 22, 28, 0.92);
		color: #e8e8ec;
		border-radius: 10px;
		padding: 10px 12px;
		min-width: 200px;
		max-width: 280px;
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
		max-height: 140px;
		overflow-y: auto;
	}
	.peers li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0;
		font-size: 12px;
	}
	.dot {
		color: #444;
		font-size: 10px;
	}
	.dot.speaking {
		color: #6d6;
		text-shadow: 0 0 8px #4f4;
	}
	.peer.speaking .name {
		color: #cfc;
	}
	.name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.state {
		font-size: 10px;
		opacity: 0.45;
		text-transform: uppercase;
	}
</style>
