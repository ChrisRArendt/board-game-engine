<script lang="ts">
	export let open = false;
	export let gameId: string;
	export let onPick: (result: { mediaId: string; publicUrl: string }) => void;
	export let onClose: () => void;

	let prompt = '';
	let loading = false;
	let err = '';
	let previewUrl: string | null = null;
	let lastMediaId: string | null = null;

	async function generate() {
		if (!prompt.trim()) return;
		loading = true;
		err = '';
		previewUrl = null;
		lastMediaId = null;
		try {
			const r = await fetch('/api/generate-image', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: prompt.trim(), gameId })
			});
			const j = (await r.json()) as { mediaId?: string; publicUrl?: string; message?: string };
			if (!r.ok) throw new Error(j.message ?? 'Generation failed');
			if (!j.mediaId || !j.publicUrl) throw new Error('Bad response');
			lastMediaId = j.mediaId;
			previewUrl = j.publicUrl;
		} catch (e) {
			err = e instanceof Error ? e.message : 'Error';
		}
		loading = false;
	}

	function useIt() {
		if (lastMediaId && previewUrl) {
			onPick({ mediaId: lastMediaId, publicUrl: previewUrl });
			onClose();
		}
	}

	function onWinKey(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onWinKey} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={onClose} role="presentation">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="panel" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()} tabindex="-1">
			<h2>Generate image</h2>
			<label class="field">
				<span>Prompt</span>
				<textarea bind:value={prompt} rows="4" disabled={loading}></textarea>
			</label>
			{#if loading}
				<p class="prog">Generating…</p>
			{/if}
			{#if err}
				<p class="err">{err}</p>
			{/if}
			{#if previewUrl}
				<div class="prev">
					<img src={previewUrl} alt="Preview" />
				</div>
			{/if}
			<div class="actions">
				<button type="button" class="btn" onclick={onClose} disabled={loading}>Cancel</button>
				<button type="button" class="btn" onclick={generate} disabled={loading || !prompt.trim()}>
					{previewUrl ? 'Redo' : 'Generate'}
				</button>
				{#if previewUrl && lastMediaId}
					<button type="button" class="btn primary" onclick={useIt}>Use this</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 300000;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.panel {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 20px;
		max-width: 480px;
		width: 100%;
		max-height: 90vh;
		overflow: auto;
	}
	h2 {
		margin: 0 0 12px;
		font-size: 1.1rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}
	.field textarea {
		padding: 8px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
	}
	.prog {
		color: var(--color-text-muted);
	}
	.err {
		color: #f87171;
	}
	.prev {
		margin: 12px 0;
		max-height: 240px;
		overflow: auto;
		border-radius: 8px;
		border: 1px solid var(--color-border);
	}
	.prev img {
		display: block;
		max-width: 100%;
		height: auto;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 12px;
	}
	.btn {
		padding: 8px 14px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
		cursor: pointer;
	}
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
	}
</style>
