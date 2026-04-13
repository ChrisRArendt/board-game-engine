/**
 * Board pointer / touch gesture engine: pinch-zoom, pan inertia, tap vs drag, long-press.
 * Mouse behavior mirrors the previous Board implementation (immediate pan on empty table, etc.).
 */

export const DRAG_THRESHOLD = 8;
export const TAP_MAX_MS = 300;
export const LONG_PRESS_MS = 400;
export const INERTIA_FRICTION = 0.92;
export const INERTIA_MIN_V = 0.5;

export type BoardHit =
	| { kind: 'piece'; pieceId: number }
	| { kind: 'table'; direct: boolean }
	| { kind: 'viewport' }
	| { kind: 'blocked' };

type Sample = { x: number; y: number; t: number };

export interface PointerEngineOptions {
	/** Skip inertia / long-press haptics when user prefers reduced motion */
	prefersReducedMotion: () => boolean;
	onPanStart: (clientX: number, clientY: number) => void;
	onPanMove: (clientX: number, clientY: number) => void;
	onPanEnd: () => void;
	/** Touch pan release — optional inertia */
	onPanInertia: (vx: number, vy: number) => void;
	onPinch: (
		newZoom: number,
		midX: number,
		midY: number,
		pinchStart: { zoom: number; panX: number; panY: number; midX: number; midY: number }
	) => void;
	onPieceMouseDown: (pieceId: number, e: PointerEvent) => void | Promise<void>;
	onPieceTouchPressing: (pieceId: number, pressing: boolean) => void;
	onPieceTouchTap: (pieceId: number, shift: boolean) => void;
	onPieceTouchDragStart: (pieceId: number, clientX: number, clientY: number) => void;
	onPieceDragMove: (clientX: number, clientY: number) => void;
	onPieceDragEnd: () => void;
	onPieceDragCancel: () => void;
	onLongPress: (pieceId: number, clientX: number, clientY: number) => void;
	onTapEmpty: () => void;
	onMouseTableDown: (direct: boolean, clientX: number, clientY: number, shift: boolean) => void;
	onSelectionBoxMove: (clientX: number, clientY: number) => void;
	onSelectionBoxEnd: () => void;
	onSecondPointerDuringDrag: () => void;
	getZoom: () => number;
	getPan: () => { panX: number; panY: number };
	getSpacePan: () => boolean;
	getShift: () => boolean;
	getMoveDrag: () => boolean;
	getPanPointerActive: () => boolean;
	getSelectingBox: () => boolean;
	/**
	 * Touch: only start piece drag after threshold if true. If false, treat as board pan
	 * (e.g. unselected selectable piece). Pieces with `move` but no `select` should return true.
	 */
	isPieceSelectedForTouchDrag: (pieceId: number) => boolean;
}

function dist(ax: number, ay: number, bx: number, by: number) {
	const dx = bx - ax;
	const dy = by - ay;
	return Math.hypot(dx, dy);
}

