import { derived, get, writable } from 'svelte/store';

/** Set from +page.svelte to avoid circular imports with the network store. */
let emitGame: ((type: string, data: Record<string, unknown>) => void) | null = null;

export function registerGameEmit(fn: (type: string, data: Record<string, unknown>) => void) {
	emitGame = fn;
}
import type {
	BoardWidget,
	EditorViewJson,
	GameDataJson,
	InitialPlayViewState,
	PieceData,
	PieceInstance,
	PlacementLayout,
	PlayerSlotZones,
	WidgetData
} from '$lib/engine/types';
import { boardWidgetFromData } from '$lib/engine/boardWidgets';
import { DEFAULT_PIECE_COLOR_PALETTE } from '$lib/engine/types';
import {
	arrangeFanned,
	arrangeStacked,
	bringDraggingToFront,
	hasAttr,
	maxZIndex,
	pieceFromData,
	pieceSupportsFlip,
	shuffleMovableSelectedPieces,
	shuffleSelectedPieces,
	spreadCustom,
	sortMovableSelectedByTemplateSlots,
	spreadHorizontal,
	spreadVertical
} from '$lib/engine/pieces';
import {
	clampZoom,
	getViewportSize,
	legacyZoomLevelToZoom,
	panZoomToFitWorldRect,
	type ViewportFitInset,
	visibleWorldRect,
	type Rect,
	ZOOM_DEFAULT
} from '$lib/engine/geometry';
import {
	buildBoardSnapTargets,
	mergeGuides,
	snapBoardPiecePosition,
	type BoardSnapGuides,
	EMPTY_BOARD_GUIDES
} from '$lib/editor/boardSnapGeometry';
import {
	dealRectForRosterIndex,
	parsePlayerSlotsFromJson,
	PLAYER_SLOT_MAX
} from '$lib/engine/stash';
import {
	computePlacementPositions,
	type PlacementSpacingMode
} from '$lib/editor/placementLayouts';

export interface GameState {
	curGame: string;
	/** When set, piece images load from this base (trailing slash). Otherwise `/data/{curGame}/images/`. */
	assetBaseUrl: string | null;
	/** Custom games: `table-bg.jpg` etc. under asset base. Bumped after upload to bust browser cache. */
	tableBgFilename: string;
	tableBgRev: number;
	/** Repeating world-space background under the table; empty string = none. */
	envBgFilename: string;
	envBgRev: number;
	table: { w: number; h: number };
	/** Swatches for piece background color (saved in game_data.piece_color_palette). */
	pieceColorPalette: string[];
	pieces: PieceInstance[];
	/** Board UI widgets (counters, labels, …). */
	widgets: BoardWidget[];
	selectedIds: Set<number>;
	selectedWidgetIds: Set<number>;
	/** other users' selection highlights */
	remoteSelection: Record<number, string>;
	/** Continuous zoom scale (world units per CSS px in the scaled layer). */
	zoom: number;
	panX: number;
	panY: number;
	cameraX: number;
	cameraY: number;
	nextPieceId: number;
	nextWidgetId: number;
	shiftDown: boolean;
	selectionBox: null | { x: number; y: number; w: number; h: number };
	/** Mousedown point for marquee; must stay fixed (selectionBox x/y are the normalized rect top-left). */
	selectBoxAnchor: { x: number; y: number } | null;
	selectingBox: boolean;
	selectBoxStartItems: Set<number>;
	selectBoxStartWidgetItems: Set<number>;
	handscroll: boolean;
	/** Space held (not typing): temporary pan mode with grab cursor */
	spacePanHeld: boolean;
	panPointerStart: { x: number; y: number; panX: number; panY: number } | null;
	moveDrag:
		| null
		| {
				/** Pointer position in viewport coords when drag began */
				dragStartClientX: number;
				dragStartClientY: number;
				/** Pan when drag began — needed so world = (client − pan) / z stays correct when panned */
				dragStartPanX: number;
				dragStartPanY: number;
				elStarts: Map<number, { x: number; y: number }>;
				/** Present when any widgets participate in this drag (may be empty). */
				widgetStarts: Map<number, { x: number; y: number }>;
		  };
	zSorted: boolean;
	edgePan: { x: number; y: number };
	loaded: boolean;
	/** Board editor: alignment snap while dragging pieces. */
	editorSnapEnabled: boolean;
	editorSnapThreshold: number;
	editorSnapGuides: BoardSnapGuides | null;
	/** Board editor: snap positions to grid when dragging. */
	editorSnapToGrid: boolean;
	editorGridSize: number;
	/** Custom safe/deal rects per roster slot; null uses legacy `stashPos` grid. */
	playerSlots: PlayerSlotZones[] | null;
	/** Per slot index (0 … PLAYER_SLOT_MAX-1); synced in play. */
	playerSlotScores: number[];
	/** Last board viewport (CSS px) — used when capturing initial play view in the editor. */
	boardViewportForCapture: { w: number; h: number } | null;
	/** Saved world rect to fit on play load; null = engine default on first load. */
	initialPlayView: InitialPlayViewState | null;
	/** True while staggered “apply arrangement” animation is running (smooth motion + flip transition). */
	arrangementAnimationActive: boolean;
}

function initialState(): GameState {
	const vp = typeof window !== 'undefined' ? getViewportSize() : { w: 1200, h: 800 };
	return {
		curGame: 'bsg_1',
		assetBaseUrl: null,
		tableBgFilename: 'table-bg.jpg',
		tableBgRev: 0,
		envBgFilename: '',
		envBgRev: 0,
		table: { w: 3000, h: 3000 },
		pieceColorPalette: [...DEFAULT_PIECE_COLOR_PALETTE],
		pieces: [],
		widgets: [],
		selectedIds: new Set(),
		selectedWidgetIds: new Set(),
		remoteSelection: {},
		zoom: ZOOM_DEFAULT,
		panX: 0,
		panY: 0,
		cameraX: vp.w / 2,
		cameraY: vp.h / 2,
		nextPieceId: 0,
		nextWidgetId: 0,
		shiftDown: false,
		selectionBox: null,
		selectBoxAnchor: null,
		selectingBox: false,
		selectBoxStartItems: new Set(),
		selectBoxStartWidgetItems: new Set(),
		handscroll: false,
		spacePanHeld: false,
		panPointerStart: null,
		moveDrag: null,
		zSorted: false,
		edgePan: { x: 0, y: 0 },
		loaded: false,
		editorSnapEnabled: false,
		editorSnapThreshold: 8,
		editorSnapGuides: null,
		editorSnapToGrid: false,
		editorGridSize: 20,
		playerSlots: null,
		playerSlotScores: Array.from({ length: PLAYER_SLOT_MAX }, () => 0),
		boardViewportForCapture: null,
		initialPlayView: null,
		arrangementAnimationActive: false
	};
}

export const game = writable<GameState>(initialState());

/** Stagger between each piece starting its move; total spread is (n−1)×stagger + moveMs. */
export const ARRANGEMENT_ANIM_STAGGER_MS = 5;
export const ARRANGEMENT_ANIM_MOVE_MS = 250;

let arrangementAnimGeneration = 0;
const arrangementStaggerTimeouts: ReturnType<typeof setTimeout>[] = [];
let arrangementDoneTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingArrangeResolve: ((v: boolean) => void) | null = null;

function clearArrangementAnimationTimeouts() {
	for (const t of arrangementStaggerTimeouts) clearTimeout(t);
	arrangementStaggerTimeouts.length = 0;
	if (arrangementDoneTimeout) {
		clearTimeout(arrangementDoneTimeout);
		arrangementDoneTimeout = null;
	}
	if (pendingArrangeResolve) {
		pendingArrangeResolve(false);
		pendingArrangeResolve = null;
	}
}

/** Clear board state (e.g. leaving board editor). */
export function resetGameToEmpty() {
	clearArrangementAnimationTimeouts();
	arrangementAnimGeneration++;
	game.set(initialState());
}

export const selectedPieces = derived(game, ($g) => $g.pieces.filter((p) => $g.selectedIds.has(p.id)));

/** Stable viewport for migrating old `initial_play_view` { zoom, pan_* } saves. */
const LEGACY_INITIAL_PLAY_VIEWPORT = { w: 1920, h: 1080 };

function isValidWorldRect(o: unknown): o is Rect {
	if (!o || typeof o !== 'object') return false;
	const r = o as Record<string, unknown>;
	return (
		[r.x, r.y, r.w, r.h].every((n) => typeof n === 'number' && Number.isFinite(n as number)) &&
		(r.w as number) > 0 &&
		(r.h as number) > 0
	);
}

export function parseInitialPlayViewJson(raw: unknown): InitialPlayViewState | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	if (isValidWorldRect(o.world_rect)) {
		const wr = o.world_rect as Rect;
		return {
			world_rect: { x: wr.x, y: wr.y, w: wr.w, h: wr.h }
		};
	}
	/** Legacy: pan/zoom — convert to world rect using a fixed reference viewport. */
	if (
		typeof o.zoom === 'number' &&
		Number.isFinite(o.zoom) &&
		typeof o.pan_x === 'number' &&
		Number.isFinite(o.pan_x) &&
		typeof o.pan_y === 'number' &&
		Number.isFinite(o.pan_y)
	) {
		const z = clampZoom(o.zoom);
		const r = visibleWorldRect(
			o.pan_x,
			o.pan_y,
			z,
			LEGACY_INITIAL_PLAY_VIEWPORT.w,
			LEGACY_INITIAL_PLAY_VIEWPORT.h
		);
		return { world_rect: { x: r.x, y: r.y, w: r.w, h: r.h } };
	}
	return null;
}

/** Report board viewport size (editor canvas) so “Save initial play view” matches the visible frame. */
export function setBoardViewportForCapture(w: number, h: number) {
	if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return;
	game.update((s) => ({ ...s, boardViewportForCapture: { w, h } }));
}

/** Snapshot the current visible world rectangle as the default play framing. */
export function captureInitialPlayView() {
	game.update((s) => {
		const vp = s.boardViewportForCapture ?? getViewportSize();
		const r = visibleWorldRect(s.panX, s.panY, s.zoom, vp.w, vp.h);
		return {
			...s,
			initialPlayView: {
				world_rect: { x: r.x, y: r.y, w: r.w, h: r.h }
			}
		};
	});
}

