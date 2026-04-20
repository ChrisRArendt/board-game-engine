<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { dmSheetConversationId } from '$lib/stores/dmSheet';
	import ConversationThread from '$lib/components/messaging/ConversationThread.svelte';

	export let userId: string;

	let cid: string | null = null;
	let narrow =
		browser && typeof window !== 'undefined'
			? window.matchMedia('(max-width: 768px)').matches
			: false;

	const unsub = dmSheetConversationId.subscribe((v) => {
		cid = v;
	});

	function close() {
		dmSheetConversationId.set(null);
	}

	function onBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).dataset?.backdrop === '1') close();
	}

	onMount(() => {
		if (!browser) return;
		const mq = window.matchMedia('(max-width: 768px)');
		const onMq = () => {
			narrow = mq.matches;
			if (!narrow) dmSheetConversationId.set(null);
		};
		mq.addEventListener('change', onMq);
		return () => mq.removeEventListener('change', onMq);
	});

	$: if (browser && typeof document !== 'undefined') {
		document.body.classList.toggle('dm-sheet-open', !!(cid && narrow));
	}

	onDestroy(() => {
		unsub();
		if (browser && typeof document !== 'undefined') {
			document.body.classList.remove('dm-sheet-open');
		}
	});
</script>

{#if cid && narrow}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="dm-backdrop" data-backdrop="1" role="presentation" on:click={onBackdropClick}>
		<div
			class="dm-sheet"
			role="dialog"
			aria-modal="true"
			aria-label="Direct messages"
			tabindex="-1"
			on:click|stopPropagation
		>
			<ConversationThread
				conversationId={cid}
				{userId}
				peer={null}
				variant="sheet"
				onClose={close}
			/>
		</div>
	</div>
{/if}

<style>
	.dm-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgba(15, 15, 20, 0.55);
		backdrop-filter: blur(3px);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: 0;
		animation: dmFade 0.2s ease;
	}
	.dm-sheet {
		width: 100%;
		max-width: 560px;
		max-height: min(92dvh, 760px);
		background: var(--color-surface, #15151c);
		border: 1px solid var(--color-border);
		border-bottom: none;
		border-radius: 16px 16px 0 0;
		box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.45);
		display: flex;
		flex-direction: column;
		animation: dmSlide 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}
	@keyframes dmFade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes dmSlide {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.dm-backdrop,
		.dm-sheet {
			animation: none;
		}
	}
</style>

