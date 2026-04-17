import { writable } from 'svelte/store';

/**
 * When true, Board must not route pointerdown to the table/viewport/pieces (Deal modal and similar overlays).
 * Prevents deselect / pan from firing “through” UI that should own the gesture.
 */
export const boardPointerBlocked = writable(false);