/** Fit pan/zoom so the saved world rect is visible in the given viewport (play load / resize). */
export function applyInitialPlayViewToViewport(
	viewportW: number,
	viewportH: number,
	opts?: { inset?: ViewportFitInset }
) {
	const s = get(game);
	if (!s.initialPlayView) return;
	if (viewportW < 8 || viewportH < 8) return;
	const { panX, panY, zoom } = panZoomToFitWorldRect(s.initialPlayView.world_rect, viewportW, viewportH, opts);
	game.update((g) => ({ ...g, panX, panY, zoom }));
}

export function clearInitialPlayView() {
	game.update((s) => ({ ...s, initialPlayView: null }));
}

export function loadGameData(
	json: GameDataJson,
	opts?: {
		curGame?: string;
		assetBaseUrl?: string | null;
		stripEditorOnly?: boolean;
		/** Board editor: ensure every piece can be selected and moved (legacy JSON often omits attributes). */
		ensureEditorPieceAttrs?: boolean;
	}
) {
	const curGame = opts?.curGame ?? 'bsg_1';
	const assetBaseUrl = opts?.assetBaseUrl !== undefined ? opts.assetBaseUrl : null;
	game.update((s) => {
		const pieces: PieceInstance[] = [];
		let nextId = 0;

		for (const piecedata of json.pieces) {
			const placement = piecedata.placement ?? {};
			const count = placement.count ?? 1;
			const xstep = placement.xstep ?? 30;
			const ystep = placement.ystep ?? 30;
			const cols = placement.cols ?? 10;

			for (let ci = 0; ci < count; ci++) {
				const rownum = Math.floor(ci / cols);
				const offset = {
					x: xstep * (ci % cols),
					y: ystep * rownum
				};
				const p = pieceFromData(piecedata as PieceData, nextId++, curGame, offset);
				pieces.push(p);
			}
		}

		const stripPieces = opts?.stripEditorOnly === true;
		if (stripPieces) {
			for (let i = 0; i < pieces.length; i++) {
				const p = pieces[i];
				pieces[i] = { ...p, hidden: undefined, locked: undefined };
			}
		}

		if (opts?.ensureEditorPieceAttrs) {
			for (let i = 0; i < pieces.length; i++) {
				const p = pieces[i];
				const attrs = new Set([...p.attributes, 'select', 'move']);
				pieces[i] = { ...p, attributes: [...attrs] };
			}
		}

		const widgets: BoardWidget[] = [];
		let nextWid = 0;
		const rawWidgets = json.widgets;
		if (Array.isArray(rawWidgets)) {
			for (const row of rawWidgets) {
				if (!row || typeof row !== 'object') continue;
				const wd = row as WidgetData;
				if (!wd.type || typeof wd.x !== 'number' || typeof wd.y !== 'number') continue;
				widgets.push(boardWidgetFromData(wd, nextWid++, { stripEditorOnly: opts?.stripEditorOnly }));
			}
		}

		const vp = getViewportSize();
		const tableBgFilename = json.table_bg?.trim() || 'table-bg.jpg';
		const envBgFilename = json.environment_bg?.trim() || '';
		const pieceColorPalette =
			json.piece_color_palette && json.piece_color_palette.length > 0
				? [...json.piece_color_palette]
				: [...DEFAULT_PIECE_COLOR_PALETTE];
		const strip = opts?.stripEditorOnly === true;
		const useEditorView = !strip;
		const ev = json.editor_view;
		const ipv = parseInitialPlayViewJson(json.initial_play_view);
		let zoom = ZOOM_DEFAULT;
		let panX = 0;
		let panY = 0;
		if (useEditorView && ev && typeof ev === 'object') {
			if (typeof ev.zoom === 'number' && Number.isFinite(ev.zoom)) {
				zoom = clampZoom(ev.zoom);
			}
			if (typeof ev.pan_x === 'number' && Number.isFinite(ev.pan_x)) {
				panX = ev.pan_x;
			}
			if (typeof ev.pan_y === 'number' && Number.isFinite(ev.pan_y)) {
				panY = ev.pan_y;
			}
		} else if (strip && ipv) {
			const fit = panZoomToFitWorldRect(ipv.world_rect, vp.w, vp.h);
			zoom = fit.zoom;
			panX = fit.panX;
			panY = fit.panY;
		}
		return {
			...s,
			curGame,
			assetBaseUrl,
			tableBgFilename,
			tableBgRev: 0,
			envBgFilename,
			envBgRev: 0,
			table: { w: json.table.size.w, h: json.table.size.h },
			pieceColorPalette,
			pieces,
			widgets,
			nextPieceId: nextId,
			nextWidgetId: nextWid,
			selectedIds: new Set(),
			selectedWidgetIds: new Set(),
			remoteSelection: {},
			cameraX: vp.w / 2,
			cameraY: vp.h / 2,
			panX,
			panY,
			zoom,
			loaded: true,
			spacePanHeld: false,
			panPointerStart: null,
			handscroll: false,
			editorSnapEnabled: false,
			editorSnapThreshold: 8,
			editorSnapGuides: null,
			editorSnapToGrid: false,
			editorGridSize: 20,
			playerSlots: parsePlayerSlotsFromJson(json.player_slots) ?? null,
			playerSlotScores: Array.from({ length: PLAYER_SLOT_MAX }, () => 0),
			boardViewportForCapture: null,
			initialPlayView: ipv
		};
	});
}

export function setPlayerSlots(slots: PlayerSlotZones[] | null) {
	game.update((s) => ({
		...s,
		playerSlots: slots
			? slots.map((z) => ({
					safe: { ...z.safe },
					deal: { ...z.deal },
					score: { ...z.score }
				}))
			: null
	}));
}

let zoomAnimRaf: number | null = null;
let panInertiaRaf: number | null = null;

const EASE_OUT_CUBIC = (t: number) => 1 - Math.pow(1 - t, 3);
const ZOOM_ANIM_MS = 200;
const INERTIA_FRICTION = 0.92;
const INERTIA_MIN_V = 0.5;

function cancelZoomAnimation() {
	if (zoomAnimRaf !== null && typeof cancelAnimationFrame !== 'undefined') {
		cancelAnimationFrame(zoomAnimRaf);
		zoomAnimRaf = null;
	}
}

export function cancelPanInertia() {
	if (panInertiaRaf !== null && typeof cancelAnimationFrame !== 'undefined') {
		cancelAnimationFrame(panInertiaRaf);
		panInertiaRaf = null;
	}
}

export function setPan(x: number, y: number) {
	cancelPanInertia();
	game.update((s) => ({ ...s, panX: x, panY: y }));
}

/** @deprecated legacy -1/0/1 discrete levels — prefer setZoom / setZoomAtFocal */
export function setZoomLevel(level: number) {
	setZoom(legacyZoomLevelToZoom(level));
}

export function setZoom(z: number) {
	cancelZoomAnimation();
	game.update((s) => ({ ...s, zoom: clampZoom(z) }));
	centerCamToVP();
}

/** Focal point in viewport client coordinates (clientX / clientY). */
export function setZoomAtFocal(newZoom: number, focalClientX: number, focalClientY: number) {
	cancelZoomAnimation();
	cancelPanInertia();
	game.update((s) => {
		const z0 = s.zoom;
		const z1 = clampZoom(newZoom);
		const wx = (focalClientX - s.panX) / z0;
		const wy = (focalClientY - s.panY) / z0;
		return {
			...s,
			zoom: z1,
			panX: focalClientX - wx * z1,
			panY: focalClientY - wy * z1
		};
	});
	centerCamToVP();
}

/**
 * Pinch zoom: keep the world point that was under the pinch-start midpoint aligned with the current midpoint.
 */
export function setPinchZoomAtMid(
	newZoom: number,
	midClientX: number,
	midClientY: number,
	pinchStart: { zoom: number; panX: number; panY: number; midX: number; midY: number }
) {
	cancelZoomAnimation();
	cancelPanInertia();
	const z1 = clampZoom(newZoom);
	game.update((s) => {
		const z0 = pinchStart.zoom;
		const wx = (pinchStart.midX - pinchStart.panX) / z0;
		const wy = (pinchStart.midY - pinchStart.panY) / z0;
		return {
			...s,
			zoom: z1,
			panX: midClientX - wx * z1,
			panY: midClientY - wy * z1
		};
	});
	centerCamToVP();
}

export function animateZoomTo(
	targetZoom: number,
	focalClient: { x: number; y: number },
	durationMs: number
) {
	cancelZoomAnimation();
	const start = get(game);
	const z0 = start.zoom;
	const panX0 = start.panX;
	const panY0 = start.panY;
	const fx = focalClient.x;
	const fy = focalClient.y;
	const wx = (fx - panX0) / z0;
	const wy = (fy - panY0) / z0;
	const z1 = clampZoom(targetZoom);
	const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

	function frame(now: number) {
		const t = Math.min(1, (now - t0) / durationMs);
		const eased = EASE_OUT_CUBIC(t);
		const z = z0 + (z1 - z0) * eased;
		const panX = fx - wx * z;
		const panY = fy - wy * z;
		game.update((s) => ({ ...s, zoom: z, panX, panY }));
		centerCamToVP();
		if (t < 1) {
			zoomAnimRaf = requestAnimationFrame(frame);
		} else {
			zoomAnimRaf = null;
			game.update((s) => ({ ...s, zoom: z1, panX: fx - wx * z1, panY: fy - wy * z1 }));
			centerCamToVP();
		}
	}
	zoomAnimRaf = requestAnimationFrame(frame);
}

/** Toolbar / keyboard: step zoom with animation. */
export function adjustZoomByStep(
	direction: -1 | 1,
	focalClient: { x: number; y: number },
	opts?: { animate?: boolean }
) {
	const s = get(game);
	const factor = direction < 0 ? 0.8 : 1.25;
	const target = clampZoom(s.zoom * factor);
	if (opts?.animate === false) {
		setZoomAtFocal(target, focalClient.x, focalClient.y);
		return;
	}
	animateZoomTo(target, focalClient, ZOOM_ANIM_MS);
}

