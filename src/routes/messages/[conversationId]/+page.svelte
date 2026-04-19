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
	import type { PageData } from './$types';

	export let data: PageData;

	const supabase = createSupabaseBrowserClient();

	function uid(): string {
		const id = data.session?.user?.id;
		if (!id) throw new Error('Not signed in');
		return id;
	}

	let messages: ConversationMessageRow[] = [];
	let body = '';
	let sending = false;
	let err = '';
	let logEl: HTMLDivElement | null = null;
	let ch: RealtimeChannel | null = null;

	async function scrollBottom() {
		await tick();
		if (logEl) logEl.scrollTop = logEl.scrollHeight;
	}

	async function load() {
		try {
			messages = await listMessages(supabase, data.conv.id, { limit: 200 });
			await scrollBottom();
			await markConversationRead(supabase, {
				conversationId: data.conv.id,
				userId: uid()
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
				conversationId: data.conv.id,
				senderId: uid(),
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

	onMount(() => {
		void load();

		ch = supabase
			.channel(`dm:${data.conv.id}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'conversation_messages',
					filter: `conversation_id=eq.${data.conv.id}`
				},
				(payload) => {
					const row = payload.new as ConversationMessageRow;
					if (messages.some((m) => m.id === row.id)) return;
					messages = [...messages, row];
					void scrollBottom();
					if (row.sender_id !== uid()) {
						void markConversationRead(supabase, {
							conversationId: data.conv.id,
							userId: uid()
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

<svelte:head>
	<title>{data.title ?? 'Chat'}</title>
</svelte:head>

<div class="thread-page">
	<header class="head">
		<a class="back" href="/messages">← Back</a>
		<h1 class="peer">{data.peer.display_name}</h1>
		<p class="sub">@{data.peer.username}</p>
	</header>

	{#if err}
		<p class="err">{err}</p>
	{/if}

	<div class="log" bind:this={logEl}>
		{#each messages as m, i (m.id)}
			{@const showName =
				i === 0 ||
				messages[i - 1].sender_id !== m.sender_id ||
				new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 5 * 60 * 1000}
			<div
				class="msg-wrap"
				class:mine={m.sender_id === uid()}
				in:fly={{ y: 6, duration: 180, easing: cubicOut }}
			>
				{#if showName}
					<span class="who">
						{m.sender_id === uid() ? 'You' : data.peer.display_name}
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
			placeholder="Message… (Enter to send, Shift+Enter newline)"
			bind:value={body}
			on:keydown={onKey}
		></textarea>
		<button type="button" class="send" disabled={!body.trim() || sending} on:click={() => submit()}>
			Send
		</button>
	</div>
</div>

<style>
	.thread-page {
		max-width: 640px;
		margin: 0 auto;
		padding: 1rem 1rem 1.5rem;
		font-family: Roboto, system-ui, sans-serif;
		display: flex;
		flex-direction: column;
		height: calc(100vh - 120px);
		min-height: 320px;
		box-sizing: border-box;
	}
	.head {
		flex-shrink: 0;
		margin-bottom: 0.75rem;
	}
	.back {
		font-size: 0.85rem;
		color: var(--color-link);
		text-decoration: none;
	}
	.back:hover {
		text-decoration: underline;
	}
	.peer {
		margin: 0.35rem 0 0;
		font-size: 1.25rem;
	}
	.sub {
		margin: 0.15rem 0 0;
		font-size: 0.82rem;
		color: var(--color-text-muted);
	}
	.err {
		color: var(--color-danger);
		font-size: 0.88rem;
	}
	.log {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.5rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.msg-wrap {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		max-width: 85%;
		animation: msgIn 0.18s var(--social-ease-out);
	}
	.msg-wrap.mine {
		align-self: flex-end;
		align-items: flex-end;
	}
	@keyframes msgIn {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.who {
		font-size: 0.72rem;
		color: var(--color-text-muted);
		margin-bottom: 0.15rem;
	}
	.bubble {
		padding: 0.45rem 0.65rem;
		border-radius: 12px;
		background: var(--color-surface-muted);
		border: 1px solid var(--color-border);
		font-size: 0.92rem;
		line-height: 1.35;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.msg-wrap.mine .bubble {
		background: color-mix(in oklab, var(--color-accent) 18%, var(--color-surface-muted));
		border-color: color-mix(in oklab, var(--color-accent) 35%, var(--color-border));
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
		min-height: 2.5rem;
		max-height: 8rem;
		resize: vertical;
		padding: 0.5rem 0.6rem;
		border-radius: var(--social-radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-input-bg);
		color: var(--color-text);
		font: inherit;
	}
	textarea:focus-visible {
		outline: none;
		box-shadow: var(--social-ring);
	}
	.send {
		border-radius: var(--social-radius-sm);
		border: 1px solid var(--color-border-strong);
		background: color-mix(in oklab, var(--color-accent) 22%, transparent);
		color: var(--color-text);
		font: inherit;
		padding: 0.45rem 0.85rem;
		cursor: pointer;
	}
	.send:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>
