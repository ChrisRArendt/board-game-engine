/** Keyboard helpers — key codes vary by layout; we mirror legacy keyCode usage where needed. */

export function isZoomMinusKey(e: KeyboardEvent): boolean {
	return e.key === '-' || e.key === '_' || e.code === 'Minus';
}

export function isZoomPlusKey(e: KeyboardEvent): boolean {
	return e.key === '=' || e.key === '+' || e.code === 'Equal';
}

/** True when the event target is a field where Space should type normally. */
export function isTypingInField(target: EventTarget | null): boolean {
	if (!target || !(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
	if (target.isContentEditable) return true;
	return target.closest('[contenteditable="true"]') != null;
}