/** Legacy API: focalDoc was document offset; map to viewport center for compatibility. */
export function adjustZoom(delta: number, focalDoc: { left: number; top: number }) {
	const vp = getViewportSize();
	adjustZoomByStep(delta < 0 ? -1 : 1, { x: vp.w / 2, y: vp.h / 2 });
}

/** Scroll wheel: smooth multiplicative zoom toward cursor. */
export function adjustZoomWheel(deltaY: number, focalClient: { x: number; y: number }) {
	const s = get(game);
	const factor = deltaY > 0 ? 0.94 : 1.06;
	setZoomAtFocal(clampZoom(s.zoom * factor), focalClient.x, focalClient.y);
}

export function resetZoomAtFocal(focalClient: { x: number; y: number }) {
	animateZoomTo(ZOOM_DEFAULT, focalClient, ZOOM_ANIM_MS);
}

export function startPanInertia(vx: number, vy: number) {
	if (typeof window === 'undefined') return;
	cancelPanInertia();
	let vxr = vx;
	let vyr = vy;
	function frame() {
		applyPanDeltaRaw(vxr * 16, vyr * 16);
		vxr *= INERTIA_FRICTION;
		vyr *= INERTIA_FRICTION;
		if (Math.abs(vxr) < INERTIA_MIN_V && Math.abs(vyr) < INERTIA_MIN_V) {
			panInertiaRaf = null;
			return;
		}
		panInertiaRaf = requestAnimationFrame(frame);
	}
	panInertiaRaf = requestAnimationFrame(frame);
}

export function resetPan() {
	cancelPanInertia();
	game.update((s) => ({ ...s, panX: 0, panY: 0 }));
	centerCamToVP();
}

export function setShiftDown(v: boolean) {
	game.update((s) => ({ ...s, shiftDown: v }));
}

export function centerCamToVP() {
	game.update((s) => {
		const vp = getViewportSize();
		const z = s.zoom;
		const target = {
			x: (vp.w / 2 - s.panX) * (1 / z),
			y: (vp.h / 2 - s.panY) * (1 / z)
		};
		return { ...s, cameraX: target.x, cameraY: target.y };
	});
}

function applyPanDeltaRaw(dx: number, dy: number) {
	game.update((s) => ({ ...s, panX: s.panX + dx, panY: s.panY + dy }));
	centerCamToVP();
}

export function applyPanDelta(dx: number, dy: number) {
	cancelPanInertia();
	applyPanDeltaRaw(dx, dy);
}

export function selectPiece(id: number) {
	game.update((s) => {
		const p = s.pieces.find((x) => x.id === id);
		if (!p || !hasAttr(p, 'select')) return s;
		const selectedIds = new Set(s.selectedIds);
		selectedIds.add(id);
		return { ...s, selectedIds, selectedWidgetIds: new Set() };
	});
}

export function deselectPiece(id: number) {
	game.update((s) => {
		const selectedIds = new Set(s.selectedIds);
		if (selectedIds.has(id)) emitGame?.('piece_deselect', { id });
		selectedIds.delete(id);
		return { ...s, selectedIds };
	});
}

export function deselectAll() {
	game.update((s) => {
		for (const id of s.selectedIds) {
			emitGame?.('piece_deselect', { id });
		}
		return { ...s, selectedIds: new Set(), selectedWidgetIds: new Set() };
	});
}

export function setPieceColorPalette(colors: string[]) {
	game.update((s) => ({ ...s, pieceColorPalette: [...colors] }));
}

export function toggleSelect(id: number) {
	game.update((s) => {
		const p = s.pieces.find((x) => x.id === id);
		if (!p || !hasAttr(p, 'select')) return s;
		const selectedIds = new Set(s.selectedIds);
		if (selectedIds.has(id)) selectedIds.delete(id);
		else selectedIds.add(id);
		return { ...s, selectedIds, selectedWidgetIds: new Set() };
	});
}

export function clickSelect(id: number, shift: boolean) {
	game.update((s) => {
		const p = s.pieces.find((x) => x.id === id);
		if (!p || !hasAttr(p, 'select')) return s;
		const selectedIds = new Set(s.selectedIds);
		if (shift) {
			if (selectedIds.has(id)) {
				selectedIds.delete(id);
				emitGame?.('piece_deselect', { id });
			} else {
				selectedIds.add(id);
				emitGame?.('piece_select', { id });
			}
			return { ...s, selectedIds };
		}
		if (!selectedIds.has(id)) {
			for (const oid of selectedIds) {
				emitGame?.('piece_deselect', { id: oid });
			}
			selectedIds.clear();
			selectedIds.add(id);
			emitGame?.('piece_select', { id });
			return { ...s, selectedIds, selectedWidgetIds: new Set() };
		}
		return { ...s };
	});
}

export function flipPiece(id: number) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (p.id === id && pieceSupportsFlip(p) ? { ...p, flipped: !p.flipped } : p))
	}));
	const p = getPieceById(id);
	if (p && pieceSupportsFlip(p)) {
		emitGame?.('piece_flip', { id, isFlipped: p.flipped });
	}
}

export function setPieceFlipped(id: number, flipped: boolean) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (p.id === id && pieceSupportsFlip(p) ? { ...p, flipped } : p))
	}));
}

export function movePieceTo(id: number, x: number, y: number) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (p.id === id ? { ...p, x, y } : p))
	}));
}

/** Replace a piece wholesale (board editor). */
export function replacePieceInstance(p: PieceInstance) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((x) => (x.id === p.id ? p : x))
	}));
}

/** Append a new piece (board editor). */
export function addPieceInstance(p: PieceInstance) {
	game.update((s) => {
		const nextId = Math.max(s.nextPieceId, p.id + 1);
		const sel = new Set(s.selectedIds);
		sel.add(p.id);
		return {
			...s,
			pieces: [...s.pieces, p],
			nextPieceId: nextId,
			selectedIds: sel,
			selectedWidgetIds: new Set()
		};
	});
}

export function updatePiecesZ(updates: Map<number, number>) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (updates.has(p.id) ? { ...p, zIndex: updates.get(p.id)! } : p))
	}));
}

export function duplicatePiece(id: number): number | null {
	let newId: number | null = null;
	game.update((s) => {
		const p = s.pieces.find((x) => x.id === id);
		if (!p || !hasAttr(p, 'duplicate')) return s;
		const nid = s.nextPieceId;
		const attrsNew = p.attributes.filter((a) => a !== 'duplicate');
		attrsNew.push('destroy');
		const np: PieceInstance = {
			...p,
			id: nid,
			attributes: attrsNew,
			x: p.x,
			y: p.y,
			zIndex: nid
		};
		newId = nid;
		return {
			...s,
			pieces: [...s.pieces, np],
			nextPieceId: s.nextPieceId + 1
		};
	});
	return newId;
}

const EDITOR_DUPLICATE_OFFSET = 24;

/** Board editor: clone a piece (no duplicate/destroy attrs required). Selects the new instance. */
export function duplicatePieceForEditor(id: number): number | null {
	let newId: number | null = null;
	game.update((s) => {
		const p = s.pieces.find((x) => x.id === id);
		if (!p) return s;
		const nid = s.nextPieceId;
		const z = maxZIndex(s.pieces) + 1;
		const np: PieceInstance = {
			...p,
			id: nid,
			x: p.x + EDITOR_DUPLICATE_OFFSET,
			y: p.y + EDITOR_DUPLICATE_OFFSET,
			zIndex: z
		};
		newId = nid;
		return {
			...s,
			pieces: [...s.pieces, np],
			nextPieceId: s.nextPieceId + 1,
			selectedIds: new Set([nid]),
			selectedWidgetIds: new Set()
		};
	});
	return newId;
}

/** Board editor: duplicate all selected pieces in one pass; selects the new instances. */
export function duplicateSelectedForEditor(): void {
	game.update((s) => {
		const ids = [...s.selectedIds].sort((a, b) => a - b);
		if (ids.length === 0) return s;
		let nextId = s.nextPieceId;
		const newPieces = [...s.pieces];
		const newIds: number[] = [];
		let z = maxZIndex(s.pieces);
		for (const id of ids) {
			const p = newPieces.find((x) => x.id === id);
			if (!p) continue;
			z += 1;
			const nid = nextId++;
			newPieces.push({
				...p,
				id: nid,
				x: p.x + EDITOR_DUPLICATE_OFFSET,
				y: p.y + EDITOR_DUPLICATE_OFFSET,
				zIndex: z
			});
			newIds.push(nid);
		}
		if (newIds.length === 0) return s;
		return {
			...s,
			pieces: newPieces,
			nextPieceId: nextId,
			selectedIds: new Set(newIds),
			selectedWidgetIds: new Set()
		};
	});
}

/** Board editor: duplicate all selected widgets in one pass; selects the new instances. */
export function duplicateSelectedWidgetsForEditor(): void {
	game.update((s) => {
		const ids = [...s.selectedWidgetIds].sort((a, b) => a - b);
		if (ids.length === 0) return s;
		let nextId = s.nextWidgetId;
		const newWidgets = [...s.widgets];
		const newIds: number[] = [];
		let z = maxZIndex(s.pieces);
		for (const x of s.widgets) z = Math.max(z, x.zIndex);
		for (const id of ids) {
			const w = newWidgets.find((x) => x.id === id);
			if (!w) continue;
			z += 1;
			const nid = nextId++;
			newWidgets.push({
				...w,
				id: nid,
				x: w.x + EDITOR_DUPLICATE_OFFSET,
				y: w.y + EDITOR_DUPLICATE_OFFSET,
				zIndex: z,
				config: { ...w.config }
			});
			newIds.push(nid);
		}
		if (newIds.length === 0) return s;
		return {
			...s,
			widgets: newWidgets,
			nextWidgetId: nextId,
			selectedWidgetIds: new Set(newIds),
			selectedIds: new Set()
		};
	});
}

