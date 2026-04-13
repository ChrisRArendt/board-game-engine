<script lang="ts">
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import { customRulesPublicUrl } from '$lib/customGames';
	import type { PageData } from './$types';

	export let data: PageData;

	const supabase = createSupabaseBrowserClient();

	let title = data.game.title;
	let description = data.game.description;
	let rulesFile: File | null = null;
	let saving = false;
	let msg = '';
	let err = '';

	async function save() {
		saving = true;
		msg = '';
		err = '';
		try {
			let rulesPath: string | null = data.game.rules_pdf_path;
			if (rulesFile && data.session?.user) {
				const path = `${data.session.user.id}/${data.game.id}/rules.pdf`;
				const up = await supabase.storage.from('custom-game-assets').upload(path, rulesFile, {
					upsert: true,
					contentType: 'application/pdf'
				});
				if (up.error) throw up.error;
				rulesPath = path;
			}
			const { error } = await supabase
				.from('custom_board_games')
				.update({
					title: title.trim() || 'Untitled',
					description: description.trim(),
					rules_pdf_path: rulesPath,
					updated_at: new Date().toISOString()
				})
				.eq('id', data.game.id);
			if (error) throw error;
			msg = 'Saved.';
			rulesFile = null;
		} catch (e) {
			err = e instanceof Error ? e.message : 'Error';
		}
		saving = false;
	}

	$: rulesUrl =
		data.game.rules_pdf_path != null
			? customRulesPublicUrl(PUBLIC_SUPABASE_URL, data.game.rules_pdf_path)
			: null;
</script>

<div class="page">
	<h1>{data.game.title}</h1>
	<p class="meta">Key: <code>{data.game.game_key}</code></p>

	{#if msg}
		<p class="ok">{msg}</p>
	{/if}
	{#if err}
		<p class="err">{err}</p>
	{/if}

	<label class="field">
		<span>Title</span>
		<input type="text" bind:value={title} />
	</label>
	<label class="field">
		<span>Description</span>
		<textarea bind:value={description} rows="3"></textarea>
	</label>
	<label class="field">
		<span>Rules PDF</span>
		<input
			type="file"
			accept="application/pdf,.pdf"
			onchange={(e) => {
				rulesFile = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
			}}
		/>
		{#if rulesUrl}
			<a href={rulesUrl} target="_blank" rel="noreferrer">Current rules</a>
		{/if}
	</label>

	<button type="button" class="btn primary" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
</div>

<style>
	.page {
		max-width: 560px;
		padding: 1.25rem 1.5rem;
		color: var(--color-text);
	}
	h1 {
		margin-top: 0;
	}
	.meta {
		font-size: 13px;
		color: var(--color-text-muted);
	}
	.meta code {
		font-size: 12px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 1rem;
	}
	.field input,
	.field textarea {
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.btn {
		padding: 8px 16px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		cursor: pointer;
	}
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
	}
	.ok {
		color: #86efac;
	}
	.err {
		color: #f87171;
	}
</style>
