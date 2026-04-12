<script lang="ts">
	import { users } from '$lib/stores/users';

	function avatarFor(name: string, connected: boolean): string {
		if (!connected) return 'avatar_disconnected.jpg';
		const n = name.toLowerCase();
		if (['dano', 'ruluzz', 'slyfive', 'eggzavier'].includes(n)) return `avatar_${n}.jpg`;
		return 'avatar_default.jpg';
	}
</script>

<ul class="users">
	<li>
		<div class="avatar default"></div>
		<p>You</p>
	</li>
	{#each $users as user (user.id)}
		<li>
			<div
				class="avatar"
				style:background-image="url(/images/userimages/{avatarFor(user.name, user.connected)})"
				style:box-shadow={user.connected
					? `0px 0px 0px 1px #000, 0px 0px 0px 4px ${user.color}, 0px 1px 2px 4px #000`
					: '0px 0px 0px 1px #000, 0px 0px 0px 4px #BBB, 0px 1px 2px 4px #000'}
			></div>
			<p>{user.name}</p>
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
	}
	.avatar {
		margin: 0 25px 40px 0;
		width: 40px;
		height: 40px;
		border-radius: 100px;
		background-size: 100% 100%;
		background-image: url(/images/userimages/avatar_default.jpg);
	}
	.avatar.default {
		box-shadow:
			0px 0px 0px 1px #000,
			0px 0px 0px 4px #f00,
			0px 1px 2px 4px #000;
	}
	.users li p {
		position: absolute;
		bottom: -20px;
		right: 0;
		width: 90px;
		font-size: 11px;
		text-align: center;
		text-shadow:
			-1px -1px 1px #000,
			1px -1px 1px #000,
			-1px 1px 1px #000,
			1px 1px 1px #000;
		color: #fff;
	}
</style>