function midpoint(a: PointerEvent, b: PointerEvent) {
	return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

function distanceBetween(a: PointerEvent, b: PointerEvent) {
	return dist(a.clientX, a.clientY, b.clientX, b.clientY);
}

export class PointerEngine {
	private opts: PointerEngineOptions;
	private pointers = new Map<number, PointerEvent>();
	private touchEmptyStart: { x: number; y: number; t: number } | null = null;
	private touchEmptyPanned = false;
	private touchPieceId: number | null = null;
	private touchDragActive = false;
	private longPressTimer: ReturnType<typeof setTimeout> | null = null;
	private longPressPieceId: number | null = null;
	private longPressFired = false;
	private pinchStart:
		| {
				dist: number;
				zoom: number;
				panX: number;
				panY: number;
				midX: number;
				midY: number;
		  }
		| null = null;
	private lastMoveSamples: Sample[] = [];
	private destroyed = false;

	constructor(opts: PointerEngineOptions) {
		this.opts = opts;
	}

	destroy() {
		this.destroyed = true;
		this.clearLongPressTimer();
		if (typeof window !== 'undefined') {
			window.removeEventListener('pointermove', this.onWinMove);
			window.removeEventListener('pointerup', this.onWinUp);
			window.removeEventListener('pointercancel', this.onWinUp);
		}
	}

	private clearLongPressTimer() {
		if (this.longPressTimer) {
			clearTimeout(this.longPressTimer);
			this.longPressTimer = null;
		}
		this.longPressPieceId = null;
	}

	private resetTouchPieceState() {
		this.touchPieceId = null;
		this.touchDragActive = false;
		this.touchEmptyStart = null;
		this.longPressFired = false;
	}

	private pushSample(x: number, y: number) {
		const t = performance.now();
		this.lastMoveSamples.push({ x, y, t });
		while (this.lastMoveSamples.length > 4) this.lastMoveSamples.shift();
	}

	private velocityPxPerMs(): { vx: number; vy: number } {
		const s = this.lastMoveSamples;
		if (s.length < 2) return { vx: 0, vy: 0 };
		const a = s[s.length - 1];
		const b = s[0];
		const dt = Math.max(1, a.t - b.t);
		return { vx: (a.x - b.x) / dt, vy: (a.y - b.y) / dt };
	}

	private onWinMove = (e: PointerEvent) => {
		if (this.destroyed) return;
		if (!this.pointers.has(e.pointerId)) return;
		this.pointers.set(e.pointerId, e);

		if (this.pointers.size === 2 && this.pinchStart) {
			const [p1, p2] = [...this.pointers.values()];
			const d = distanceBetween(p1, p2);
			const mid = midpoint(p1, p2);
			const ratio = d / this.pinchStart.dist;
			const newZoom = this.pinchStart.zoom * ratio;
			const ps = this.pinchStart;
			this.opts.onPinch(newZoom, mid.x, mid.y, {
				zoom: ps.zoom,
				panX: ps.panX,
				panY: ps.panY,
				midX: ps.midX,
				midY: ps.midY
			});
			return;
		}

		if (e.pointerType === 'touch' && this.touchPieceId != null && !this.touchDragActive) {
			const d0 = this.touchEmptyStart;
			if (d0 && dist(d0.x, d0.y, e.clientX, e.clientY) > DRAG_THRESHOLD) {
				this.clearLongPressTimer();
				this.opts.onPieceTouchPressing(this.touchPieceId, false);
				if (!this.longPressFired) {
					if (this.opts.isPieceSelectedForTouchDrag(this.touchPieceId)) {
						this.touchDragActive = true;
						this.opts.onPieceTouchDragStart(this.touchPieceId, d0.x, d0.y);
					} else {
						this.touchPieceId = null;
						this.touchEmptyPanned = true;
						this.lastMoveSamples = [{ x: d0.x, y: d0.y, t: d0.t }];
						this.opts.onPanStart(d0.x, d0.y);
					}
				}
			}
		}

		if (e.pointerType === 'touch' && this.touchEmptyStart && this.touchPieceId == null && !this.touchEmptyPanned) {
			const d0 = this.touchEmptyStart;
			if (dist(d0.x, d0.y, e.clientX, e.clientY) > DRAG_THRESHOLD) {
				this.touchEmptyPanned = true;
				this.opts.onPanStart(d0.x, d0.y);
			}
		}

		if (this.touchEmptyPanned || (e.pointerType !== 'touch' && this.opts.getPanPointerActive())) {
			this.pushSample(e.clientX, e.clientY);
		}

		if (this.touchEmptyPanned) {
			this.opts.onPanMove(e.clientX, e.clientY);
		}

		if (e.pointerType === 'touch' && this.touchPieceId != null && this.touchDragActive) {
			this.opts.onPieceDragMove(e.clientX, e.clientY);
		}

		if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
			if (this.opts.getSelectingBox()) {
				this.opts.onSelectionBoxMove(e.clientX, e.clientY);
			}
			if (this.opts.getMoveDrag()) {
				this.opts.onPieceDragMove(e.clientX, e.clientY);
			}
			if (this.opts.getPanPointerActive() && this.pointers.size === 1) {
				this.opts.onPanMove(e.clientX, e.clientY);
			}
		}
	};

	private onWinUp = (e: PointerEvent) => {
		if (this.destroyed) return;
		if (!this.pointers.has(e.pointerId)) return;
		this.pointers.delete(e.pointerId);

		if (this.pointers.size < 2) {
			this.pinchStart = null;
		}

		if (e.pointerType === 'touch' && this.touchPieceId != null) {
			this.clearLongPressTimer();
			this.opts.onPieceTouchPressing(this.touchPieceId, false);
			const d0 = this.touchEmptyStart;
			const elapsed = d0 ? performance.now() - d0.t : 9999;
			if (
				!this.longPressFired &&
				!this.touchDragActive &&
				d0 &&
				elapsed < TAP_MAX_MS &&
				dist(d0.x, d0.y, e.clientX, e.clientY) < DRAG_THRESHOLD
			) {
				this.opts.onPieceTouchTap(this.touchPieceId, false);
			}
			if (this.touchDragActive) {
				this.opts.onPieceDragEnd();
			}
			this.resetTouchPieceState();
			return;
		}

		if (e.pointerType === 'touch' && this.touchEmptyStart) {
			if (!this.touchEmptyPanned) {
				const d0 = this.touchEmptyStart;
				const elapsed = performance.now() - d0.t;
				if (
					elapsed < TAP_MAX_MS &&
					dist(d0.x, d0.y, e.clientX, e.clientY) < DRAG_THRESHOLD
				) {
					this.opts.onTapEmpty();
				}
			} else {
				const { vx, vy } = this.velocityPxPerMs();
				this.opts.onPanEnd();
				if (!this.opts.prefersReducedMotion() && (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05)) {
					this.opts.onPanInertia(vx, vy);
				}
			}
			this.touchEmptyStart = null;
			this.touchEmptyPanned = false;
			this.lastMoveSamples = [];
			return;
		}

		if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
			this.opts.onPieceDragEnd();
			this.opts.onSelectionBoxEnd();
			this.opts.onPanEnd();
			this.lastMoveSamples = [];
		}
	};

	handlePointerDown(e: PointerEvent, hit: BoardHit) {
		if (this.destroyed) return;
		this.pointers.set(e.pointerId, e);

		if (this.pointers.size === 2) {
			const [p1, p2] = [...this.pointers.values()];
			const d = distanceBetween(p1, p2);
			const mid = midpoint(p1, p2);
			const pan = this.opts.getPan();
			if (this.opts.getMoveDrag()) {
				this.opts.onSecondPointerDuringDrag();
			} else if (this.touchDragActive) {
				this.opts.onPieceDragEnd();
			}
			if (this.touchEmptyPanned) {
				this.opts.onPanEnd();
			}
			if (this.touchPieceId != null) {
				this.opts.onPieceTouchPressing(this.touchPieceId, false);
			}
			this.clearLongPressTimer();
			this.touchPieceId = null;
			this.touchDragActive = false;
			this.touchEmptyStart = null;
			this.touchEmptyPanned = false;
			this.longPressFired = false;
			this.pinchStart = {
				dist: d,
				zoom: this.opts.getZoom(),
				panX: pan.panX,
				panY: pan.panY,
				midX: mid.x,
				midY: mid.y
			};
			return;
		}

		if (e.pointerType === 'touch') {
			if (hit.kind === 'blocked') return;
			if (hit.kind === 'piece') {
				this.longPressFired = false;
				this.touchEmptyStart = { x: e.clientX, y: e.clientY, t: performance.now() };
				this.touchPieceId = hit.pieceId;
				this.touchDragActive = false;
				this.longPressPieceId = hit.pieceId;
				this.opts.onPieceTouchPressing(hit.pieceId, true);
				this.longPressTimer = setTimeout(() => {
					if (this.destroyed || this.longPressPieceId !== hit.pieceId) return;
					this.longPressTimer = null;
					if (!this.touchDragActive) {
						try {
							if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
						} catch {
							/* ignore */
						}
						this.longPressFired = true;
						this.opts.onLongPress(hit.pieceId, e.clientX, e.clientY);
					}
				}, LONG_PRESS_MS);
				return;
			}
			if (hit.kind === 'table' || hit.kind === 'viewport') {
				this.touchEmptyStart = { x: e.clientX, y: e.clientY, t: performance.now() };
				this.touchEmptyPanned = false;
				this.lastMoveSamples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
				return;
			}
			return;
		}

		// mouse / pen
		if (hit.kind === 'piece') {
			void this.opts.onPieceMouseDown(hit.pieceId, e);
			this.pushSample(e.clientX, e.clientY);
			return;
		}
		if (hit.kind === 'table') {
			this.opts.onMouseTableDown(hit.direct, e.clientX, e.clientY, this.opts.getShift());
			this.pushSample(e.clientX, e.clientY);
			return;
		}
		if (hit.kind === 'viewport' && this.opts.getSpacePan()) {
			this.opts.onPanStart(e.clientX, e.clientY);
			this.pushSample(e.clientX, e.clientY);
		}
	}

	handlePointerMove(e: PointerEvent) {
		this.onWinMove(e);
	}

	handlePointerUp(e: PointerEvent) {
		this.onWinUp(e);
	}

	attachWindowListeners() {
		if (typeof window === 'undefined') return;
		window.addEventListener('pointermove', this.onWinMove);
		window.addEventListener('pointerup', this.onWinUp);
		window.addEventListener('pointercancel', this.onWinUp);
	}

	/** Touch: after long-press opened menu, movement may start drag — call from Board when continuing */
}
