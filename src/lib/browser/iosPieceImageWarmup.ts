import { browser } from '$app/environment';
import { backPngUrlFromFrontUrl, pieceSupportsFlip } from '$lib/engine/pieces';
import type { GameState } from '$lib/stores/game';
import { isAppleTouchWebKit } from './ios';

/** Limit work — remaining images load via CSS as pieces paint. */
const MAX_WARMUP_URLS = 96;

/**
 * Mobile WebKit can kill tabs when hundreds of piece `background-image` URLs decode at once.
 * Preload a capped set in small steps (rAF between loads) so decode/memory ramps more gently.
 */
export function scheduleAppleTouchPieceImageWarmup(state: GameState): void {
	if (!browser || !isAppleTouchWebKit() || !state.loaded) return;

	const curGame = state.curGame;
	const base = state.assetBaseUrl;
	const urls: string[] = [];
	const seen = new Set<string>();

	function push(u: string) {
		if (!u || seen.has(u)) return;
		seen.add(u);
		urls.push(u);
	}

	const table =
		base != null
			? `${base}${state.tableBgFilename}?v=${state.tableBgRev}`
			: `/data/${curGame}/images/${state.tableBgFilename}`;
	push(table);
	if (state.envBgFilename) {
		const env =
			base != null
				? `${base}${state.envBgFilename}?v=${state.envBgRev}`
				: `/data/${curGame}/images/${state.envBgFilename}`;
		push(env);
	}

	for (const p of state.pieces) {
		if (!p.bg || urls.length >= MAX_WARMUP_URLS) break;
		const front = base ? `${base}${p.bg}` : `/data/${curGame}/images/${p.bg}`;
		push(front);
		if (urls.length >= MAX_WARMUP_URLS) break;
		if (pieceSupportsFlip(p)) {
			push(backPngUrlFromFrontUrl(front, p));
		}
	}

	if (urls.length === 0) return;

	void (async () => {
		for (const url of urls) {
			await new Promise<void>((resolve) => {
				const img = new Image();
				img.onload = img.onerror = () => resolve();
				img.src = url;
			});
			await new Promise<void>((r) => requestAnimationFrame(() => r()));
		}
	})();
}
