<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import {
		listMessages,
		sendMessage,
		markConversationRead,
		type ConversationMessageRow
	} from '$lib/dm';
	import type { RealtimeChannel } from '@supabase/supabase-js';

	/** `null` = fetch display name / username after mount (e.g. sheet). */
	export let peer: { id: string; display_name: string; username: string } | null = null;
	export let conversationId: string;
	export let userId: string;
	/** `sheet`: rounded panel, drag handle; `page`: full thread page */
	export let variant: 'page' | 'sheet' = 'page';
	export let onClose: (() => void) | undefined = undefined;

	const supabase = createSupabaseBrowserClient();

	let messages: ConversationMessageRow[] = [];
	let body = '';
	let sending = false;
	let err = '';
	let logEl: HTMLDivElement | null = null;
	let ch: RealtimeChannel | null = null;
	let peerLocal = peer;
	$: if (peer) peerLocal = peer;
	let loadingPeer = false;

	async function scrollBottom() {
		await tick();
		if (logEl) logEl.scrollTop = logEl.scrollHeight;
	}

	async function loadPeerMeta() {
		if (peerLocal) return;
		loadingPeer = true;
		try {
			const { data: conv, error: ce } = await supabase
				.from('conversations')
				.select('user_a, user_b')
				.eq('id', conversationId)
				.single();
			if (ce || !conv) throw new Error(ce?.message ?? 'Conversation not found');
			const oid = conv.user_a === userId ? conv.user_b : conv.user_a;
			const { data: p, error: pe } = await supabase
				.from('profiles')
				.select('id, display_name, username')
				.eq('id', oid)
				.single();
			if (pe || !p) throw new Error(pe?.message ?? 'Peer not found');
			peerLocal = p;
		} catch (e) {
			err = e instanceof Error ? e.message : 'Error';
		} finally {
			loadingPeer = false;
		}
	}

	async function load() {
		try {
			messages = await listMessages(supabase, conversationId, { limit: 200 });
			await scrollBottom();
			await markConversationRead(supabase, {
				conversationId,
				userId
			});
		} catch (e) {
			err = e instanceof Error ? e.message : 'Error';
		}
	}

	async function submit() {
		const t = body.trim();
		if (!t || sending) return;
		sending = true;
		err = '';
		try {
			const row = await sendMessage(supabase, {
				conversationId,
				senderId: userId,
				body: t
			});
			body = '';
			messages = [...messages, row];
			await scrollBottom();
		} catch (e) {
			err = e instanceof Error ? e.message : 'Send failed';
		}
		sending = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void submit();
		}
	}

	$: displayName = peerLocal?.display_name ?? '…';
	$: handle = peerLocal?.username ?? '';

	onMount(() => {
		void loadPeerMeta();
		void load();

		ch = supabase
			.channel(`dm:${conversationId}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'conversation_messages',
					filter: `conversation_id=eq.${conversationId}`
				},
				(payload) => {
					const row = payload.new as ConversationMessageRow;
					if (messages.some((m) => m.id === row.id)) return;
					messages = [...messages, row];
					void scrollBottom();
					if (row.sender_id !== userId) {
						void markConversationRead(supabase, {
							conversationId,
							userId
						});
					}
				}
			);
		void ch.subscribe();
	});

	onDestroy(() => {
		if (ch) void supabase.removeChannel(ch);
	});
</script>

<div class="thread-root" class:thread-root--sheet={variant === 'sheet'} class:thread-root--page={variant === 'page'}>
	{#if variant === 'sheet'}
		<button type="button" class="sheet-handle" aria-hidden="true" tabindex="-1"></button>
	{/if}

	<header class="head">
		{#if onClose}
			<button type="button" class="back" on:click={() => onClose?.()}>Close</button>
		{:else}
			<a class="back" href="/messages">← Messages</a>
		{/if}
		{#if loadingPeer && !peerLocal}
			<h1 class="peer">Loading…</h1>
		{:else}
			<h1 class="peer">{displayName}</h1>
			{#if handle}
				<p class="sub">@{handle}</p>
			{/if}
		{/if}
	</header>

	{#if err}
		<p class="err-line">{err}</p>
	{/if}

	<div class="log" bind:this={logEl}>
		{#each messages as m, i (m.id)}
			{@const showName =
				i === 0 ||
				messages[i - 1].sender_id !== m.sender_id ||
				new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 5 * 60 * 1000}
			<div
				class="msg-wrap"
				class:mine={m.sender_id === userId}
				in:fly={{ y: 6, duration: 180, easing: cubicOut }}
			>
				{#if showName}
					<span class="who">
						{m.sender_id === userId ? 'You' : displayName}
					</span>
				{/if}
				<div class="bubble">{m.body}</div>
				<span class="time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
			</div>
		{/each}
	</div>

	<div class="composer">
		<textarea
			rows="1"
			placeholder="Message…"
			bind:value={body}
			on:keydown={onKey}
		></textarea>
		<button type="button" class="send" disabled={!body.trim() || sending} on:click={() => submit()}>
			Send
		</button>
	</div>
</div>

<style>
	.thread-root {
		display: flex;
		flex-direction: column;
		min-height: 0;
		box-sizing: border-box;
		font-family: Roboto, system-ui, sans-serif;
	}
	.thread-root--page {
		max-width: 640px;
		margin: 0 auto;
		padding: 1rem 1rem 1.5rem;
		height: calc(100vh - 120px);
		min-height: 320px;
	}
	.thread-root--sheet {
		flex: 1;
		min-height: 0;
		padding: 0 1rem 1rem;
		max-height: min(92dvh, 720px);
	}
	.sheet-handle {
		display: block;
		width: 40px;
		height: 5px;
		margin: 0.5rem auto 0.75rem;
		padding: 0;
		border: none;
		border-radius: 99px;
		background: color-mix(in oklab, var(--color-text) 22%, transparent);
		cursor: default;
		flex-shrink: 0;
	}
	.head {
		flex-shrink: 0;
		margin-bottom: 0.75rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-border);
	}
	.back {
		font-size: 0.85rem;
		color: var(--color-link, var(--color-accent, #60a5fa));
		text-decoration: none;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		cursor: pointer;
	}
	.back:hover {
		text-decoration: underline;
	}
	.peer {
		margin: 0.35rem 0 0;
		font-size: 1.2rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}
	.sub {
		margin: 0.15rem 0 0;
		font-size: 0.82rem;
		color: var(--color-text-muted);
	}
	.err-line {
		color: var(--color-danger);
		font-size: 0.88rem;
		margin: 0 0 0.5rem;
	}
	.log {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.35rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		scrollbar-gutter: stable;
	}
	.msg-wrap {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		max-width: 88%;
	}
	.msg-wrap.mine {
		align-self: flex-end;
		align-items: flex-end;
	}
	.who {
		font-size: 0.72rem;
		color: var(--color-text-muted);
		margin-bottom: 0.15rem;
	}
	.bubble {
		padding: 0.5rem 0.75rem;
		border-radius: 16px;
		background: var(--color-surface-muted);
		border: 1px solid var(--color-border);
		font-size: 0.94rem;
		line-height: 1.4;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.msg-wrap.mine .bubble {
		background: color-mix(in oklab, var(--color-accent) 22%, var(--color-surface-muted));
		border-color: color-mix(in oklab, var(--color-accent) 40%, var(--color-border));
	}
	.time {
		font-size: 0.65rem;
		color: var(--color-text-muted);
		margin-top: 0.15rem;
	}
	.composer {
		flex-shrink: 0;
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-border);
	}
	textarea {
		flex: 1;
		min-height: 2.75rem;
		max-height: 8rem;
		resize: vertical;
		padding: 0.55rem 0.75rem;
		border-radius: 12px;
		border: 1px solid var(--color-border);
		background: var(--color-input-bg);
		color: var(--color-text);
		font: inherit;
		line-height: 1.35;
	}
	textarea:focus-visible {
		outline: none;
		box-shadow: var(--social-ring, 0 0 0 2px color-mix(in oklab, var(--color-accent) 45%, transparent));
	}
	.send {
		border-radius: 12px;
		border: 1px solid var(--color-border-strong, var(--color-border));
		background: color-mix(in oklab, var(--color-accent) 28%, transparent);
		color: var(--color-text);
		font: inherit;
		font-weight: 500;
		padding: 0.5rem 1rem;
		cursor: pointer;
		flex-shrink: 0;
	}
	.send:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>
