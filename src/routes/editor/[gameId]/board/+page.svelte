<script lang="ts">
	import BoardEditor from '$lib/components/editor/BoardEditor.svelte';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import { customGameAssetBaseUrl } from '$lib/customGames';
	import type { GameDataJson } from '$lib/engine/types';
	import type { PageData } from './$types';

	export let data: PageData;

	const gameData = data.game.game_data as unknown as GameDataJson;
	const assetBaseUrl = customGameAssetBaseUrl(PUBLIC_SUPABASE_URL, data.game.creator_id, data.game.id);
</script>

{#if data.session?.user}
	<BoardEditor
		gameId={data.game.id}
		userId={data.session.user.id}
		gameKey={data.game.game_key}
		{assetBaseUrl}
		initialGameData={gameData}
		cardsForBoard={data.cardsForBoard}
	/>
{/if}