/** Duplicate all selected pieces and widgets in one pass; selects the new instances. */
export function duplicateSelectionForEditor(): void {
	game.update((s) => {
		const pieceIds = [...s.selectedIds].sort((a, b) => a - b);
		const widgetIds = [...s.selectedWidgetIds].sort((a, b) => a - b);
		if (pieceIds.length === 0 && widgetIds.length === 0) return s;
		let nextPieceId = s.nextPieceId;
		let nextWidgetId = s.nextWidgetId;
		let pieces = [...s.pieces];
		let widgets = [...s.widgets];
		let z = maxZIndex(pieces);
		for (const x of widgets) z = Math.max(z, x.zIndex);
		const newPieceIds: number[] = [];
		const newWidgetIds: number[] = [];
		for (const id of pieceIds) {
			const p = pieces.find((x) => x.id === id);
			if (!p) continue;
			z += 1;
			const nid = nextPieceId++;
			pieces.push({
				...p,
				id: nid,
				x: p.x + EDITOR_DUPLICATE_OFFSET,
				y: p.y + EDITOR_DUPLICATE_OFFSET,
				zIndex: z
			});
			newPieceIds.push(nid);
		}
		for (const id of widgetIds) {
			const w = widgets.find((x) => x.id === id);
			if (!w) continue;
			z += 1;
			const nid = nextWidgetId++;
			widgets.push({
				...w,
				id: nid,
				x: w.x + EDITOR_DUPLICATE_OFFSET,
				y: w.y + EDITOR_DUPLICATE_OFFSET,
				zIndex: z,
				config: { ...w.config }
			});
			newWidgetIds.push(nid);
		}
		return {
			...s,
			pieces,
			widgets,
			nextPieceId,
			nextWidgetId,
			selectedIds: new Set(newPieceIds),
			selectedWidgetIds: new Set(newWidgetIds)
		};
	});
}

export function destroyPiece(id: number) {
	game.update((s) => {
		const p = s.pieces.find((x) => x.id === id);
		if (!p || !hasAttr(p, 'destroy')) return s;
		const selectedIds = new Set(s.selectedIds);
		selectedIds.delete(id);
		return {
			...s,
			pieces: s.pieces.filter((x) => x.id !== id),
			selectedIds
		};
	});
	emitGame?.('piece_destroy', { id });
}

export function runShuffleSelected() {
	game.update((s) => {
		const u = shuffleSelectedPieces(s.pieces, s.selectedIds);
		let pieces = s.pieces.map((p) => {
			const upd = u.get(p.id);
			return upd ? { ...p, zIndex: upd.z, x: upd.x, y: upd.y } : p;
		});
		return { ...s, pieces };
	});
	const s = get(game);
	for (const id of s.selectedIds) {
		const p = s.pieces.find((x) => x.id === id);
		if (p)
			emitGame?.('piece_shuffle', { id: p.id, zindex: p.zIndex, x: p.x, y: p.y });
	}
}

/** Context menu: permute positions among movable unlocked selection (2+). */
export function runShuffleMovableSelection() {
	let movedIds: number[] = [];
	game.update((s) => {
		const u = shuffleMovableSelectedPieces(s.pieces, s.selectedIds);
		movedIds = [...u.keys()];
		const pieces = s.pieces.map((p) => {
			const upd = u.get(p.id);
			return upd ? { ...p, zIndex: upd.z, x: upd.x, y: upd.y } : p;
		});
		return { ...s, pieces };
	});
	const s = get(game);
	for (const id of movedIds) {
		const p = s.pieces.find((x) => x.id === id);
		if (p)
			emitGame?.('piece_shuffle', { id: p.id, zindex: p.zIndex, x: p.x, y: p.y });
	}
}

/**
 * Context menu: permute which piece sits where like Shuffle, but order pieces by type
 * (template) into spatially ordered slots — same positions overall, types sorted along the spread.
 */
export function runArrangeGroupByPieceType() {
	let movedIds: number[] = [];
	game.update((s) => {
		const u = sortMovableSelectedByTemplateSlots(s.pieces, s.selectedIds);
		movedIds = [...u.keys()];
		const pieces = s.pieces.map((p) => {
			const upd = u.get(p.id);
			return upd ? { ...p, zIndex: upd.z, x: upd.x, y: upd.y } : p;
		});
		return { ...s, pieces };
	});
	const st = get(game);
	for (const id of movedIds) {
		const p = st.pieces.find((x) => x.id === id);
		if (p)
			emitGame?.('piece_shuffle', { id: p.id, zindex: p.zIndex, x: p.x, y: p.y });
	}
}

export function runArrangeFanned() {
	game.update((s) => {
		const u = arrangeFanned(s.pieces, s.selectedIds);
		const pieces = s.pieces.map((p) => {
			const upd = u.get(p.id);
			return upd ? { ...p, x: upd.x, y: upd.y } : p;
		});
		return { ...s, pieces };
	});
	emitMovesForSelected();
}

export function runArrangeStacked() {
	game.update((s) => {
		const u = arrangeStacked(s.pieces, s.selectedIds);
		const pieces = s.pieces.map((p) => {
			const upd = u.get(p.id);
			return upd ? { ...p, x: upd.x, y: upd.y } : p;
		});
		return { ...s, pieces };
	});
	emitMovesForSelected();
}

/** One broadcast with many moves — avoids N realtime messages when dragging 100+ cards. */
export function emitPieceMovesBatch(moves: Array<{ id: number; x: number; y: number }>) {
	if (moves.length === 0) return;
	emitGame?.('piece_moves_batch', { moves });
}

function emitMovesForSelected() {
	const s = get(game);
	const moves: Array<{ id: number; x: number; y: number }> = [];
	for (const id of s.selectedIds) {
		const p = s.pieces.find((x) => x.id === id);
		if (p) moves.push({ id: p.id, x: p.x, y: p.y });
	}
	emitPieceMovesBatch(moves);
}

/**
 * Reposition selected pieces using the same placement math as the editor / piece library.
 * Order follows layer order (back → front). Locked pieces are skipped. Emits `piece_moves_batch` for play sync.
 * For flip-capable pieces, `faceUp` sets face-up (front) vs face-down (back) after arranging.
 * Animates each piece in sequence (stagger) into place, then resolves. Emits once after motion completes.
 */
export function applyPlacementArrangementToSelection(
	layout: PlacementLayout,
	spacingMode: PlacementSpacingMode,
	cols: number,
	offset: number,
	faceUp = true
): Promise<boolean> {
	const st = get(game);
	const pieces: PieceInstance[] = [...st.selectedIds]
		.map((id) => st.pieces.find((p) => p.id === id))
		.filter((p): p is PieceInstance => p != null && !p.locked)
		.sort((a, b) => a.zIndex - b.zIndex || a.id - b.id);
	if (pieces.length < 2) return Promise.resolve(false);

	const count = pieces.length;
	const maxW = Math.max(...pieces.map((p) => p.initial_size.w), 1);
	const maxH = Math.max(...pieces.map((p) => p.initial_size.h), 1);
	const minX = Math.min(...pieces.map((p) => p.x));
	const minY = Math.min(...pieces.map((p) => p.y));
	const baseX = layout === 'fan' ? pieces[0].x : minX;
	const baseY = layout === 'fan' ? pieces[0].y : minY;

	const off =
		spacingMode === 'separate'
			? Math.max(0, Math.min(500, Number(offset) || 0))
			: Math.max(1, Math.min(500, Math.floor(Number(offset)) || 32));
	const c = Math.max(1, Math.min(99, Math.floor(cols) || 3));

	const positions = computePlacementPositions({
		layout,
		count,
		baseX,
		baseY,
		offset: off,
		spacingMode,
		pieceW: maxW,
		pieceH: maxH,
		cols: layout === 'grid' || layout === 'honeycomb' ? c : undefined
	});

	const flippedTarget = !faceUp;

	const steps: Array<{ id: number; x: number; y: number; flipped: boolean }> = [];
	for (let i = 0; i < pieces.length; i++) {
		const p = pieces[i];
		const pos = positions[i];
		if (!pos) continue;
		const flipped = pieceSupportsFlip(p) ? flippedTarget : p.flipped;
		steps.push({ id: p.id, x: pos.x, y: pos.y, flipped });
	}

	clearArrangementAnimationTimeouts();
	arrangementAnimGeneration++;
	const myGen = arrangementAnimGeneration;

	game.update((s) => ({ ...s, arrangementAnimationActive: true }));

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		const tid = setTimeout(() => {
			if (myGen !== arrangementAnimGeneration) return;
			game.update((s) => ({
				...s,
				pieces: s.pieces.map((p) => {
					if (p.id !== step.id) return p;
					return { ...p, x: step.x, y: step.y, flipped: step.flipped };
				})
			}));
		}, i * ARRANGEMENT_ANIM_STAGGER_MS);
		arrangementStaggerTimeouts.push(tid);
	}

	const finalDelay =
		Math.max(0, steps.length - 1) * ARRANGEMENT_ANIM_STAGGER_MS + ARRANGEMENT_ANIM_MOVE_MS;

	return new Promise<boolean>((resolve) => {
		pendingArrangeResolve = resolve;
		arrangementDoneTimeout = setTimeout(() => {
			arrangementDoneTimeout = null;
			const finish = pendingArrangeResolve;
			pendingArrangeResolve = null;
			if (myGen !== arrangementAnimGeneration) {
				finish?.(false);
				return;
			}
			game.update((s) => ({ ...s, arrangementAnimationActive: false }));
			emitMovesForSelected();
			for (const p of pieces) {
				if (!pieceSupportsFlip(p)) continue;
				const np = getPieceById(p.id);
				if (np && np.flipped !== p.flipped) {
					emitGame?.('piece_flip', { id: p.id, isFlipped: np.flipped });
				}
			}
			finish?.(true);
		}, finalDelay);
	});
}

export function runSpreadHorizontal() {
	game.update((s) => {
		const u = spreadHorizontal(s.pieces, s.selectedIds);
		const pieces = s.pieces.map((p) => {
			const upd = u.get(p.id);
			return upd ? { ...p, x: upd.x, y: upd.y } : p;
		});
		return { ...s, pieces };
	});
	emitMovesForSelected();
}

