<script lang="ts">
	import { pad } from '$lib/engine/geometry';
	import { emit } from '$lib/stores/network';
	import { appendRollerLine, rollerLog } from '$lib/stores/rollerLog';

	const tabs = [
		{ id: 'diceroller_coin', label: 'Coin' },
		{ id: 'diceroller_d4', label: 'd4' },
		{ id: 'diceroller_d6', label: 'd6' },
		{ id: 'diceroller_d8', label: 'd8' },
		{ id: 'diceroller_d10', label: 'd10' },
		{ id: 'diceroller_d12', label: 'd12' },
		{ id: 'diceroller_d20', label: 'd20' },
		{ id: 'diceroller_percent', label: 'd%' }
	];

	/** Shown next to remote rolls so everyone knows who rolled */
	export let rollerName = 'Player';

	let active = 'diceroller_d8';

	function roll() {
		let result: string | number = '';
		switch (active) {
			case 'diceroller_coin':
				result = Math.random() < 0.5 ? 'heads' : 'tails';
				break;
			case 'diceroller_d4':
				result = 1 + Math.floor(Math.random() * 4);
				break;
			case 'diceroller_d6':
				result = 1 + Math.floor(Math.random() * 6);
				break;
			case 'diceroller_d8':
				result = 1 + Math.floor(Math.random() * 8);
				break;
			case 'diceroller_d10':
				result = 1 + Math.floor(Math.random() * 10);
				break;
			case 'diceroller_d12':
				result = 1 + Math.floor(Math.random() * 12);
				break;
			case 'diceroller_d20':
				result = 1 + Math.floor(Math.random() * 20);
				break;
			case 'diceroller_percent':
				result = `${Math.floor(Math.random() * 10)}0`;
				break;
			default:
				result = '?';
		}
		const d = new Date();
		const datestr = `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;
		appendRollerLine(active, String(result), datestr);
		emit('window_roller_roll', { rollId: active, result, datestr, name: rollerName });
	}
</script>

<div class="roller">
	<div class="tabs">
		{#each tabs as t}
			<button type="button" class:active={active === t.id} on:click={() => (active = t.id)}>
				{t.label}
			</button>
		{/each}
	</div>
	<div class="body">
		<button type="button" class="rollbtn" on:click={roll}>roll</button>
		<div class="log">
			{#each $rollerLog[active] ?? [] as line}
				<p><span>{line.text}</span> <span class="muted">at {line.time}</span></p>
			{/each}
		</div>
	</div>
</div>

<style>
	.roller {
		width: 240px;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		margin-bottom: 6px;
	}
	.tabs button {
		font-size: 11px;
		padding: 2px 6px;
		cursor: pointer;
	}
	.tabs button.active {
		font-weight: bold;
		background: #bdf;
	}
	.body {
		display: flex;
		gap: 8px;
		height: 200px;
	}
	.rollbtn {
		flex: 0 0 60px;
		height: 192px;
		cursor: pointer;
	}
	.log {
		flex: 1;
		overflow: auto;
		font-size: 13px;
		max-height: 200px;
	}
	.muted {
		color: #ccc;
		font-size: 0.8em;
	}
</style>
