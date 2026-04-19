<script lang="ts">
	import { GOOGLE_FONT_FAMILIES } from '$lib/editor/googleFontsCatalog';
	import { ensureGoogleFontLoaded, syncGoogleFontPreviewQueue } from '$lib/editor/googleFontsLoader';

	let { value, onChange }: { value: string; onChange: (v: string) => void } = $props();

	let query = $state('');

	const intersectionState = new Map<Element, { family: string; ratio: number }>();

	function flushPreviewQueue() {
		const visible = new Map<string, number>();
		for (const { family, ratio } of intersectionState.values()) {
			visible.set(family, Math.max(visible.get(family) ?? 0, ratio));
		}
		syncGoogleFontPreviewQueue(visible);
	}

	function gfontPreviewRow(node: HTMLButtonElement, family: string) {
		const root = node.closest('.gfont-list') as HTMLElement | null;
		node.dataset.gfontPreview = family;
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					const el = e.target as HTMLButtonElement;
					const fam = el.dataset.gfontPreview ?? '';
					if (!fam) continue;
					if (e.isIntersecting) {
						intersectionState.set(el, { family: fam, ratio: e.intersectionRatio });
					} else {
						intersectionState.delete(el);
					}
				}
				flushPreviewQueue();
			},
			{
				root,
				rootMargin: '0px',
				threshold: [0, 0.05, 0.15, 0.35, 0.55, 0.75, 1]
			}
		);
		io.observe(node);
		return {
			update(newFamily: string) {
				node.dataset.gfontPreview = newFamily;
				intersectionState.delete(node);
				flushPreviewQueue();
			},
			destroy() {
				io.disconnect();
				intersectionState.delete(node);
				flushPreviewQueue();
			}
		};
	}

	function previewFontCss(family: string): string {
		const safe = family.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
		return `'${safe}', sans-serif`;
	}

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [...GOOGLE_FONT_FAMILIES].slice(0, 40);
		return GOOGLE_FONT_FAMILIES.filter((f) => f.toLowerCase().includes(q)).slice(0, 56);
	});

	const systemPresets = [
		{ label: '— pick —', v: '' },
		{ label: 'System UI', v: 'system-ui, sans-serif' },
		{ label: 'Sans (stack)', v: 'ui-sans-serif, system-ui, sans-serif' },
		{ label: 'Serif (stack)', v: 'ui-serif, Georgia, serif' },
		{ label: 'Monospace', v: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
		{ label: 'Georgia', v: 'Georgia, serif' },
		{ label: 'Palatino', v: 'Palatino, "Palatino Linotype", serif' },
		{ label: 'Trebuchet', v: "'Trebuchet MS', sans-serif" },
		{ label: 'Verdana', v: 'Verdana, sans-serif' }
	];

	function pickGoogle(name: string) {
		const safe = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
		onChange(`'${safe}', sans-serif`);
		ensureGoogleFontLoaded(name);
		query = '';
	}
</script>

<div class="font-picker">
	<label class="row">
		<span>System</span>
		<select
			class="sel"
			onchange={(e) => {
				const v = (e.currentTarget as HTMLSelectElement).value;
				if (v) onChange(v);
				(e.currentTarget as HTMLSelectElement).selectedIndex = 0;
			}}
		>
			{#each systemPresets as p}
				<option value={p.v}>{p.label}</option>
			{/each}
		</select>
	</label>
	<label class="row">
		<span>Google (curated)</span>
		<input type="search" placeholder="Type to filter…" bind:value={query} autocomplete="off" />
	</label>
	<ul class="gfont-list" aria-label="Google font matches">
		{#each filtered as name (name)}
			<li>
				<button
					type="button"
					class="gfont-btn"
					style:font-family={previewFontCss(name)}
					use:gfontPreviewRow={name}
					onclick={() => pickGoogle(name)}
				>
					{name}
				</button>
			</li>
		{/each}
	</ul>
	<label class="row">
		<span>Font stack (CSS)</span>
		<input
			type="text"
			spellcheck="false"
			{value}
			oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
			placeholder="'Inter', sans-serif"
		/>
	</label>
	<p class="hint">
		With no filter, only the first 40 families are listed — type to search the full curated set. Names preview
		in their font as you scroll (loaded on demand). Only curated Google fonts load automatically. For any family
		on
		<a href="https://fonts.google.com" target="_blank" rel="noreferrer">fonts.google.com</a>, paste a CSS stack —
		you may need to add the embed link in your export pipeline.
	</p>
</div>

<style>
	.font-picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.row input,
	.sel {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		font-size: 13px;
	}
	.gfont-list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 140px;
		overflow-y: auto;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-bg);
	}
	.gfont-list li {
		margin: 0;
		border-bottom: 1px solid var(--color-border);
	}
	.gfont-list li:last-child {
		border-bottom: none;
	}
	.gfont-btn {
		display: block;
		width: 100%;
		text-align: left;
		padding: 5px 8px;
		border: none;
		background: transparent;
		color: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.gfont-btn:hover {
		background: rgba(59, 130, 246, 0.12);
	}
	.hint {
		margin: 0;
		font-size: 11px;
		line-height: 1.4;
		color: var(--color-text-muted);
	}
	.hint a {
		color: var(--color-link, #2563eb);
	}
</style>
