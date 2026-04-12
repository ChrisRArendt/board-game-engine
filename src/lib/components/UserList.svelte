<script lang="ts">
	import { users } from '$lib/stores/users';
	import UserIdentity from '$lib/components/UserIdentity.svelte';

	/** Current player (shown first as “You”). */
	export let selfDisplayName = 'You';
	export let selfAvatarUrl: string | null | undefined = undefined;
</script>

<ul class="users">
	<li>
		<UserIdentity
			variant="board"
			displayName={selfDisplayName}
			avatarUrl={selfAvatarUrl}
			showRing={true}
			ringColor="#ef4444"
		/>
	</li>
	{#each $users as user (user.id)}
		<li>
			<UserIdentity
				variant="board"
				displayName={user.name}
				avatarUrl={user.avatarUrl}
				showRing={true}
				ringColor={user.color}
			/>
		</li>
	{/each}
</ul>

<style>
	.users {
		position: fixed;
		right: 0;
		top: 70px;
		list-style: none;
		z-index: 2000000000;
	}
	.users li {
		position: relative;
		margin-bottom: 8px;
	}
</style>
