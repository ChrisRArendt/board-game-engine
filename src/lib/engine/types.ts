/** JSON schema from pieces.json */

export interface TableSize {
	w: number;
	h: number;
}

export type PlacementLayout = 'stack' | 'grid' | 'honeycomb';

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

export interface GameDataJson {
	table: { size: TableSize };
	pieces: PieceData[];
	/** Filename under custom-game-assets `/{userId}/{gameId}/` for the full-table background (default `table-bg.jpg`). */
	table_bg?: string;
	/** Shared swatches for piece background colors in the editor (and optional quick-pick in play). */
	piece_color_palette?: string[];
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
