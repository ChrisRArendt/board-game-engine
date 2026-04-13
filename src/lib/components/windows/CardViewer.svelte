<script lang="ts">
	import { game } from '$lib/stores/game';
	import { activeUserId, playerColorOverrides, playerOrder } from '$lib/stores/network';
	import { getLocalPlayerColor } from '$lib/stores/network';
	import { users } from '$lib/stores/users';
	import { settings } from '$lib/stores/settings';
	import { isHistoryReplayActive } from '$lib/stores/history';
	import { buildStashRoster, isPieceFaceHiddenFromPeers } from '$lib/engine/stash';

	export let targetPieceId: number | null = null;
	/** Two-way: when true, board clicks do not change `targetPieceId`. */
	export let viewerLocked = false;
	export let selfDisplayName = 'You';

	$: piece =
		targetPieceId === null ? null : ($game.pieces.find((p) => p.id === targetPieceId) ?? null);

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

	$: bg =
		piece && piece.bg
			? $game.assetBaseUrl
				? `${$game.assetBaseUrl}${piece.bg}`
				: `/data/${$game.curGame}/images/${piece.bg}`
			: '';
	$: w = piece ? piece.initial_size.w * 2 : 0;
	$: h = piece ? piece.initial_size.h * 2 : 0;
</script>

<div class="card-viewer">
	<div class="controls">
		<label class="lock-label" title="When off, clicking a piece updates this preview. When on, the preview stays on this piece.">
			<input type="checkbox" bind:checked={viewerLocked} />
			<span class="lock-text">Lock preview to this piece</span>
		</label>
		{#if !viewerLocked && piece}
			<p class="hint follow">Click another piece on the board to preview it here.</p>
		{:else if viewerLocked && piece}
			<p class="hint locked">Locked — unlock to follow clicks again.</p>
		{/if}
	</div>

	<div class="viewer" style:width="{w}px" style:min-height="{h}px">
		{#if piece && viewerFaceHidden}
			<div class="img face-hidden-viewer" style:height="{h}px">
				<p class="hidden-msg">
					This piece is in another player’s private area — the face isn’t shown to you here either.
				</p>
			</div>
		{:else if piece}
			<div
				class="img"
				style:width="100%"
				style:height="{h}px"
				style:background-image="url({bg})"
				style:background-size={piece.attributes.includes('flip') ? 'auto 100%' : '100% 100%'}
				style:background-position={piece.attributes.includes('flip')
					? piece.flipped
						? '0 0'
						: '100% 0'
					: '0 0'}
				style:background-repeat="no-repeat"
			></div>
		{:else}
			<p class="empty">
				Select a piece on the board, then click <strong>Viewer</strong> in the toolbar, or double‑click a piece. With
				the viewer open, click pieces to switch the preview unless <strong>Lock preview</strong> is on.
				Only you see this window.
			</p>
		{/if}
	</div>
</div>

<style>
	.card-viewer {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 150px;
	}
	.controls {
		padding: 0 2px 4px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}
	.lock-label {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		cursor: pointer;
		font-size: 13px;
		color: #333;
		user-select: none;
	}
	.lock-label input {
		margin-top: 2px;
		cursor: pointer;
	}
	.lock-text {
		line-height: 1.3;
	}
	.hint {
		margin: 6px 0 0;
		font-size: 12px;
		line-height: 1.35;
	}
	.hint.follow {
		color: #2563eb;
	}
	.hint.locked {
		color: #b45309;
	}
	.viewer {
		min-width: 150px;
	}
	.img {
		background-repeat: no-repeat;
	}
	.face-hidden-viewer {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		padding: 12px;
		min-height: 80px;
		border-radius: 8px;
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
		font-size: 13px;
		line-height: 1.4;
		color: #cbd5e1;
		text-align: center;
		max-width: 260px;
	}
	.empty {
		padding: 8px;
		color: #888;
		font-size: 13px;
		line-height: 1.35;
		max-width: 280px;
	}
</style>
