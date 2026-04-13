import type { EditorViewJson, GameDataJson } from '$lib/engine/types';
import type { BoardWidget, PieceInstance } from '$lib/engine/types';
import { widgetDataFromInstance } from '$lib/engine/boardWidgets';

/** One PieceData per instance so positions are preserved exactly. */
export function piecesToGameDataJson(
	pieces: PieceInstance[],
	table: { w: number; h: number },
	opts?: {
		table_bg?: string;
		environment_bg?: string;
		piece_color_palette?: string[];
		editor_view?: EditorViewJson;
		widgets?: BoardWidget[];
	}
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
			if (p.rotation !== undefined && p.rotation !== 0) row.rotation = p.rotation;
			if (p.hidden) row.editor_hidden = true;
			if (p.locked) row.editor_locked = true;
			return row;
		})
	};
	if (opts?.widgets?.length) {
		out.widgets = opts.widgets.map((w) => widgetDataFromInstance(w));
	}
	if (opts?.table_bg) out.table_bg = opts.table_bg;
	if (opts?.environment_bg) out.environment_bg = opts.environment_bg;
	if (opts?.piece_color_palette?.length) out.piece_color_palette = [...opts.piece_color_palette];
	if (opts?.editor_view) out.editor_view = { ...opts.editor_view };
	return out;
}
