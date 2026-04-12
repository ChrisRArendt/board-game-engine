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
