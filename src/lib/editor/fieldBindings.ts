import type { CardLayer, FieldBinding } from './types';

export function collectFieldBindings(layers: CardLayer[]): FieldBinding[] {
	const seen = new Set<string>();
	const out: FieldBinding[] = [];
	for (const L of layers) {
		if (!L.fieldBinding) continue;
		const fn = L.fieldBinding.fieldName;
		if (seen.has(fn)) continue;
		seen.add(fn);
		out.push(L.fieldBinding);
	}
	return out;
}
