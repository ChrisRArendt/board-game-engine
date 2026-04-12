<script lang="ts">
	import { connectionLog } from '$lib/stores/network';
	import { settings, persistSettings } from '$lib/stores/settings';
	import { connect } from '$lib/stores/network';

	const hosts = [
		{ v: 'localhost', label: 'Localhost (same app port)' },
		{ v: '127.0.0.1', label: '127.0.0.1' }
	];

	function doConnect() {
		const name = $settings.connectionUsername;
		persistSettings({ connectionUsername: name });
		// Same-origin: Vite serves Socket.IO on the same port
		connect(undefined, name);
	}
</script>

<div class="conn">
	<div class="row">
		<button type="button" class="btn" on:click={doConnect}>Connect</button>
		<select
			bind:value={$settings.connectionAddress}
			on:change={() => persistSettings({ connectionAddress: $settings.connectionAddress })}
		>
			{#each hosts as h}
				<option value={h.v}>{h.label}</option>
			{/each}
		</select>
		<select
			bind:value={$settings.connectionUsername}
			on:change={() => persistSettings({ connectionUsername: $settings.connectionUsername })}
		>
			<option value="Guest">Guest</option>
			<option value="DanO">DanO</option>
			<option value="Eggzavier">Eggzavier</option>
			<option value="Ruluzz">Ruluzz</option>
			<option value="SlyFive">SlyFive</option>
		</select>
	</div>
	<div class="log">
		{#each $connectionLog as line}
			<p>{line}</p>
		{/each}
	</div>
</div>

<style>
	.conn {
		width: 300px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		padding-bottom: 8px;
		border-bottom: 3px double #ccc;
	}
	.btn {
		padding: 4px 10px;
		cursor: pointer;
	}
	.log {
		height: 150px;
		overflow: auto;
		font-size: 11px;
		margin-top: 8px;
	}
</style>
