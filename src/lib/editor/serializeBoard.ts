import type { GameDataJson } from '$lib/engine/types';
import type { PieceInstance } from '$lib/engine/types';

/** One PieceData per instance so positions are preserved exactly. */
export function piecesToGameDataJson(
	pieces: PieceInstance[],
	table: { w: number; h: number },
	opts?: { table_bg?: string; piece_color_palette?: string[] }
): GameDataJson {
	const out: GameDataJson = {
		table: { size: { ...table } },
		pieces: pieces.map((p) => {
			const row: GameDataJson['pieces'][number] = {
				class: p.classes,
				bg: p.bg,
				attributes: [...p.attributes],
				placement: { count: 1, coords: { x: p.x, y: p.y } },
				initial_size: { ...p.initial_size },
				image_size: p.image_size ? { ...p.image_size } : undefined
			};
			if (p.bg_color) row.bg_color = p.bg_color;
			return row;
		})
	};
	if (opts?.table_bg) out.table_bg = opts.table_bg;
	if (opts?.piece_color_palette?.length) out.piece_color_palette = [...opts.piece_color_palette];
	return out;
}
