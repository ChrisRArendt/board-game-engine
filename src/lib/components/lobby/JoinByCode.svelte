<script lang="ts">
	export let joinCode = '';
	export let loading = false;
	export let onJoin: () => void = () => {};
</script>

<div class="join-by-code">
	<label class="sr-only" for="join-code-input">Invite code</label>
	<div class="row">
		<input
			id="join-code-input"
			type="text"
			placeholder="Invite code"
			autocomplete="off"
			bind:value={joinCode}
			disabled={loading}
			on:keydown={(e) => e.key === 'Enter' && onJoin()}
		/>
		<button type="button" class="btn" disabled={loading} on:click={onJoin}>Join</button>
	</div>
</div>

<style>
	.join-by-code {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid color-mix(in oklab, var(--color-text) 8%, transparent);
	}
	.row {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
		flex-wrap: wrap;
	}
	input {
		flex: 1;
		min-width: 140px;
		padding: 0.45rem 0.6rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
	}
	input:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}
	.btn {
		padding: 0.45rem 0.85rem;
		border-radius: 8px;
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface-muted);
		color: var(--color-text);
		cursor: pointer;
		font: inherit;
		font-weight: 500;
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.btn:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
</style>
