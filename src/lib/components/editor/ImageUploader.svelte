<script lang="ts">
	import { createSupabaseBrowserClient } from '$lib/supabase/client';

	export let gameId: string;
	export let userId: string;
	/** Called with storage path (bucket-relative) */
	export let onUploaded: (path: string, filename: string) => void;

	const supabase = createSupabaseBrowserClient();
	let busy = false;
	let err = '';

	async function onFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		busy = true;
		err = '';
		try {
			const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
			const name = `upload_${Date.now()}${ext}`;
			const path = `${userId}/${gameId}/${name}`;
			const { error: upErr } = await supabase.storage.from('custom-game-assets').upload(path, file, {
				upsert: true,
				contentType: file.type || undefined
			});
			if (upErr) throw upErr;
			onUploaded(path, name);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Upload failed';
		}
		busy = false;
	}
</script>

<label class="up">
	<input type="file" accept="image/*" disabled={busy} onchange={onFile} class="hid" />
	<span class="btn">{busy ? 'Uploading…' : 'Choose image'}</span>
</label>
{#if err}<p class="err">{err}</p>{/if}

<style>
	.up {
		display: inline-block;
		cursor: pointer;
	}
	.hid {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
	}
	.btn {
		display: inline-block;
		padding: 8px 14px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		font-size: 14px;
	}
	.err {
		color: #f87171;
		font-size: 13px;
		margin: 4px 0 0;
	}
</style>