export function runSpreadVertical() {
	game.update((s) => {
		const u = spreadVertical(s.pieces, s.selectedIds);
		const pieces = s.pieces.map((p) => {
			const upd = u.get(p.id);
			return upd ? { ...p, x: upd.x, y: upd.y } : p;
		});
		return { ...s, pieces };
	});
	emitMovesForSelected();
}

export function runSpreadCustom(gap: number, angleDeg: number) {
	game.update((s) => {
		const u = spreadCustom(s.pieces, s.selectedIds, gap, angleDeg);
		const pieces = s.pieces.map((p) => {
			const upd = u.get(p.id);
			return upd ? { ...p, x: upd.x, y: upd.y } : p;
		});
		return { ...s, pieces };
	});
	emitMovesForSelected();
}

export function runArrangeSmart() {
	const s = get(game);
	const first = s.pieces.find((p) => s.selectedIds.has(p.id));
	if (!first) return;
	if (first.flipped) runArrangeStacked();
	else runArrangeFanned();
}

export function runShuffleStackToolbar() {
	game.update((s) => {
		let pieces = [...s.pieces];
		const u = shuffleSelectedPieces(
			pieces,
			s.selectedIds
		);
		pieces = pieces.map((p) => {
			const upd = u.get(p.id);
			return upd ? { ...p, zIndex: upd.z, x: upd.x, y: upd.y } : p;
		});
		pieces = pieces.map((p) => {
			if (!s.selectedIds.has(p.id) || !pieceSupportsFlip(p)) return p;
			if (!p.flipped) return { ...p, flipped: true };
			return p;
		});
		const u2 = arrangeStacked(pieces, s.selectedIds);
		pieces = pieces.map((p) => {
			const upd = u2.get(p.id);
			return upd ? { ...p, x: upd.x, y: upd.y } : p;
		});
		return { ...s, pieces };
	});
	const st = get(game);
	const moveBatch: Array<{ id: number; x: number; y: number }> = [];
	for (const id of st.selectedIds) {
		const p = st.pieces.find((x) => x.id === id);
		if (!p) continue;
		emitGame?.('piece_flip', { id: p.id, isFlipped: p.flipped });
		emitGame?.('piece_shuffle', { id: p.id, zindex: p.zIndex, x: p.x, y: p.y });
		moveBatch.push({ id: p.id, x: p.x, y: p.y });
	}
	emitPieceMovesBatch(moveBatch);
}

export function setEditorBoardSnap(enabled: boolean) {
	game.update((s) => ({ ...s, editorSnapEnabled: enabled }));
}

export function setEditorSnapGuides(guides: BoardSnapGuides | null) {
	game.update((s) => ({ ...s, editorSnapGuides: guides }));
}

export function setEditorGridSnap(enabled: boolean, gridSize?: number) {
	game.update((s) => ({
		...s,
		editorSnapToGrid: enabled,
		...(typeof gridSize === 'number' && gridSize > 0 ? { editorGridSize: gridSize } : {})
	}));
}

/** Begin drag for all selected pieces (with move) and/or widgets (unlocked). */
export function beginMoveDrag(clientX: number, clientY: number, panX: number, panY: number) {
	game.update((s) => {
		const selected = s.pieces.filter((p) => s.selectedIds.has(p.id));
		if (selected.length > 0) {
			const canMove = selected.every((p) => hasAttr(p, 'move'));
			if (!canMove) return s;
			if (selected.some((p) => p.locked)) return s;
		}
		const selectedW = s.widgets.filter((w) => s.selectedWidgetIds.has(w.id));
		if (selectedW.some((w) => w.locked)) return s;
		if (selected.length === 0 && selectedW.length === 0) return s;

		const elStarts = new Map<number, { x: number; y: number }>();
		for (const p of selected) {
			elStarts.set(p.id, { x: p.x, y: p.y });
		}

		const widgetStarts = new Map<number, { x: number; y: number }>();
		for (const w of selectedW) {
			widgetStarts.set(w.id, { x: w.x, y: w.y });
		}

		return {
			...s,
			moveDrag: {
				dragStartClientX: clientX,
				dragStartClientY: clientY,
				dragStartPanX: panX,
				dragStartPanY: panY,
				elStarts,
				widgetStarts
			},
			zSorted: false,
			handscroll: false
		};
	});
}

export function startMoveDrag(_pieceId: number, clientX: number, clientY: number, panX: number, panY: number) {
	beginMoveDrag(clientX, clientY, panX, panY);
}

/**
 * World coords: (clientX - panX) / z where z = zoom mult. Delta from drag start uses the same pan term
 * so dragging stays correct when the view is panned away from the origin (and if pan shifts mid-drag).
 */
export function moveDragTo(clientX: number, clientY: number) {
	const zUpdatesRef: { map: Map<number, number> | null } = { map: null };
	game.update((s) => {
		if (!s.moveDrag) return s;
		const z = s.zoom;
		const md = s.moveDrag;
		let pieces = s.pieces.map((p) => {
			if (!s.selectedIds.has(p.id) || !hasAttr(p, 'move')) return p;
			const start = md.elStarts.get(p.id);
			if (!start) return p;
			let nx =
				start.x +
				(clientX - s.panX - md.dragStartClientX + md.dragStartPanX) / z;
			let ny =
				start.y +
				(clientY - s.panY - md.dragStartClientY + md.dragStartPanY) / z;
			if (s.editorSnapToGrid && s.editorGridSize > 0) {
				const gs = s.editorGridSize;
				nx = Math.round(nx / gs) * gs;
				ny = Math.round(ny / gs) * gs;
			}
			return { ...p, x: nx, y: ny };
		});

		let widgets = s.widgets.map((w) => {
			if (!s.selectedWidgetIds.has(w.id) || w.locked) return w;
			const start = md.widgetStarts.get(w.id);
			if (!start) return w;
			let nx =
				start.x +
				(clientX - s.panX - md.dragStartClientX + md.dragStartPanX) / z;
			let ny =
				start.y +
				(clientY - s.panY - md.dragStartClientY + md.dragStartPanY) / z;
			if (s.editorSnapToGrid && s.editorGridSize > 0) {
				const gs = s.editorGridSize;
				nx = Math.round(nx / gs) * gs;
				ny = Math.round(ny / gs) * gs;
			}
			return { ...w, x: nx, y: ny };
		});

		const dragging = pieces.filter((p) => s.selectedIds.has(p.id) && hasAttr(p, 'move'));

		let mergedGuides: BoardSnapGuides = EMPTY_BOARD_GUIDES;
		if (s.editorSnapEnabled && dragging.length > 0) {
			const exclude = new Set(s.selectedIds);
			const targets = buildBoardSnapTargets(s.table, pieces, exclude);
			const primaryId = Math.min(...[...s.selectedIds]);
			const primary = pieces.find((p) => p.id === primaryId);
			if (primary && hasAttr(primary, 'move')) {
				const snapped = snapBoardPiecePosition(
					primary,
					primary.x,
					primary.y,
					targets,
					s.editorSnapThreshold
				);
				const dx = snapped.x - primary.x;
				const dy = snapped.y - primary.y;
				if (dx !== 0 || dy !== 0) {
					pieces = pieces.map((p) =>
						s.selectedIds.has(p.id) && hasAttr(p, 'move')
							? { ...p, x: p.x + dx, y: p.y + dy }
							: p
					);
				}
				mergedGuides = mergeGuides(mergedGuides, snapped.guides);
			}
		}

		let zSorted = s.zSorted;
		if (!zSorted && dragging.length > 0) {
			const updates = bringDraggingToFront(dragging, pieces);
			zUpdatesRef.map = updates;
			pieces = pieces.map((p) => (updates.has(p.id) ? { ...p, zIndex: updates.get(p.id)! } : p));
			zSorted = true;
		}

		return {
			...s,
			pieces,
			widgets,
			zSorted,
			editorSnapGuides: s.editorSnapEnabled ? mergedGuides : null
		};
	});
	const zu = zUpdatesRef.map;
	if (zu) {
		for (const [id, zindex] of zu.entries()) {
			emitGame?.('piece_zindexchange', { id, zindex });
		}
	}
}

export function endMoveDrag() {
	game.update((s) => ({ ...s, moveDrag: null, zSorted: false, editorSnapGuides: null }));
}

export function cancelMoveDrag() {
	game.update((s) => {
		if (!s.moveDrag) return s;
		const md = s.moveDrag;
		const pieces = s.pieces.map((p) => {
			const start = md.elStarts.get(p.id);
			if (!start || !s.selectedIds.has(p.id)) return p;
			return { ...p, x: start.x, y: start.y };
		});
		const widgets = s.widgets.map((w) => {
			const start = md.widgetStarts.get(w.id);
			if (!start || !s.selectedWidgetIds.has(w.id)) return w;
			return { ...w, x: start.x, y: start.y };
		});
		return { ...s, pieces, widgets, moveDrag: null, zSorted: false, editorSnapGuides: null };
	});
}

export function startSelectionBox(x: number, y: number) {
	game.update((s) => ({
		...s,
		selectingBox: true,
		selectBoxAnchor: { x, y },
		selectionBox: { x, y, w: 0, h: 0 },
		selectBoxStartItems: new Set(s.selectedIds),
		selectBoxStartWidgetItems: new Set(s.selectedWidgetIds)
	}));
}

