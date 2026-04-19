<!-- Wraps /editor (hub) and /editor/[gameId]/* -->
<div class="editor-shell">
	<slot />
</div>

<style>
	/* Fill <main> so nested /editor routes get a bounded height (panels use overflow: auto inside). */
	.editor-shell {
		flex: 1 1 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		width: 100%;
		overflow: hidden;
		box-sizing: border-box;
	}
	/* app.css sets * { user-select: none } for tabletop; editor shell needs selectable text (match lobby/+layout) */
	.editor-shell :global(*) {
		user-select: text;
		cursor: revert;
	}
</style>
