/** Split message text into plain segments and @mention tokens (Discord-style). */
export type ChatTextPart = { kind: 'text'; value: string } | { kind: 'mention'; value: string };

export function parseAtMentions(text: string): ChatTextPart[] {
	if (!text) return [];
	const re = /@([^\s@]+)/g;
	const parts: ChatTextPart[] = [];
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		if (m.index > last) {
			parts.push({ kind: 'text', value: text.slice(last, m.index) });
		}
		parts.push({ kind: 'mention', value: m[0] });
		last = m.index + m[0].length;
	}
	if (last < text.length) {
		parts.push({ kind: 'text', value: text.slice(last) });
	}
	return parts.length ? parts : [{ kind: 'text', value: text }];
}