export function updateSelectionBox(
	x: number,
	y: number,
	pieceRects: Map<number, Rect>,
	opts?: {
		canSelectPiece?: (p: PieceInstance) => boolean;
		widgetRects?: Map<number, Rect>;
	}
) {
	game.update((s) => {
		if (!s.selectingBox || !s.selectBoxAnchor) return s;
		const a = s.selectBoxAnchor;
		const selrect: Rect = {
			x: Math.min(a.x, x),
			y: Math.min(a.y, y),
			w: Math.abs(a.x - x),
			h: Math.abs(a.y - y)
		};

		const selectedIds = new Set(s.selectedIds);
		const selectedWidgetIds = new Set(s.selectedWidgetIds);

		for (const p of s.pieces) {
			if (!hasAttr(p, 'select')) continue;
			if (opts?.canSelectPiece && !opts.canSelectPiece(p)) continue;
			const prect = pieceRects.get(p.id);
			if (!prect) continue;
			const wasSelected = s.selectBoxStartItems.has(p.id);
			const hit = intersects(selrect, prect);
			if (hit) {
				if (wasSelected) selectedIds.delete(p.id);
				else selectedIds.add(p.id);
			} else {
				if (wasSelected) selectedIds.add(p.id);
				else selectedIds.delete(p.id);
			}
		}

		const wrects = opts?.widgetRects;
		if (wrects) {
			for (const w of s.widgets) {
				if (w.hidden) continue;
				const wrect = wrects.get(w.id);
				if (!wrect) continue;
				const wasSelected = s.selectBoxStartWidgetItems.has(w.id);
				const hit = intersects(selrect, wrect);
				if (hit) {
					if (wasSelected) selectedWidgetIds.delete(w.id);
					else selectedWidgetIds.add(w.id);
				} else {
					if (wasSelected) selectedWidgetIds.add(w.id);
					else selectedWidgetIds.delete(w.id);
				}
			}
		}

		/* Marquee never keeps locked layers selected. */
		for (const id of [...selectedIds]) {
			const p = s.pieces.find((x) => x.id === id);
			if (p?.locked) selectedIds.delete(id);
		}
		for (const id of [...selectedWidgetIds]) {
			const w = s.widgets.find((x) => x.id === id);
			if (w?.locked) selectedWidgetIds.delete(id);
		}

		return { ...s, selectionBox: selrect, selectedIds, selectedWidgetIds };
	});
}

function intersects(
	a: { x: number; y: number; w: number; h: number },
	b: { x: number; y: number; w: number; h: number }
) {
	return !(
		a.x + a.w < b.x ||
		a.x > b.x + b.w ||
		a.y + a.h < b.y ||
		a.y > b.y + b.h
	);
}

export function endSelectionBox() {
	game.update((s) => ({
		...s,
		selectingBox: false,
		selectionBox: null,
		selectBoxAnchor: null,
		selectBoxStartItems: new Set(),
		selectBoxStartWidgetItems: new Set()
	}));
}

export function setWidgetValue(id: number, value: string | number | boolean) {
	game.update((s) => ({
		...s,
		widgets: s.widgets.map((w) => (w.id === id ? { ...w, value } : w))
	}));
}

/** Apply score from network / snapshot (no broadcast). */
export function applyPlayerSlotScore(slotIndex: number, value: number) {
	if (slotIndex < 0 || slotIndex >= PLAYER_SLOT_MAX) return;
	const v = Math.round(
		Math.min(99999, Math.max(-99999, Number.isFinite(value) ? value : 0))
	);
	game.update((s) => {
		const next = [...s.playerSlotScores];
		next[slotIndex] = v;
		return { ...s, playerSlotScores: next };
	});
}

/** Local change + broadcast in play. */
export function setPlayerSlotScore(slotIndex: number, value: number) {
	if (slotIndex < 0 || slotIndex >= PLAYER_SLOT_MAX) return;
	const v = Math.round(
		Math.min(99999, Math.max(-99999, Number.isFinite(value) ? value : 0))
	);
	game.update((s) => {
		const next = [...s.playerSlotScores];
		next[slotIndex] = v;
		return { ...s, playerSlotScores: next };
	});
	emitGame?.('player_slot_score', { slotIndex, value: v });
}

export function replaceWidgetInstance(w: BoardWidget) {
	game.update((s) => ({
		...s,
		widgets: s.widgets.map((x) => (x.id === w.id ? w : x))
	}));
}

export function addWidgetInstance(w: BoardWidget) {
	game.update((s) => {
		const nextWid = Math.max(s.nextWidgetId, w.id + 1);
		const sel = new Set(s.selectedWidgetIds);
		sel.clear();
		sel.add(w.id);
		return {
			...s,
			widgets: [...s.widgets, w],
			nextWidgetId: nextWid,
			selectedWidgetIds: sel,
			selectedIds: new Set()
		};
	});
}

export function removeWidgetsForEditor(ids: number[]) {
	const idSet = new Set(ids);
	game.update((s) => {
		const selectedWidgetIds = new Set(s.selectedWidgetIds);
		for (const id of ids) selectedWidgetIds.delete(id);
		return {
			...s,
			widgets: s.widgets.filter((w) => !idSet.has(w.id)),
			selectedWidgetIds
		};
	});
}

export function toggleWidgetHidden(id: number) {
	game.update((s) => ({
		...s,
		widgets: s.widgets.map((w) => (w.id === id ? { ...w, hidden: !w.hidden } : w))
	}));
}

export function toggleWidgetLocked(id: number) {
	game.update((s) => ({
		...s,
		widgets: s.widgets.map((w) => {
			if (w.id !== id) return w;
			return { ...w, locked: w.locked === true ? false : true };
		})
	}));
}

export function setHandscroll(v: boolean) {
	game.update((s) => ({ ...s, handscroll: v }));
}

export function setSpacePanHeld(v: boolean) {
	game.update((s) => ({ ...s, spacePanHeld: v }));
}

export function startPanPointer(x: number, y: number) {
	cancelPanInertia();
	game.update((s) => ({ ...s, panPointerStart: { x, y, panX: s.panX, panY: s.panY }, handscroll: true }));
}

export function movePanPointer(x: number, y: number) {
	game.update((s) => {
		if (!s.panPointerStart) return s;
		return {
			...s,
			panX: s.panPointerStart.panX + (x - s.panPointerStart.x),
			panY: s.panPointerStart.panY + (y - s.panPointerStart.y)
		};
	});
	centerCamToVP();
}

export function endPanPointer() {
	game.update((s) => ({ ...s, panPointerStart: null, handscroll: false }));
}

export function setEdgePan(dx: number, dy: number) {
	game.update((s) => ({ ...s, edgePan: { x: dx, y: dy } }));
}

export function applyEdgePanStep() {
	game.update((s) => {
		if (s.edgePan.x === 0 && s.edgePan.y === 0) return s;
		return {
			...s,
			panX: s.panX + s.edgePan.x,
			panY: s.panY + s.edgePan.y
		};
	});
	centerCamToVP();
}

/** Remote multiplayer visual updates */
export function remotePieceMove(id: number, x: number, y: number) {
	movePieceTo(id, x, y);
}

/** Apply many position updates in one store write (matches `piece_moves_batch` broadcast). */
export function remotePieceMovesBatch(moves: Array<{ id: number; x: number; y: number }>) {
	if (moves.length === 0) return;
	const byId = new Map(moves.map((m) => [m.id, m]));
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => {
			const u = byId.get(p.id);
			return u ? { ...p, x: u.x, y: u.y } : p;
		})
	}));
}

export function remotePieceFlip(id: number, isFlipped: boolean) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (p.id === id && pieceSupportsFlip(p) ? { ...p, flipped: isFlipped } : p))
	}));
}

export function remotePieceShuffle(id: number, zindex: number, x: number, y: number) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (p.id === id ? { ...p, zIndex: zindex, x, y } : p))
	}));
}

export function remotePieceZIndex(id: number, zindex: number) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (p.id === id ? { ...p, zIndex: zindex } : p))
	}));
}

export function remotePieceSelect(id: number, color: string) {
	game.update((s) => ({
		...s,
		remoteSelection: { ...s.remoteSelection, [id]: color }
	}));
}

export function remotePieceDeselect(id: number) {
	game.update((s) => {
		const rs = { ...s.remoteSelection };
		delete rs[id];
		return { ...s, remoteSelection: rs };
	});
}

/** Another client destroyed a piece — remove it locally (no destroy-attribute check). */
export function remotePieceDestroy(id: number) {
	game.update((s) => {
		if (!s.pieces.some((x) => x.id === id)) return s;
		const selectedIds = new Set(s.selectedIds);
		selectedIds.delete(id);
		const rs = { ...s.remoteSelection };
		delete rs[id];
		return {
			...s,
			pieces: s.pieces.filter((x) => x.id !== id),
			selectedIds,
			remoteSelection: rs
		};
	});
}

export function getPieceById(id: number): PieceInstance | undefined {
	return get(game).pieces.find((p) => p.id === id);
}

export function getWidgetById(id: number): BoardWidget | undefined {
	return get(game).widgets.find((w) => w.id === id);
}

/** Board editor: clone a widget. Selects the new instance. */
export function duplicateWidgetForEditor(id: number): number | null {
	let newId: number | null = null;
	game.update((s) => {
		const w = s.widgets.find((x) => x.id === id);
		if (!w) return s;
		const nid = s.nextWidgetId;
		let z = maxZIndex(s.pieces);
		for (const x of s.widgets) z = Math.max(z, x.zIndex);
		z += 1;
		const nw: BoardWidget = {
			...w,
			id: nid,
			x: w.x + EDITOR_DUPLICATE_OFFSET,
			y: w.y + EDITOR_DUPLICATE_OFFSET,
			zIndex: z
		};
		newId = nid;
		return {
			...s,
			widgets: [...s.widgets, nw],
			nextWidgetId: nid + 1,
			selectedWidgetIds: new Set([nid]),
			selectedIds: new Set()
		};
	});
	return newId;
}

/** Board editor: remove pieces without destroy attribute check. */
export function removePiecesForEditor(ids: number[]) {
	const idSet = new Set(ids);
	game.update((s) => {
		const selectedIds = new Set(s.selectedIds);
		for (const id of ids) selectedIds.delete(id);
		return {
			...s,
			pieces: s.pieces.filter((p) => !idSet.has(p.id)),
			selectedIds
		};
	});
}

export function selectAllPiecesForEditor() {
	game.update((s) => {
		const selectedIds = new Set<number>();
		for (const p of s.pieces) {
			if (hasAttr(p, 'select') && !p.hidden) selectedIds.add(p.id);
		}
		const selectedWidgetIds = new Set<number>();
		for (const w of s.widgets) {
			if (!w.hidden) selectedWidgetIds.add(w.id);
		}
		return { ...s, selectedIds, selectedWidgetIds };
	});
}

