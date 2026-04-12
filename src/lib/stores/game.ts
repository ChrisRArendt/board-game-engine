import { derived, get, writable } from 'svelte/store';

/** Set from +page.svelte to avoid circular imports with the network store. */
let emitGame: ((type: string, data: Record<string, unknown>) => void) | null = null;

export function registerGameEmit(fn: (type: string, data: Record<string, unknown>) => void) {
	emitGame = fn;
}
import type { GameDataJson, PieceData, PieceInstance } from '$lib/engine/types';
import {
	arrangeFanned,
	arrangeStacked,
	bringDraggingToFront,
	hasAttr,
	maxZIndex,
	pieceFromData,
	shuffleSelectedPieces
} from '$lib/engine/pieces';
import { getViewportSize, type Rect, zoomLevelToMult } from '$lib/engine/geometry';

export interface GameState {
	curGame: string;
	table: { w: number; h: number };
	pieces: PieceInstance[];
	selectedIds: Set<number>;
	/** other users' selection highlights */
	remoteSelection: Record<number, string>;
	zoomLevel: number;
	panX: number;
	panY: number;
	cameraX: number;
	cameraY: number;
	textRegions: Record<string, string>;
	nextPieceId: number;
	shiftDown: boolean;
	selectionBox: null | { x: number; y: number; w: number; h: number };
	selectingBox: boolean;
	selectBoxStartItems: Set<number>;
	handscroll: boolean;
	panPointerStart: { x: number; y: number; panX: number; panY: number } | null;
	moveDrag:
		| null
		| {
				cursorStartX: number;
				cursorStartY: number;
				elStarts: Map<number, { x: number; y: number }>;
		  };
	zSorted: boolean;
	edgePan: { x: number; y: number };
	loaded: boolean;
}

function initialState(): GameState {
	const vp = typeof window !== 'undefined' ? getViewportSize() : { w: 1200, h: 800 };
	return {
		curGame: 'bsg_1',
		table: { w: 3000, h: 3000 },
		pieces: [],
		selectedIds: new Set(),
		remoteSelection: {},
		zoomLevel: 0,
		panX: 0,
		panY: 0,
		cameraX: vp.w / 2,
		cameraY: vp.h / 2,
		textRegions: {
			textregion_0: '00',
			textregion_1: '00',
			textregion_2: '00',
			textregion_3: '00'
		},
		nextPieceId: 0,
		shiftDown: false,
		selectionBox: null,
		selectingBox: false,
		selectBoxStartItems: new Set(),
		handscroll: false,
		panPointerStart: null,
		moveDrag: null,
		zSorted: false,
		edgePan: { x: 0, y: 0 },
		loaded: false
	};
}

export const game = writable<GameState>(initialState());

export const selectedPieces = derived(game, ($g) => $g.pieces.filter((p) => $g.selectedIds.has(p.id)));

export function loadGameData(json: GameDataJson) {
	const curGame = 'bsg_1';
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

		const vp = getViewportSize();
		return {
			...s,
			curGame,
			table: { w: json.table.size.w, h: json.table.size.h },
			pieces,
			nextPieceId: nextId,
			selectedIds: new Set(),
			remoteSelection: {},
			cameraX: vp.w / 2,
			cameraY: vp.h / 2,
			panX: 0,
			panY: 0,
			zoomLevel: 0,
			loaded: true
		};
	});
}

export function setPan(x: number, y: number) {
	game.update((s) => ({ ...s, panX: x, panY: y }));
}

export function setZoomLevel(level: number) {
	game.update((s) => {
		const z = Math.max(-1, Math.min(1, level));
		return { ...s, zoomLevel: z };
	});
}

/** Focal point in document coordinates (same as jQuery `offset()`). */
export function adjustZoom(delta: number, focalDoc: { left: number; top: number }) {
	game.update((s) => {
		const newLevel = Math.max(-1, Math.min(1, s.zoomLevel + delta));
		const vp = getViewportSize();
		const target = {
			x: s.panX - focalDoc.left + vp.w / 2,
			y: s.panY - focalDoc.top + vp.h / 2
		};
		return { ...s, zoomLevel: newLevel, panX: target.x, panY: target.y };
	});
	centerCamToVP();
}

