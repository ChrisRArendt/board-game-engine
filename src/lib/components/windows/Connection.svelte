<script lang="ts">
	import { connected, connectionLog } from '$lib/stores/network';
</script>

<div class="conn">
	<p class="status" class:ok={$connected}>
		{$connected ? 'Connected to Supabase Realtime' : 'Not connected — open from a game (/play/…)'}
	</p>
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
	.status {
		font-size: 12px;
		margin: 0 0 8px;
		padding: 6px 8px;
		background: #fee2e2;
		border-radius: 4px;
		color: #991b1b;
	}
	.status.ok {
		background: #dcfce7;
		color: #166534;
	}
	.log {
		height: 150px;
		overflow: auto;
		font-size: 11px;
		margin-top: 8px;
	}
</style>