/** Layer list: select a piece even if hidden or missing `select` in saved JSON (board editor only). */
export function selectPieceForEditor(id: number, shift: boolean) {
	game.update((s) => {
		const p = s.pieces.find((x) => x.id === id);
		if (!p) return s;
		const selectedIds = new Set(s.selectedIds);
		const selectedWidgetIds = shift ? new Set(s.selectedWidgetIds) : new Set<number>();
		if (shift) {
			if (selectedIds.has(id)) {
				selectedIds.delete(id);
				emitGame?.('piece_deselect', { id });
			} else {
				selectedIds.add(id);
				emitGame?.('piece_select', { id });
			}
		} else {
			for (const oid of selectedIds) emitGame?.('piece_deselect', { id: oid });
			selectedIds.clear();
			selectedIds.add(id);
			emitGame?.('piece_select', { id });
		}
		return { ...s, selectedIds, selectedWidgetIds };
	});
}

export function selectWidgetForEditor(id: number, shift: boolean) {
	game.update((s) => {
		const w = s.widgets.find((x) => x.id === id);
		if (!w) return s;
		const selectedWidgetIds = new Set(s.selectedWidgetIds);
		const selectedIds = shift ? new Set(s.selectedIds) : new Set<number>();
		if (!shift) {
			for (const oid of s.selectedIds) emitGame?.('piece_deselect', { id: oid });
			selectedWidgetIds.clear();
			selectedWidgetIds.add(id);
		} else {
			if (selectedWidgetIds.has(id)) selectedWidgetIds.delete(id);
			else selectedWidgetIds.add(id);
		}
		return { ...s, selectedIds, selectedWidgetIds };
	});
}

export function nudgeSelectedPieces(dx: number, dy: number) {
	game.update((s) => {
		const pieces = s.pieces.map((p) =>
			s.selectedIds.has(p.id) && hasAttr(p, 'move') && !p.locked
				? { ...p, x: p.x + dx, y: p.y + dy }
				: p
		);
		const widgets = s.widgets.map((w) =>
			s.selectedWidgetIds.has(w.id) && !w.locked ? { ...w, x: w.x + dx, y: w.y + dy } : w
		);
		return { ...s, pieces, widgets };
	});
}

export function togglePieceHidden(id: number) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (p.id === id ? { ...p, hidden: !p.hidden } : p))
	}));
}

export function togglePieceLocked(id: number) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => {
			if (p.id !== id) return p;
			const nextLocked = p.locked === true ? false : true;
			return { ...p, locked: nextLocked };
		})
	}));
}

/** Ordered list bottom→top (same as LayerPanel z-sorted ascending). */
export function reorderPiecesFromOrderedList(ordered: PieceInstance[]) {
	game.update((s) => {
		const byId = new Map(s.pieces.map((p) => [p.id, p]));
		const next: PieceInstance[] = [];
		for (let i = 0; i < ordered.length; i++) {
			const p = byId.get(ordered[i].id);
			if (!p) continue;
			next.push({ ...p, zIndex: i });
		}
		return { ...s, pieces: next };
	});
}

/** Layer list: unified z-order for pieces and widgets (bottom→top = 0…n-1). */
export function reorderBoardFromOrderedList(
	ordered: Array<{ kind: 'piece' | 'widget'; id: number }>
) {
	game.update((s) => {
		const pById = new Map(s.pieces.map((p) => [p.id, p]));
		const wById = new Map(s.widgets.map((w) => [w.id, w]));
		const pieces = [...s.pieces];
		const widgets = [...s.widgets];
		for (let i = 0; i < ordered.length; i++) {
			const it = ordered[i];
			if (it.kind === 'piece') {
				const p = pById.get(it.id);
				if (!p) continue;
				const idx = pieces.findIndex((x) => x.id === it.id);
				if (idx >= 0) pieces[idx] = { ...p, zIndex: i };
			} else {
				const w = wById.get(it.id);
				if (!w) continue;
				const idx = widgets.findIndex((x) => x.id === it.id);
				if (idx >= 0) widgets[idx] = { ...w, zIndex: i };
			}
		}
		return { ...s, pieces, widgets };
	});
}

export function bringForward(id: number) {
	game.update((s) => {
		const ord = [...s.pieces].sort((a, b) => a.zIndex - b.zIndex);
		const idx = ord.findIndex((p) => p.id === id);
		if (idx < 0 || idx >= ord.length - 1) return s;
		const a = ord[idx];
		const b = ord[idx + 1];
		const za = a.zIndex;
		const zb = b.zIndex;
		return {
			...s,
			pieces: s.pieces.map((p) => {
				if (p.id === a.id) return { ...p, zIndex: zb };
				if (p.id === b.id) return { ...p, zIndex: za };
				return p;
			})
		};
	});
}

export function sendBackward(id: number) {
	game.update((s) => {
		const ord = [...s.pieces].sort((a, b) => a.zIndex - b.zIndex);
		const idx = ord.findIndex((p) => p.id === id);
		if (idx <= 0) return s;
		const a = ord[idx];
		const b = ord[idx - 1];
		const za = a.zIndex;
		const zb = b.zIndex;
		return {
			...s,
			pieces: s.pieces.map((p) => {
				if (p.id === a.id) return { ...p, zIndex: zb };
				if (p.id === b.id) return { ...p, zIndex: za };
				return p;
			})
		};
	});
}

export function bringToFront(id: number) {
	game.update((s) => {
		const top = maxZIndex(s.pieces) + 1;
		return {
			...s,
			pieces: s.pieces.map((p) => (p.id === id ? { ...p, zIndex: top } : p))
		};
	});
}

export function sendToBack(id: number) {
	game.update((s) => {
		const ord = [...s.pieces].sort((a, b) => a.zIndex - b.zIndex);
		if (ord.length === 0) return s;
		const bottom = ord[0].zIndex - 1;
		return {
			...s,
			pieces: s.pieces.map((p) => (p.id === id ? { ...p, zIndex: bottom } : p))
		};
	});
}

export function bringWidgetToFront(id: number) {
	game.update((s) => {
		let top = maxZIndex(s.pieces);
		for (const x of s.widgets) top = Math.max(top, x.zIndex);
		top += 1;
		return {
			...s,
			widgets: s.widgets.map((w) => (w.id === id ? { ...w, zIndex: top } : w))
		};
	});
}

export function sendWidgetToBack(id: number) {
	game.update((s) => {
		const allZ: number[] = [];
		for (const p of s.pieces) allZ.push(p.zIndex);
		for (const w of s.widgets) allZ.push(w.zIndex);
		if (allZ.length === 0) return s;
		const bottom = Math.min(...allZ) - 1;
		return {
			...s,
			widgets: s.widgets.map((w) => (w.id === id ? { ...w, zIndex: bottom } : w))
		};
	});
}

export function applyPiecePositionUpdates(updates: Map<number, { x: number; y: number }>) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => {
			const u = updates.get(p.id);
			return u ? { ...p, x: u.x, y: u.y } : p;
		})
	}));
}

export function applyPiecePatches(
	updates: Map<number, Partial<PieceInstance> & { initial_size?: { w: number; h: number } }>
) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => {
			const u = updates.get(p.id);
			return u ? { ...p, ...u } : p;
		})
	}));
}

export function restoreBoardEditorSnapshot(snapshot: {
	pieces: PieceInstance[];
	widgets: BoardWidget[];
	table: { w: number; h: number };
	tableBgFilename: string;
	tableBgRev: number;
	envBgFilename?: string;
	envBgRev?: number;
	pieceColorPalette: string[];
	nextPieceId: number;
	nextWidgetId: number;
	playerSlots?: PlayerSlotZones[] | null;
	initialPlayView?: InitialPlayViewState | null;
}) {
	game.update((s) => ({
		...s,
		pieces: snapshot.pieces.map((p) => ({ ...p, attributes: [...p.attributes], initial_size: { ...p.initial_size } })),
		widgets: snapshot.widgets.map((w) => ({
			...w,
			config: { ...w.config }
		})),
		table: { ...snapshot.table },
		tableBgFilename: snapshot.tableBgFilename,
		tableBgRev: snapshot.tableBgRev,
		envBgFilename: snapshot.envBgFilename ?? '',
		envBgRev: snapshot.envBgRev ?? 0,
		pieceColorPalette: [...snapshot.pieceColorPalette],
		nextPieceId: snapshot.nextPieceId,
		nextWidgetId: snapshot.nextWidgetId,
		playerSlots: snapshot.playerSlots
			? snapshot.playerSlots.map((z) => ({
					safe: { ...z.safe },
					deal: { ...z.deal },
					score: { ...z.score }
				}))
			: snapshot.playerSlots === undefined
				? s.playerSlots
				: null,
		initialPlayView:
			snapshot.initialPlayView !== undefined
				? snapshot.initialPlayView
					? {
							world_rect: { ...snapshot.initialPlayView.world_rect }
						}
					: null
				: s.initialPlayView,
		selectedWidgetIds: new Set(),
		editorSnapGuides: null,
		moveDrag: null
	}));
}

/** Serializable board state for `game_snapshots` (DB / resume). */
export type StoredGameSnapshot = {
	pieces: PieceInstance[];
	nextPieceId: number;
	widgets: BoardWidget[];
	nextWidgetId: number;
	table: { w: number; h: number };
	/** Present in newer snapshots; omitted in older saves. */
	pieceColorPalette?: string[];
	curGame: string;
	assetBaseUrl?: string | null;
	/** Continuous zoom (preferred). */
	zoom?: number;
	/** @deprecated old discrete levels; migrated on load */
	zoomLevel?: number;
	panX: number;
	panY: number;
	/** Per-player slot scores in play; omitted in older saves. */
	playerSlotScores?: number[];
	/** Table / env media (custom games under assetBaseUrl); omitted in older saves. */
	tableBgFilename?: string;
	tableBgRev?: number;
	envBgFilename?: string;
	envBgRev?: number;
	/** Safe / deal / score zones; omitted in older saves. */
	playerSlots?: PlayerSlotZones[] | null;
	/** Saved play framing; omitted in older saves. */
	initialPlayView?: InitialPlayViewState | null;
};

