<script lang="ts">
	import { game } from '$lib/stores/game';
	import * as g from '$lib/stores/game';
	import { hasAttr } from '$lib/engine/pieces';
	import { browser } from '$app/environment';
	import { getViewportSize } from '$lib/engine/geometry';
	import { voiceChatState, joinVoiceRoom, leaveVoiceRoom } from '$lib/stores/voiceChat';

	export let curGame = 'bsg_1';

	function focalCenter() {
		const vp = getViewportSize();
		if (!browser) return { left: 0, top: 0 };
		return { left: vp.w / 2 + window.scrollX, top: vp.h / 2 + window.scrollY };
	}

	$: sel = $game.pieces.filter((p) => $game.selectedIds.has(p.id));
	$: showDup = sel.length > 0 && sel.every((p) => hasAttr(p, 'duplicate'));
	$: showFlip = sel.length > 0 && sel.every((p) => hasAttr(p, 'flip'));
	$: showDest = sel.length > 0 && sel.every((p) => hasAttr(p, 'destroy'));
	$: showShuf = sel.length > 1 && sel.every((p) => hasAttr(p, 'shuffle'));
	$: showFan = sel.length > 1;
	$: showStack = sel.length > 1;

	/** Svelte 5: use `on*` + PascalCase for callback props; use `onclick={() => onOpenX()}` — not `onclick={onOpenX}` (see compiler `build_event_handler`). */
	export let onOpenRoller: () => void;
	export let onOpenViewer: () => void;
	export let onOpenSettings: () => void;
	export let onOpenConnection: () => void;
	/** Host-only: end the game for everyone (shown when set). */
	export let onEndGame: (() => void) | null = null;
	/** When set (e.g. in /play), toolbar shows Join voice / Leave voice for this lobby. */
	export let voiceLobbyId: string | null = null;
	export let voiceUserId: string | null = null;
	export let voiceDisplayName: string | null = null;

	let voiceBusy = false;

	async function onVoiceToolbarClick() {
		if (!browser || !voiceLobbyId || !voiceUserId || !voiceDisplayName) return;
		voiceBusy = true;
		try {
			if ($voiceChatState.joined) {
				await leaveVoiceRoom();
			} else {
				await joinVoiceRoom(voiceLobbyId, {
					userId: voiceUserId,
					displayName: voiceDisplayName
				});
			}
		} finally {
			voiceBusy = false;
		}
	}
</script>

