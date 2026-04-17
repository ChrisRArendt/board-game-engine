<script lang="ts">
	import { game } from '$lib/stores/game';
	import { activeUserId, playerColorOverrides, playerOrder } from '$lib/stores/network';
	import { getLocalPlayerColor } from '$lib/stores/network';
	import { users } from '$lib/stores/users';
	import { settings } from '$lib/stores/settings';
	import { isHistoryReplayActive } from '$lib/stores/history';
	import { buildStashRoster, isPieceFaceHiddenFromPeers } from '$lib/engine/stash';
	import { backPngUrlFromFrontUrl, pieceSupportsFlip } from '$lib/engine/pieces';

	/** Piece to show enlarged while a hotkey is held; `null` hides the overlay. */
	export let pieceId: number | null = null;
	export let selfDisplayName = 'You';
	/** When set, replaces the default “Release P” line (e.g. assist bar toggle). */
	export let dismissHint: string | null = null;

	$: piece =
		pieceId === null ? null : ($game.pieces.find((p) => p.id === pieceId) ?? null);

	$: stashRoster = (() => {
		$settings;
		$users;
		$playerOrder;
		$playerColorOverrides;
		if (!$activeUserId) return [];
		return buildStashRoster({
			selfUserId: $activeUserId,
			selfDisplayName,
			selfColor: getLocalPlayerColor(),
			users: $users,
			playerOrder: $playerOrder,
			playerColorOverrides: $playerColorOverrides
		});
	})();

	$: viewerFaceHidden =
		piece != null &&
		$activeUserId !== '' &&
		isPieceFaceHiddenFromPeers(
			piece,
			stashRoster,
			$activeUserId,
			$isHistoryReplayActive,
			$game.playerSlots
		);

	$: bgFront =
		piece && piece.bg
			? $game.assetBaseUrl
				? `${$game.assetBaseUrl}${piece.bg}`
				: `/data/${$game.curGame}/images/${piece.bg}`
			: '';
	$: bgBack = piece && piece.bg ? backPngUrlFromFrontUrl(bgFront, piece) : bgFront;
	$: canFlip = piece ? pieceSupportsFlip(piece) : false;
	$: bg = canFlip && piece?.flipped ? bgBack : bgFront;

	/** Scale up for readability; cap size on small / large screens. */
	$: scale =
		piece != null
			? Math.min(
					480 / Math.max(1, piece.initial_size.w),
					640 / Math.max(1, piece.initial_size.h),
					2.75
				)
			: 1;
	$: w = piece ? Math.round(piece.initial_size.w * scale) : 0;
	$: h = piece ? Math.round(piece.initial_size.h * scale) : 0;
</script>

{#if pieceId !== null && piece}
	<div class="piece-peek-root" data-bge-piece-peek aria-live="polite">
		<div class="peek-inner">
			{#if viewerFaceHidden}
				<div class="img face-hidden" style:height="{h}px">
					<p class="hidden-msg">
						This piece is in another player’s private area — the face isn’t shown here either.
					</p>
				</div>
			{:else}
				<div
					class="img"
					style:width="{w}px"
					style:height="{h}px"
					style:background-image="url({bg})"
					style:background-size="100% 100%"
					style:background-repeat="no-repeat"
				></div>
			{/if}
			<p class="hint">
				{#if dismissHint}
					{dismissHint}
				{:else}
					Release <kbd>P</kbd> to close
				{/if}
			</p>
		</div>
	</div>
{/if}

<style>
	.piece-peek-root {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 50;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: 16px 16px max(16px, env(safe-area-inset-bottom));
		pointer-events: none;
	}
	.peek-inner {
		pointer-events: none;
		filter: drop-shadow(0 12px 28px rgba(0, 0, 0, 0.55));
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		max-width: calc(100vw - 32px);
	}
	.img {
		border-radius: 10px;
		box-sizing: border-box;
		border: 1px solid rgba(255, 255, 255, 0.12);
	}
	.face-hidden {
		display: flex;
		align-items: center;
		justify-content: center;
		width: min(360px, calc(100vw - 32px));
		box-sizing: border-box;
		padding: 16px;
		border-radius: 10px;
		background: repeating-linear-gradient(
			135deg,
			#2a2d3a,
			#2a2d3a 5px,
			#1e2129 5px,
			#1e2129 10px
		);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.hidden-msg {
		margin: 0;
		font-size: 14px;
		line-height: 1.45;
		color: #cbd5e1;
		text-align: center;
		max-width: 280px;
	}
	.hint {
		margin: 0;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.75);
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
	}
	kbd {
		display: inline-block;
		padding: 0.1em 0.4em;
		font-size: 0.95em;
		font-family: ui-monospace, monospace;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
	}
</style>
