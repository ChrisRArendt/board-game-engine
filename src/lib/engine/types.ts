/** JSON schema from pieces.json */

import type { Rect } from '$lib/engine/geometry';

export interface TableSize {
	w: number;
	h: number;
}

export type PlacementLayout = 'stack' | 'grid' | 'honeycomb' | 'fan';

export interface Placement {
	coords?: { x: number; y: number };
	count?: number;
	cols?: number;
	xstep?: number;
	ystep?: number;
	/** Editor: how multiple instances are laid out when placing from the library. */
	layout?: PlacementLayout;
	/** Spacing between instances (px); used with layout. */
	offset?: number;
}

export interface PieceData {
	class: string;
	bg: string;
	/** When this piece is a card from the editor — used to group by template in play. */
	card_template_id?: string;
	/** Solid fill behind the image (shows through transparent PNG areas). */
	bg_color?: string;
	attributes?: string[];
	placement?: Placement;
	initial_size: { w: number; h: number };
	image_size?: { w: number; h: number };
	/** Degrees clockwise; default 0. */
	rotation?: number;
	/** Editor-only: layer hidden on canvas (still in layer list). */
	editor_hidden?: boolean;
	/** Editor-only: cannot move/resize on canvas (can still edit in list/properties). */
	editor_locked?: boolean;
}

/** Per-player areas: private hand (safe), deal pile target (deal), and score counter (play). Editor-placed; up to `PLAYER_SLOT_MAX` slots. */
export interface PlayerSlotZones {
	safe: Rect;
	deal: Rect;
	/** In play, a shared +/- score is shown in this rect (one per slot). */
	score: Rect;
}

/** Board editor only: last canvas zoom/pan (CSS px in viewport space). Not used in play. */
export interface EditorViewJson {
	zoom: number;
	pan_x: number;
	pan_y: number;
}

/**
 * Saved default play framing: a world-space rectangle (table coords) that should be fully
 * visible when the game opens. Runtime fits this rect inside the device viewport (centered, zoomed out).
 */
export interface InitialPlayViewState {
	world_rect: Rect;
}

/** Persisted in `game_data.initial_play_view`. */
export type InitialPlayViewJson = InitialPlayViewState;

export type WidgetType = 'counter' | 'label' | 'textbox' | 'dice' | 'toggle';

/** Persisted widget in game_data JSON (no runtime id — assigned on load). */
export interface WidgetData {
	type: WidgetType;
	x: number;
	y: number;
	w: number;
	h: number;
	z_index?: number;
	label?: string;
	config: Record<string, unknown>;
	default_value?: string | number | boolean;
	editor_hidden?: boolean;
	editor_locked?: boolean;
}

/** Runtime board widget (editor + play). */
export interface BoardWidget {
	id: number;
	type: WidgetType;
	x: number;
	y: number;
	w: number;
	h: number;
	zIndex: number;
	label?: string;
	config: Record<string, unknown>;
	/** Runtime value (counter/dice number, textbox string, toggle boolean). */
	value: string | number | boolean;
	hidden?: boolean;
	locked?: boolean;
}

export interface GameDataJson {
	table: { size: TableSize };
	pieces: PieceData[];
	/** Board UI widgets (counters, labels, etc.). */
	widgets?: WidgetData[];
	/** Filename under custom-game-assets `/{userId}/{gameId}/` for the full-table background (default `table-bg.jpg`). */
	table_bg?: string;
	/** Optional tiling image under the table (world space, repeats); same asset pipeline as `table_bg`. */
	environment_bg?: string;
	/** Shared swatches for piece background colors in the editor (and optional quick-pick in play). */
	piece_color_palette?: string[];
	/** Board editor: restore zoom/pan when reopening the editor. Omitted in play exports. */
	editor_view?: EditorViewJson;
	/** Default pan/zoom when a lobby loads this board in play (set from the editor). */
	initial_play_view?: InitialPlayViewJson;
	/**
	 * Optional player zones (safe = private hand, deal = cards dealt here). Up to 8 slots by default.
	 * If omitted, runtime uses legacy fixed stash grid (`stashPos`).
	 */
	player_slots?: PlayerSlotZones[];
}

/** Default palette when `piece_color_palette` is missing from game data. */
export const DEFAULT_PIECE_COLOR_PALETTE: string[] = [
	'#1e293b',
	'#334155',
	'#475569',
	'#64748b',
	'#b91c1c',
	'#c2410c',
	'#a16207',
	'#15803d',
	'#1d4ed8',
	'#6d28d9',
	'#ffffff',
	'#f1f5f9',
	'#0f172a'
];

/** Runtime piece instance on the board */
export interface PieceInstance {
	id: number;
	bg: string;
	/** Same as PieceData.card_template_id when dropped from a card in the editor. */
	card_template_id?: string;
	/** Solid fill behind `bg` image (transparent areas show this color). */
	bg_color?: string;
	classes: string;
	attributes: string[];
	x: number;
	y: number;
	zIndex: number;
	flipped: boolean;
	initial_size: { w: number; h: number };
	image_size?: { w: number; h: number };
	/** Degrees clockwise (CSS transform). */
	rotation?: number;
	/** Layer hidden on canvas in editor (still listed). */
	hidden?: boolean;
	/** Locked in editor: no move/resize from canvas. */
	locked?: boolean;
}

export interface UserEntry {
	/** Supabase user id (stable across sessions). */
	id: string;
	color: string;
	name: string;
	connected: boolean;
	/** From Realtime presence when available. */
	avatarUrl?: string | null;
}
