import type {
	BoardWidget,
	EditorViewJson,
	GameDataJson,
	InitialPlayViewState,
	PieceInstance,
	PlayerSlotZones
} from '$lib/engine/types';

const MAX = 50;

export interface BoardEditorSnapshot {
	pieces: PieceInstance[];
	widgets: BoardWidget[];
	table: { w: number; h: number };
	tableBgFilename: string;
	tableBgRev: number;
	envBgFilename: string;
	envBgRev: number;
	pieceColorPalette: string[];
	nextPieceId: number;
	nextWidgetId: number;
	playerSlots: PlayerSlotZones[] | null;
	initialPlayView: InitialPlayViewState | null;
}

function cloneSnapshot(s: BoardEditorSnapshot): BoardEditorSnapshot {
	return {
		pieces: s.pieces.map((p) => ({
			...p,
			attributes: [...p.attributes],
			initial_size: { ...p.initial_size }
		})),
		widgets: s.widgets.map((w) => ({ ...w, config: { ...w.config } })),
		table: { ...s.table },
		tableBgFilename: s.tableBgFilename,
		tableBgRev: s.tableBgRev,
		envBgFilename: s.envBgFilename,
		envBgRev: s.envBgRev,
		pieceColorPalette: [...s.pieceColorPalette],
		nextPieceId: s.nextPieceId,
		nextWidgetId: s.nextWidgetId,
		playerSlots: s.playerSlots
			? s.playerSlots.map((z) => ({
					safe: { ...z.safe },
					deal: { ...z.deal },
					score: { ...z.score }
				}))
			: null,
		initialPlayView: s.initialPlayView
			? { world_rect: { ...s.initialPlayView.world_rect } }
			: null
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
	const widgets = json.widgets?.map((row) => {
		const { editor_hidden, editor_locked, ...rest } = row as typeof row & {
			editor_hidden?: boolean;
			editor_locked?: boolean;
		};
		return rest;
	});
	return {
		...withoutView,
		pieces: json.pieces.map((row) => {
			const { editor_hidden, editor_locked, ...rest } = row as typeof row & {
				editor_hidden?: boolean;
				editor_locked?: boolean;
			};
			return rest;
		}),
		...(widgets ? { widgets } : {})
	};
}
