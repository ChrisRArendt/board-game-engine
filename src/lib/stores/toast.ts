import { writable } from 'svelte/store';

export type ToastKind = 'success' | 'info' | 'warn' | 'error' | 'invite' | 'dm';

export type ToastAction = {
	label: string;
	onClick: () => void;
};

export type ToastItem = {
	id: string;
	kind: ToastKind;
	title: string;
	body?: string;
	ttlMs?: number;
	actions?: ToastAction[];
	/** When set, TTL bar pauses on hover */
	pauseOnHover?: boolean;
};

const MAX_STORED = 24;
const DEFAULT_TTL = 8000;

function genId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
	return `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const toasts = writable<ToastItem[]>([]);

export function pushToast(
	p: Omit<ToastItem, 'id'> & { id?: string }
): string {
	const id = p.id ?? genId();
	const item: ToastItem = {
		id,
		ttlMs: p.ttlMs ?? DEFAULT_TTL,
		pauseOnHover: p.pauseOnHover !== false,
		...p
	};
	toasts.update((list) => {
		const next = [...list.filter((x) => x.id !== id), item];
		if (next.length > MAX_STORED) return next.slice(-MAX_STORED);
		return next;
	});
	return id;
}

export function dismissToast(id: string): void {
	toasts.update((list) => list.filter((x) => x.id !== id));
}

export function toastSuccess(title: string, body?: string): string {
	return pushToast({ kind: 'success', title, body });
}

export function toastInfo(title: string, body?: string): string {
	return pushToast({ kind: 'info', title, body });
}

export function toastError(title: string, body?: string): string {
	return pushToast({ kind: 'error', title, body, ttlMs: 12000 });
}