<ul class="controls" data-toolbar>
	<li class="spacer"></li>
	<li class="zoomout">
		<button type="button" class="tb-btn" onclick={() => g.adjustZoom(-1, focalCenter())}>-</button>
	</li>
	<li class="zoomin">
		<button type="button" class="tb-btn" onclick={() => g.adjustZoom(1, focalCenter())}>+</button>
	</li>
	<li class="spacer double"></li>
	<li class="origin"><button type="button" class="tb-btn" onclick={() => g.resetPan()}>O</button></li>
	<li class="rulebook">
		<button
			type="button"
			class="tb-btn"
			onclick={() => {
				window.open(`/data/${curGame}/rules.pdf`, '_blank', 'noopener,noreferrer');
			}}
		>
			Rules
		</button>
	</li>
	<li class="spacer double"></li>
	<li class="textbox"><button type="button" class="tb-btn" onclick={() => onOpenRoller()}>Roller</button></li>
	<li class="textbox">
		<button
			type="button"
			class="tb-btn"
			title="Enlarged preview of the selected piece — only visible on your screen"
			onclick={() => onOpenViewer()}
		>
			Viewer
		</button>
	</li>
	{#if showDup}
		<li class="dup">
			<button type="button" class="tb-btn" onclick={() => sel.forEach((p) => g.duplicatePiece(p.id))}
				>Duplicate</button
			>
		</li>
	{/if}
	{#if showDest}
		<li class="dest">
			<button type="button" class="tb-btn" onclick={() => sel.forEach((p) => g.destroyPiece(p.id))}
				>Destroy</button
			>
		</li>
	{/if}
	{#if showFlip}
		<li class="flip">
			<button type="button" class="tb-btn" onclick={() => sel.forEach((p) => g.flipPiece(p.id))}
				>Flip</button
			>
		</li>
	{/if}
	{#if showShuf}
		<li class="shuf"><button type="button" class="tb-btn" onclick={() => g.runShuffleSelected()}>Shuffle</button></li>
	{/if}
	{#if showFan}
		<li class="fan"><button type="button" class="tb-btn" onclick={() => g.runArrangeFanned()}>Fan</button></li>
	{/if}
	{#if showStack}
		<li class="stack">
			<button type="button" class="tb-btn" onclick={() => g.runShuffleStackToolbar()}>Stack</button>
		</li>
	{/if}
	<li class="right">
		<ul class="right-inner">
			{#if onEndGame}
				<li class="endgame">
					<button type="button" class="tb-btn" onclick={() => onEndGame?.()}>End game</button>
				</li>
			{/if}
			<li class="settings">
				<button type="button" class="tb-btn" onclick={() => onOpenSettings()}>Settings</button>
			</li>
			{#if voiceLobbyId && voiceUserId && voiceDisplayName}
				<li class="voice-li">
					<button
						type="button"
						class="tb-btn voice-tb"
						disabled={voiceBusy}
						onclick={() => void onVoiceToolbarClick()}
					>
						<svg class="voice-mic" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
							<path
								fill="currentColor"
								d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"
							/>
						</svg>
						<span class="voice-tb-label"
							>{voiceBusy
								? '…'
								: $voiceChatState.joined
									? 'Leave voice'
									: 'Join voice'}</span
						>
					</button>
				</li>
			{/if}
			<li class="conn-li">
				<button type="button" class="tb-btn" onclick={() => onOpenConnection()}>Connection</button>
			</li>
		</ul>
	</li>
</ul>

<style>
	.controls {
		width: 100%;
		position: fixed;
		top: 0;
		left: 0;
		font-size: 0;
		list-style: none;
		z-index: 2000000001;
		background: linear-gradient(to bottom, rgba(255, 255, 255, 0.9), rgba(230, 230, 230, 0.9));
		box-shadow: 0 6px 10px rgba(0, 0, 0, 0.35);
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
	}
	.controls > li {
		height: 22px;
		display: inline-flex;
		align-items: center;
		vertical-align: top;
		cursor: pointer;
	}
	.tb-btn {
		all: unset;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0 10px;
		line-height: 22px;
		font-size: 15px;
		color: #333;
		margin: 0;
		user-select: none;
		cursor: pointer;
		box-sizing: border-box;
		pointer-events: auto;
	}
	.controls > li:hover > .tb-btn,
	.controls .right .right-inner > li:hover > .tb-btn {
		background: linear-gradient(to bottom, #aaa, #777);
		color: #fff;
	}
	.spacer {
		width: 8px;
		cursor: default;
		pointer-events: none;
	}
	.spacer.double {
		width: 1px;
		border-left: 1px solid rgba(0, 0, 0, 0.15);
		border-right: 1px solid rgba(0, 0, 0, 0.15);
		margin: 0 5px;
		pointer-events: none;
	}
	.right {
		margin-left: auto;
	}
	.right > .right-inner {
		list-style: none;
		margin: 0;
		padding: 0 8px 0 0;
		display: flex;
	}
	.endgame .tb-btn {
		color: #b45309;
		font-weight: 600;
	}
	.voice-tb {
		color: #1e293b;
		font-weight: 500;
	}
	.voice-tb .voice-mic {
		flex-shrink: 0;
		opacity: 0.92;
	}
	.voice-tb:disabled {
		opacity: 0.55;
		cursor: wait;
	}
	.controls .right .right-inner > li:hover > .voice-tb {
		color: #fff;
	}
	.controls .right .right-inner > li:hover > .voice-tb .voice-mic {
		opacity: 1;
	}
	.voice-tb-label {
		white-space: nowrap;
	}
</style>