export function resetPan() {
	game.update((s) => ({ ...s, panX: 0, panY: 0 }));
	centerCamToVP();
}

export function setShiftDown(v: boolean) {
	game.update((s) => ({ ...s, shiftDown: v }));
}

export function centerCamToVP() {
	game.update((s) => {
		const vp = getViewportSize();
		const z = zoomLevelToMult(s.zoomLevel);
		const target = {
			x: (vp.w / 2 - s.panX) * (1 / z),
			y: (vp.h / 2 - s.panY) * (1 / z)
		};
		return { ...s, cameraX: target.x, cameraY: target.y };
	});
}

export function applyPanDelta(dx: number, dy: number) {
	game.update((s) => ({ ...s, panX: s.panX + dx, panY: s.panY + dy }));
	centerCamToVP();
}

export function selectPiece(id: number) {
	game.update((s) => {
		const p = s.pieces.find((x) => x.id === id);
		if (!p || !hasAttr(p, 'select')) return s;
		const selectedIds = new Set(s.selectedIds);
		selectedIds.add(id);
		return { ...s, selectedIds };
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
		return { ...s, selectedIds: new Set() };
	});
}

export function toggleSelect(id: number) {
	game.update((s) => {
		const p = s.pieces.find((x) => x.id === id);
		if (!p || !hasAttr(p, 'select')) return s;
		const selectedIds = new Set(s.selectedIds);
		if (selectedIds.has(id)) selectedIds.delete(id);
		else selectedIds.add(id);
		return { ...s, selectedIds };
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
		} else {
			if (!selectedIds.has(id)) {
				for (const oid of selectedIds) {
					emitGame?.('piece_deselect', { id: oid });
				}
				selectedIds.clear();
				selectedIds.add(id);
				emitGame?.('piece_select', { id });
			}
		}
		return { ...s, selectedIds };
	});
}

export function flipPiece(id: number) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (p.id === id && hasAttr(p, 'flip') ? { ...p, flipped: !p.flipped } : p))
	}));
	const p = getPieceById(id);
	if (p && hasAttr(p, 'flip')) {
		emitGame?.('piece_flip', { id, isFlipped: p.flipped });
	}
}

export function setPieceFlipped(id: number, flipped: boolean) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (p.id === id && hasAttr(p, 'flip') ? { ...p, flipped } : p))
	}));
}

export function movePieceTo(id: number, x: number, y: number) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (p.id === id ? { ...p, x, y } : p))
	}));
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

export function runArrangeFanned() {
	game.update((s) => {
		const u = arrangeFanned(s.pieces, s.selectedIds);
		const pieces = s.pieces.map((p) => {
			const upd = u.get(p.id);
			return upd ? { ...p, x: upd.x, y: upd.y } : p;
		});
		return { ...s, pieces };
	});
	const s = get(game);
	for (const id of s.selectedIds) {
		const p = s.pieces.find((x) => x.id === id);
		if (p) emitGame?.('piece_move', { id: p.id, x: p.x, y: p.y });
	}
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
	const s = get(game);
	for (const id of s.selectedIds) {
		const p = s.pieces.find((x) => x.id === id);
		if (p) emitGame?.('piece_move', { id: p.id, x: p.x, y: p.y });
	}
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
			if (!s.selectedIds.has(p.id) || !hasAttr(p, 'flip')) return p;
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
	for (const id of st.selectedIds) {
		const p = st.pieces.find((x) => x.id === id);
		if (!p) continue;
		emitGame?.('piece_flip', { id: p.id, isFlipped: p.flipped });
		emitGame?.('piece_shuffle', { id: p.id, zindex: p.zIndex, x: p.x, y: p.y });
		emitGame?.('piece_move', { id: p.id, x: p.x, y: p.y });
	}
}

