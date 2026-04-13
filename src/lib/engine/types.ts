/** JSON schema from pieces.json */

export interface TableSize {
	w: number;
	h: number;
}

export interface Placement {
	coords?: { x: number; y: number };
	count?: number;
	cols?: number;
	xstep?: number;
	ystep?: number;
}

export interface PieceData {
	class: string;
	bg: string;
	attributes?: string[];
	placement?: Placement;
	initial_size: { w: number; h: number };
	image_size?: { w: number; h: number };
}

export interface GameDataJson {
	table: { size: TableSize };
	pieces: PieceData[];
	/** Filename under custom-game-assets `/{userId}/{gameId}/` for the full-table background (default `table-bg.jpg`). */
	table_bg?: string;
}

/** Runtime piece instance on the board */
export interface PieceInstance {
	id: number;
	bg: string;
	classes: string;
	attributes: string[];
	x: number;
	y: number;
	zIndex: number;
	flipped: boolean;
	initial_size: { w: number; h: number };
	image_size?: { w: number; h: number };
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
