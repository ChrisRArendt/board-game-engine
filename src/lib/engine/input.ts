/** Keyboard helpers — key codes vary by layout; we mirror legacy keyCode usage where needed. */

export function isZoomMinusKey(e: KeyboardEvent): boolean {
	return e.key === '-' || e.key === '_' || e.code === 'Minus';
}

export function isZoomPlusKey(e: KeyboardEvent): boolean {
	return e.key === '=' || e.key === '+' || e.code === 'Equal';
}
