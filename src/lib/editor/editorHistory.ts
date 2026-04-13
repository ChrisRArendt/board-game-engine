import type { GameDataJson } from '$lib/engine/types';
import type { PieceInstance } from '$lib/engine/types';

const MAX = 50;

export interface BoardEditorSnapshot {
	pieces: PieceInstance[];
	table: { w: number; h: number };
	tableBgFilename: string;
	tableBgRev: number;
	pieceColorPalette: string[];
	nextPieceId: number;
}

function cloneSnapshot(s: BoardEditorSnapshot): BoardEditorSnapshot {
	return {
		pieces: s.pieces.map((p) => ({
			...p,
			attributes: [...p.attributes],
			initial_size: { ...p.initial_size }
		})),
		table: { ...s.table },
		tableBgFilename: s.tableBgFilename,
		tableBgRev: s.tableBgRev,
		pieceColorPalette: [...s.pieceColorPalette],
		nextPieceId: s.nextPieceId
	};
}

export class EditorHistory {
	private undoStack: BoardEditorSnapshot[] = [];
	private redoStack: BoardEditorSnapshot[] = [];

	/** After a successful mutation, push the new full state (clears redo). */
	pushAfterMutate(newState: BoardEditorSnapshot) {
		this.undoStack.push(cloneSnapshot(newState));
		if (this.undoStack.length > MAX) this.undoStack.shift();
		this.redoStack = [];
	}

	canUndo() {
		return this.undoStack.length > 1;
	}

	canRedo() {
		return this.redoStack.length > 0;
	}

	seed(initial: BoardEditorSnapshot) {
		this.undoStack = [cloneSnapshot(initial)];
		this.redoStack = [];
	}

	/** Returns state to apply, or null. */
	undo(): BoardEditorSnapshot | null {
		if (this.undoStack.length <= 1) return null;
		const current = this.undoStack.pop()!;
		this.redoStack.push(current);
		const prev = this.undoStack[this.undoStack.length - 1];
		return cloneSnapshot(prev);
	}

	/** Returns state to apply, or null. */
	redo(): BoardEditorSnapshot | null {
		if (this.redoStack.length === 0) return null;
		const next = this.redoStack.pop()!;
		this.undoStack.push(next);
		return cloneSnapshot(next);
	}
}

/** Strip editor-only fields from game JSON for runtime play (optional). */
export function stripEditorOnlyFromGameJson(json: GameDataJson): GameDataJson {
	const { editor_view: _view, ...withoutView } = json;
	return {
		...withoutView,
		pieces: json.pieces.map((row) => {
			const { editor_hidden, editor_locked, ...rest } = row as typeof row & {
				editor_hidden?: boolean;
				editor_locked?: boolean;
			};
			return rest;
		})
	};
}