export function startMoveDrag(pieceId: number, clientX: number, clientY: number, goX: number, goY: number) {
	game.update((s) => {
		const selected = s.pieces.filter((p) => s.selectedIds.has(p.id));
		const canMove = selected.every((p) => hasAttr(p, 'move'));
		if (!canMove) return s;

		const elStarts = new Map<number, { x: number; y: number }>();
		for (const p of selected) {
			elStarts.set(p.id, { x: p.x, y: p.y });
		}

		const zm = 1 / zoomLevelToMult(s.zoomLevel);
		const cursorStartX = clientX - goX * zm;
		const cursorStartY = clientY - goY * zm;

		return {
			...s,
			moveDrag: { cursorStartX, cursorStartY, elStarts },
			zSorted: false,
			handscroll: false
		};
	});
}

export function moveDragTo(clientX: number, clientY: number, goX: number, goY: number) {
	const zUpdatesRef: { map: Map<number, number> | null } = { map: null };
	game.update((s) => {
		if (!s.moveDrag) return s;
		const zm = 1 / zoomLevelToMult(s.zoomLevel);
		const dragging = s.pieces.filter((p) => s.selectedIds.has(p.id) && hasAttr(p, 'move'));
		let pieces = s.pieces.map((p) => {
			if (!s.selectedIds.has(p.id) || !hasAttr(p, 'move')) return p;
			const start = s.moveDrag!.elStarts.get(p.id);
			if (!start) return p;
			const nx = start.x - goX * zm + (clientX - s.moveDrag!.cursorStartX) * zm;
			const ny = start.y - goY * zm + (clientY - s.moveDrag!.cursorStartY) * zm;
			return { ...p, x: nx, y: ny };
		});

		let zSorted = s.zSorted;
		if (!zSorted && dragging.length > 0) {
			const updates = bringDraggingToFront(dragging, pieces);
			zUpdatesRef.map = updates;
			pieces = pieces.map((p) => (updates.has(p.id) ? { ...p, zIndex: updates.get(p.id)! } : p));
			zSorted = true;
		}

		return { ...s, pieces, zSorted };
	});
	const zu = zUpdatesRef.map;
	if (zu) {
		for (const [id, zindex] of zu.entries()) {
			emitGame?.('piece_zindexchange', { id, zindex });
		}
	}
}

export function endMoveDrag() {
	game.update((s) => ({ ...s, moveDrag: null, zSorted: false }));
}

export function startSelectionBox(x: number, y: number) {
	game.update((s) => ({
		...s,
		selectingBox: true,
		selectionBox: { x, y, w: 0, h: 0 },
		selectBoxStartItems: new Set(s.selectedIds)
	}));
}

export function updateSelectionBox(x: number, y: number, pieceRects: Map<number, Rect>) {
	game.update((s) => {
		if (!s.selectingBox || !s.selectionBox) return s;
		const start = { x: s.selectionBox.x, y: s.selectionBox.y };
		const selrect: Rect = {
			x: Math.min(start.x, x),
			y: Math.min(start.y, y),
			w: Math.abs(start.x - x),
			h: Math.abs(start.y - y)
		};

		const zm = zoomLevelToMult(s.zoomLevel);
		const selectedIds = new Set(s.selectedIds);

		for (const p of s.pieces) {
			if (!hasAttr(p, 'select')) continue;
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

		return { ...s, selectionBox: selrect, selectedIds };
	});
}

function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
	return !(
		a.x + a.w < b.x ||
		a.x > b.x + b.w ||
		a.y + a.h < b.y ||
		a.y > b.y + b.h
	);
}

export function endSelectionBox() {
	game.update((s) => ({ ...s, selectingBox: false, selectionBox: null, selectBoxStartItems: new Set() }));
}

export function setTextRegion(id: string, val: string) {
	game.update((s) => ({ ...s, textRegions: { ...s.textRegions, [id]: val } }));
}

export function setHandscroll(v: boolean) {
	game.update((s) => ({ ...s, handscroll: v }));
}

export function startPanPointer(x: number, y: number) {
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

export function remotePieceFlip(id: number, isFlipped: boolean) {
	game.update((s) => ({
		...s,
		pieces: s.pieces.map((p) => (p.id === id && hasAttr(p, 'flip') ? { ...p, flipped: isFlipped } : p))
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

export function getPieceById(id: number): PieceInstance | undefined {
	return get(game).pieces.find((p) => p.id === id);
}
