<script lang="ts">
	import { GOOGLE_FONT_FAMILIES } from '$lib/editor/googleFontsCatalog';
	import { ensureGoogleFontLoaded } from '$lib/editor/googleFontsLoader';

	let { value, onChange }: { value: string; onChange: (v: string) => void } = $props();

	let query = $state('');

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
				<button type="button" class="gfont-btn" onclick={() => pickGoogle(name)}>{name}</button>
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
		Only curated Google fonts load automatically. For any family on
		<a href="https://fonts.google.com" target="_blank" rel="noreferrer">fonts.google.com</a>, paste a CSS
		stack — you may need to add the embed link in your export pipeline.
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
