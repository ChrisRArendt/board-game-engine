<script lang="ts">
	import ConversationThread from '$lib/components/messaging/ConversationThread.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<svelte:head>
	<title>{data.title ?? 'Chat'}</title>
</svelte:head>

{#if data.session}
	<ConversationThread
		conversationId={data.conv.id}
		userId={data.session.user.id}
		peer={{
			id: data.peer.id,
			display_name: data.peer.display_name,
			username: data.peer.username
		}}
		variant="page"
	/>
{/if}
