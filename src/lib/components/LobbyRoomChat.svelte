<script lang="ts">
	import { afterUpdate } from 'svelte';
	import { get } from 'svelte/store';
	import { lobbyChatMessages, sendLobbyChat } from '$lib/stores/network';
	import { parseAtMentions } from '$lib/chatMentions';
	import { initialsFromDisplayName, avatarFallbackHue } from '$lib/avatar';

	export let userId: string;
	export let displayName: string;
	export let avatarUrl: string | null | undefined = undefined;

	let input = '';
	let box: HTMLDivElement | undefined;
	let lastScrolledCount = 0;
	/** Message ids whose avatar image failed to load (show initials). */
	let avatarLoadErr: Record<string, true> = {};

	afterUpdate(() => {
		const n = get(lobbyChatMessages).length;
		if (n === 0) {
			lastScrolledCount = 0;
			return;
		}
		if (n !== lastScrolledCount && box) {
			lastScrolledCount = n;
			box.scrollTop = box.scrollHeight;
		}
	});

	function send() {
		if (
			!sendLobbyChat(input, {
				userId,
				name: displayName,
				avatarUrl: avatarUrl ?? null
			})
		)
			return;
		input = '';
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function fmt(ts: number) {
		try {
			return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
		} catch {
			return '';
		}
	}

	function fallbackBg(name: string) {
		const hue = avatarFallbackHue(name || 'u');
		return `linear-gradient(135deg, hsl(${hue}, 55%, 42%), hsl(${(hue + 40) % 360}, 50%, 32%))`;
	}

	function onImgErr(id: string) {
		avatarLoadErr = { ...avatarLoadErr, [id]: true };
	}
</script>

<div class="chat">
	<h3 class="title">Lobby chat</h3>
	<div class="log" bind:this={box}>
		{#each $lobbyChatMessages as m (m.id)}
			<div class="row" class:self={m.userId === userId}>
				<div
					class="avatar"
					style:background={m.avatarUrl && !avatarLoadErr[m.id] ? undefined : fallbackBg(m.name)}
				>
					{#if m.avatarUrl && !avatarLoadErr[m.id]}
						<img
							src={m.avatarUrl}
							alt=""
							referrerpolicy="no-referrer"
							on:error={() => onImgErr(m.id)}
						/>
					{:else}
						<span class="initials">{initialsFromDisplayName(m.name)}</span>
					{/if}
				</div>
				<div class="body">
					<div class="head">
						<span class="author">{m.name}</span>
						<time class="time" datetime={new Date(m.ts).toISOString()}>{fmt(m.ts)}</time>
					</div>
					<div class="content">
						{#each parseAtMentions(m.text) as part, partIdx (`${m.id}-${partIdx}`)}
							{#if part.kind === 'mention'}
								<span class="mention">{part.value}</span>
							{:else}
								<span class="plain">{part.value}</span>
							{/if}
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<p class="empty">No messages yet — say hi before you start.</p>
		{/each}
	</div>
	<div class="composer">
		<input
			type="text"
			maxlength="2000"
			placeholder="Message the lobby…"
			bind:value={input}
			on:keydown={onKey}
		/>
		<button type="button" class="send" disabled={!input.trim()} on:click={send}>Send</button>
	</div>
</div>

<style>
	.chat {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: #313338;
	}
	.log {
		height: 220px;
		flex-shrink: 0;
		overflow-y: auto;
		overflow-x: hidden;
		border: 1px solid #e3e5e8;
		border-radius: 8px;
		padding: 0.65rem 0.75rem;
		background: #f2f3f5;
		font-size: 0.9375rem;
	}
	.empty {
		margin: 0.5rem 0;
		color: #72767d;
		font-size: 0.85rem;
	}
	.row {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding: 0.2rem 0;
		border-radius: 4px;
	}
	.row:hover {
		background: rgba(0, 0, 0, 0.03);
	}
	.avatar {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border-radius: 50%;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.initials {
		font-size: 0.72rem;
		font-weight: 700;
		color: #fff;
		text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
		user-select: none;
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		line-height: 1.25;
	}
	.author {
		font-weight: 600;
		color: #1e1f22;
		font-size: 1em;
	}
	.self .author {
		color: #1d4ed8;
	}
	.time {
		font-size: 0.7rem;
		color: #72767d;
		font-weight: 500;
		flex-shrink: 0;
	}
	.content {
		margin-top: 0.15rem;
		line-height: 1.375;
		color: #313338;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.plain {
		white-space: pre-wrap;
	}
	.mention {
		padding: 0 0.15rem;
		border-radius: 3px;
		background: rgba(88, 101, 242, 0.28);
		color: #4752c4;
		font-weight: 500;
	}
	.composer {
		display: flex;
		gap: 0.35rem;
	}
	.composer input {
		flex: 1;
		min-width: 0;
		padding: 0.5rem 0.65rem;
		border: 1px solid #e3e5e8;
		border-radius: 8px;
		font-size: 0.9rem;
		background: #fff;
	}
	.composer input::placeholder {
		color: #949ba4;
	}
	.send {
		padding: 0.45rem 0.75rem;
		border-radius: 8px;
		border: 1px solid #e3e5e8;
		background: #fff;
		cursor: pointer;
		font-size: 0.88rem;
		font-weight: 500;
	}
	.send:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.send:not(:disabled):hover {
		background: #f2f3f5;
	}
</style>
