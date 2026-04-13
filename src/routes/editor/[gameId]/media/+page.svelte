<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import MediaLibrary from '$lib/components/editor/MediaLibrary.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<h1 class="title">Media library</h1>
<MediaLibrary
	gameId={data.game.id}
	media={data.media}
	usedMediaIds={data.usedMediaIds}
	onChanged={() => void invalidateAll()}
/>

<style>
	.title {
		margin: 0;
		padding: 1rem 1.25rem 0;
		font-size: 1.25rem;
		color: var(--color-text);
	}
</style>
