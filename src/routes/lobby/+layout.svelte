<div class="lobby-shell">
	<slot />
</div>

<style>
	/* app.css sets user-select: none on * for the tabletop; re-enable selection in lobby UIs */
	.lobby-shell :global(*) {
		user-select: text;
		cursor: revert;
	}
</style>
