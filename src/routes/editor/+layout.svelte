<!-- Wraps /editor (hub) and /editor/[gameId]/* -->
<div class="editor-shell">
	<slot />
</div>

<style>
	/* app.css sets * { user-select: none } for tabletop; editor shell needs selectable text (match lobby/+layout) */
	.editor-shell :global(*) {
		user-select: text;
		cursor: revert;
	}
</style>
