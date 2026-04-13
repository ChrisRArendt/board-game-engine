import type { GameDataJson } from '$lib/engine/types';
import { DEFAULT_PIECE_COLOR_PALETTE } from '$lib/engine/types';

export function parseGameDataJson(raw: unknown): GameDataJson {
	if (raw && typeof raw === 'object' && raw !== null && 'table' in raw) return raw as GameDataJson;
	return { table: { size: { w: 3000, h: 3000 } }, pieces: [] };
}

export function getPieceColorPaletteFromGameData(raw: unknown): string[] {
	const gd = parseGameDataJson(raw);
	return gd.piece_color_palette?.length
		? [...gd.piece_color_palette]
		: [...DEFAULT_PIECE_COLOR_PALETTE];
}

/** Drop `pieces` rows whose `bg` is the rendered path for this card instance (`cards/{id}.png`). */
export function removeBoardPiecesForCard(gd: GameDataJson, cardId: string): GameDataJson {
	const bg = `cards/${cardId}.png`;
	return {
		...gd,
		pieces: gd.pieces.filter((p) => p.bg !== bg)
	};
}
