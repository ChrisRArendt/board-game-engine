<script lang="ts">
	import { onMount } from 'svelte';
	import { openConversationUi } from '$lib/dmNavigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { listConversations, type ConversationWithPeer } from '$lib/dm';
	import type { PageData } from './$types';

	export let data: PageData;

	const supabase = createSupabaseBrowserClient();

	function requireUserId(): string {
		const id = data.session?.user?.id;
		if (!id) throw new Error('Not signed in');
		return id;
	}

	let rows: ConversationWithPeer[] = [];
	let loading = true;
	let err = '';

	onMount(async () => {
		try {
			rows = await listConversations(supabase, requireUserId());
		} catch (e) {
			err = e instanceof Error ? e.message : 'Error';
		}
		loading = false;
	});
</script>

<svelte:head>
	<title>{data.title ?? 'Messages'}</title>
</svelte:head>

<div class="messages-page">
	<h1 class="h1">Messages</h1>
	{#if err}
		<p class="err">{err}</p>
	{/if}
	{#if loading}
		<div class="skel"></div>
		<div class="skel short"></div>
	{:else if rows.length === 0}
		<p class="muted">No conversations yet. Message a friend from the lobby rail.</p>
	{:else}
		<ul class="list">
			{#each rows as r (r.id)}
				<li>
					<button
						type="button"
						class="row"
						class:unread={r.unread}
						on:click={() => openConversationUi(r.id)}
					>
						<span class="name">{r.other_profile?.display_name ?? 'Friend'}</span>
						<span class="preview">{r.last_preview ?? '—'}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.messages-page {
		max-width: 560px;
		margin: 0 auto;
		padding: 1.25rem 1.5rem 2rem;
		font-family: Roboto, system-ui, sans-serif;
	}
	.h1 {
		margin: 0 0 1rem;
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}
	.err {
		color: var(--color-danger);
	}
	.muted {
		color: var(--color-text-muted);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.row {
		width: 100%;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.75rem 0.85rem;
		border-radius: 12px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		font: inherit;
		box-shadow: var(--shadow-sm);
		transition:
			background var(--social-dur-fast) var(--social-ease),
			border-color 0.15s ease;
	}
	.row:hover {
		background: var(--color-surface-muted);
	}
	.row.unread {
		border-left: 3px solid var(--color-accent);
	}
	.name {
		font-weight: 600;
		font-size: 0.95rem;
	}
	.preview {
		font-size: 0.82rem;
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.skel {
		height: 52px;
		border-radius: 8px;
		background: linear-gradient(
			90deg,
			var(--social-surface) 0%,
			color-mix(in oklab, var(--color-accent) 10%, var(--social-surface)) 50%,
			var(--social-surface) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.2s ease-in-out infinite;
		margin-bottom: 0.5rem;
	}
	.skel.short {
		height: 40px;
		width: 72%;
	}
	@keyframes shimmer {
		0% {
			background-position: 0% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
</style>
