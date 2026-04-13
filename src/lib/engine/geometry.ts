export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export const ZOOM_MIN = 0.15;
export const ZOOM_MAX = 3.0;
/** Default scale (matches former middle discrete level 0.6). */
export const ZOOM_DEFAULT = 0.6;

export function clampZoom(z: number): number {
	return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/** Map legacy snapshot zoomLevel (-1, 0, 1) to continuous zoom. */
export function legacyZoomLevelToZoom(zoomLevel: number): number {
	switch (zoomLevel) {
		case -1:
			return 0.35;
		case 1:
			return 1.4;
		case 0:
		default:
			return ZOOM_DEFAULT;
	}
}

/**
 * World-space rectangle (table coordinates) visible in the board viewport for the given pan/zoom.
 * Viewport coords are relative to the viewport’s top-left (0,0); matches `(vx - panX) / zoom` world mapping.
 */
export function visibleWorldRect(
	panX: number,
	panY: number,
	zoom: number,
	viewportW: number,
	viewportH: number
): Rect {
	const z = zoom || 1;
	const x0 = -panX / z;
	const y0 = -panY / z;
	const x1 = (viewportW - panX) / z;
	const y1 = (viewportH - panY) / z;
	const x = Math.min(x0, x1);
	const y = Math.min(y0, y1);
	return {
		x,
		y,
		w: Math.abs(x1 - x0),
		h: Math.abs(y1 - y0)
	};
}

/** Inset from viewport edges (px) — fit/center use the inner rectangle (e.g. play UI chrome). */
export type ViewportFitInset = {
	top?: number;
	right?: number;
	bottom?: number;
	left?: number;
};

/**
 * Pan/zoom so `rect` (world/table coords) fits in the viewport with margin, centered.
 * Mapping: screenX = panX + zoom * worldX (see visibleWorldRect).
 *
 * Zoom is capped at ZOOM_MAX only. It is not floored to ZOOM_MIN: a large saved rect must
 * zoom out below ZOOM_MIN to stay fully visible (otherwise the view crops the rectangle).
 */
export function panZoomToFitWorldRect(
	rect: Rect,
	viewportW: number,
	viewportH: number,
	opts?: { margin?: number; inset?: ViewportFitInset }
): { panX: number; panY: number; zoom: number } {
	const margin = opts?.margin ?? 0.04;
	const ins = opts?.inset;
	const L = Math.max(0, ins?.left ?? 0);
	const R = Math.max(0, ins?.right ?? 0);
	const T = Math.max(0, ins?.top ?? 0);
	const B = Math.max(0, ins?.bottom ?? 0);
	const effW = Math.max(viewportW - L - R, 1);
	const effH = Math.max(viewportH - T - B, 1);
	const bw = Math.max(rect.w, 1e-6);
	const bh = Math.max(rect.h, 1e-6);
	const availW = effW * (1 - 2 * margin);
	const availH = effH * (1 - 2 * margin);
	const zFit = Math.min(availW / bw, availH / bh);
	const zoom = Math.min(ZOOM_MAX, zFit);
	const cx = rect.x + rect.w / 2;
	const cy = rect.y + rect.h / 2;
	const screenCx = L + effW / 2;
	const screenCy = T + effH / 2;
	const panX = screenCx - zoom * cx;
	const panY = screenCy - zoom * cy;
	return { panX, panY, zoom };
}

export function rectanglesIntersect(a: Rect, b: Rect): boolean {
	return !(
		a.x + a.w < b.x ||
		a.x > b.x + b.w ||
		a.y + a.h < b.y ||
		a.y > b.y + b.h
	);
}

export function getViewportSize(): { w: number; h: number } {
	if (typeof window === 'undefined') return { w: 800, h: 600 };
	return { w: window.innerWidth, h: window.innerHeight };
}

export function shuffle<T>(array: T[]): T[] {
	const o = [...array];
	for (let j: number, x: T, i = o.length; i; ) {
		j = Math.floor(Math.random() * i);
		x = o[--i];
		o[i] = o[j];
		o[j] = x;
	}
	return o;
}

export function pad(num: number, size: number): string {
	let s = `${num}`;
	while (s.length < size) s = `0${s}`;
	return s;
}
