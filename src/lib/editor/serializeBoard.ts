import type { EditorViewJson, GameDataJson, InitialPlayViewJson, PlayerSlotZones } from '$lib/engine/types';
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
		initial_play_view?: InitialPlayViewJson | null;
		widgets?: BoardWidget[];
		player_slots?: PlayerSlotZones[] | null;
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
			if (p.card_template_id) row.card_template_id = p.card_template_id;
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
	if (opts?.initial_play_view && opts.initial_play_view !== null) {
		out.initial_play_view = { ...opts.initial_play_view };
	}
	if (opts?.player_slots && opts.player_slots.length > 0) {
		out.player_slots = opts.player_slots.map((z) => ({
			safe: { ...z.safe },
			deal: { ...z.deal },
			score: { ...z.score }
		}));
	}
	return out;
}