function zoomFromSnapshot(snapshot: StoredGameSnapshot): number {
	if (typeof snapshot.zoom === 'number') return clampZoom(snapshot.zoom);
	return legacyZoomLevelToZoom(snapshot.zoomLevel ?? 0);
}

export function isStoredGameSnapshot(x: unknown): x is StoredGameSnapshot {
	if (typeof x !== 'object' || x === null) return false;
	const o = x as Record<string, unknown>;
	return (
		Array.isArray(o.pieces) &&
		typeof o.nextPieceId === 'number' &&
		typeof o.curGame === 'string' &&
		o.table !== null &&
		typeof o.table === 'object' &&
		typeof (o.table as { w?: unknown }).w === 'number' &&
		typeof (o.table as { h?: unknown }).h === 'number'
	);
}

function clonePlayerSlotsForSnapshot(slots: PlayerSlotZones[] | null): PlayerSlotZones[] | null {
	if (!slots) return null;
	return slots.map((z) => ({
		safe: { ...z.safe },
		deal: { ...z.deal },
		score: { ...z.score }
	}));
}

export function serializeGameState(): StoredGameSnapshot {
	const s = get(game);
	return {
		pieces: s.pieces.map((p) => ({ ...p })),
		nextPieceId: s.nextPieceId,
		widgets: s.widgets.map((w) => ({ ...w, config: { ...w.config } })),
		nextWidgetId: s.nextWidgetId,
		table: { ...s.table },
		pieceColorPalette: [...s.pieceColorPalette],
		curGame: s.curGame,
		assetBaseUrl: s.assetBaseUrl,
		zoom: s.zoom,
		panX: s.panX,
		panY: s.panY,
		playerSlotScores: [...s.playerSlotScores],
		tableBgFilename: s.tableBgFilename,
		tableBgRev: s.tableBgRev,
		envBgFilename: s.envBgFilename,
		envBgRev: s.envBgRev,
		playerSlots: clonePlayerSlotsForSnapshot(s.playerSlots),
		initialPlayView: s.initialPlayView
			? { world_rect: { ...s.initialPlayView.world_rect } }
			: null
	};
}

/**
 * True when the snapshot was saved before layout/background fields existed.
 * In that case we merge from `game_data` (custom) or `/data/.../pieces.json` (stock).
 */
export function snapshotNeedsLayoutHydration(snap: StoredGameSnapshot): boolean {
	return (
		snap.tableBgFilename === undefined ||
		snap.playerSlots === undefined ||
		snap.envBgFilename === undefined ||
		snap.initialPlayView === undefined
	);
}

/** Apply static layout from game JSON without replacing pieces/widgets (used after resume snapshot). */
export function mergeGameLayoutFromGameData(
	json: GameDataJson,
	opts: { assetBaseUrl: string | null }
) {
	game.update((s) => {
		const tableBgFilename = json.table_bg?.trim() || 'table-bg.jpg';
		const envBgFilename = json.environment_bg?.trim() || '';
		const playerSlots = parsePlayerSlotsFromJson(json.player_slots) ?? null;
		const ipv = parseInitialPlayViewJson(json.initial_play_view);
		const pieceColorPalette =
			json.piece_color_palette && json.piece_color_palette.length > 0
				? [...json.piece_color_palette]
				: s.pieceColorPalette;
		return {
			...s,
			assetBaseUrl: opts.assetBaseUrl,
			tableBgFilename,
			tableBgRev: s.tableBgRev + 1,
			envBgFilename,
			envBgRev: s.envBgRev + 1,
			playerSlots,
			initialPlayView: ipv ?? s.initialPlayView,
			pieceColorPalette
		};
	});
}

export function applyStoredGameSnapshot(
	snapshot: StoredGameSnapshot,
	opts?: { skipCenter?: boolean }
) {
	clearArrangementAnimationTimeouts();
	arrangementAnimGeneration++;
	game.update((s) => {
		const playerSlots =
			snapshot.playerSlots === undefined
				? s.playerSlots
				: snapshot.playerSlots === null
					? null
					: snapshot.playerSlots.map((z) => ({
							safe: { ...z.safe },
							deal: { ...z.deal },
							score: { ...z.score }
						}));
		const initialPlayView =
			snapshot.initialPlayView === undefined
				? s.initialPlayView
				: snapshot.initialPlayView === null
					? null
					: { world_rect: { ...snapshot.initialPlayView.world_rect } };
		return {
			...s,
			pieces: snapshot.pieces.map((p) => ({ ...p })),
			nextPieceId: snapshot.nextPieceId,
			widgets: Array.isArray(snapshot.widgets)
				? snapshot.widgets.map((w) => ({ ...w, config: { ...w.config } }))
				: [],
			nextWidgetId: (() => {
				const w = Array.isArray(snapshot.widgets) ? snapshot.widgets : [];
				const nw =
					typeof snapshot.nextWidgetId === 'number' ? snapshot.nextWidgetId : 0;
				if (w.length === 0) return nw;
				const maxId = Math.max(...w.map((x) => x.id));
				return Math.max(nw, maxId + 1);
			})(),
			table: { ...snapshot.table },
			pieceColorPalette:
				snapshot.pieceColorPalette && snapshot.pieceColorPalette.length > 0
					? [...snapshot.pieceColorPalette]
					: s.pieceColorPalette,
			curGame: snapshot.curGame,
			assetBaseUrl: snapshot.assetBaseUrl !== undefined ? snapshot.assetBaseUrl : null,
			tableBgFilename: snapshot.tableBgFilename ?? s.tableBgFilename,
			tableBgRev: snapshot.tableBgRev ?? s.tableBgRev,
			envBgFilename: snapshot.envBgFilename ?? s.envBgFilename,
			envBgRev: snapshot.envBgRev ?? s.envBgRev,
			playerSlots,
			initialPlayView,
			zoom: zoomFromSnapshot(snapshot),
			panX: snapshot.panX,
			panY: snapshot.panY,
			selectedIds: new Set(),
			selectedWidgetIds: new Set(),
			remoteSelection: {},
			loaded: true,
			moveDrag: null,
			selectionBox: null,
			selectBoxAnchor: null,
			selectingBox: false,
			selectBoxStartItems: new Set(),
			selectBoxStartWidgetItems: new Set(),
			edgePan: { x: 0, y: 0 },
			zSorted: false,
			spacePanHeld: false,
			panPointerStart: null,
			handscroll: false,
			editorSnapGuides: null,
			editorSnapToGrid: false,
			editorGridSize: 20,
			playerSlotScores: normalizePlayerSlotScores(snapshot.playerSlotScores),
			arrangementAnimationActive: false
		};
	});
	if (!opts?.skipCenter) centerCamToVP();
}

function normalizePlayerSlotScores(raw: number[] | undefined): number[] {
	const base = Array.from({ length: PLAYER_SLOT_MAX }, () => 0);
	if (!raw?.length) return base;
	for (let i = 0; i < PLAYER_SLOT_MAX; i++) {
		const v = raw[i];
		if (typeof v === 'number' && Number.isFinite(v)) {
			base[i] = Math.round(Math.min(99999, Math.max(-99999, v)));
		}
	}
	return base;
}

const DEAL_ANIM_DELAY_MS = 72;

/**
 * Deal selected movable pieces (highest z first) round-robin to stash roster indices.
 * Emits `piece_moves_batch` (or per-step batch when animated) and `piece_zindexchange` per card.
 */
export async function runDealCardsToRoster(
	rosterIndices: number[],
	cardCount: number,
	opts?: { delayMs?: number; reducedMotion?: boolean }
): Promise<void> {
	const uniq = [...new Set(rosterIndices)].filter((i) => Number.isInteger(i) && i >= 0);
	if (uniq.length === 0) return;
	const delayMs = opts?.reducedMotion ? 0 : (opts?.delayMs ?? DEAL_ANIM_DELAY_MS);

	const s0 = get(game);
	const sel = s0.selectedIds;
	const pieces = s0.pieces
		.filter((p) => sel.has(p.id) && hasAttr(p, 'move'))
		.sort((a, b) => b.zIndex - a.zIndex)
		.slice(0, Math.max(0, Math.floor(cardCount)));
	if (pieces.length === 0) return;

	let zNext = maxZIndex(s0.pieces) + 1;
	const perTarget = new Map<number, number>();
	const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

	const dealMoveBatch: Array<{ id: number; x: number; y: number }> = [];
	for (let step = 0; step < pieces.length; step++) {
		const p = pieces[step];
		const ri = uniq[step % uniq.length];
		const playerSlots = get(game).playerSlots;
		const rect = dealRectForRosterIndex(ri, playerSlots);
		const stackN = perTarget.get(ri) ?? 0;
		perTarget.set(ri, stackN + 1);
		const ox = (stackN % 12) * 2;
		const oy = (stackN % 12) * 2;
		const x = rect.x + rect.w / 2 - p.initial_size.w / 2 + ox;
		const y = rect.y + rect.h / 2 - p.initial_size.h / 2 + oy;
		const np = { ...p, x, y, zIndex: zNext++ };
		replacePieceInstance(np);
		emitGame?.('piece_zindexchange', { id: np.id, zindex: np.zIndex });
		if (delayMs === 0) {
			dealMoveBatch.push({ id: np.id, x: np.x, y: np.y });
		} else {
			emitPieceMovesBatch([{ id: np.id, x: np.x, y: np.y }]);
		}
		if (delayMs > 0 && step < pieces.length - 1) await wait(delayMs);
	}
	if (delayMs === 0 && dealMoveBatch.length > 0) emitPieceMovesBatch(dealMoveBatch);
}

/**
 * After `loaded` is true, schedules `onSave` 3s after the last game store update.
 * Call `unsubscribe()` on destroy.
 */
export function subscribeGameSnapshotAutosave(onSave: () => void): () => void {
	let t: ReturnType<typeof setTimeout> | null = null;
	const unsub = game.subscribe(() => {
		if (!get(game).loaded) return;
		if (t) clearTimeout(t);
		t = setTimeout(() => {
			t = null;
			onSave();
		}, 3000);
	});
	return () => {
		unsub();
		if (t) clearTimeout(t);
	};
}
