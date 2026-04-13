<script lang="ts">
	import { browser } from '$app/environment';
	import type { CardLayer } from '$lib/editor/types';

	let {
		menu,
		layers,
		onClose,
		renameLayer,
		duplicateLayer,
		removeLayer
	}: {
		menu: { id: string; x: number; y: number } | null;
		layers: CardLayer[];
		onClose: () => void;
		renameLayer: (id: string, name: string) => void;
		duplicateLayer: (id: string) => void;
		removeLayer: (id: string) => void;
	} = $props();

	$effect(() => {
		if (!browser || !menu) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose();
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function menuRename() {
		if (!menu) return;
		const id = menu.id;
		const L = layers.find((l) => l.id === id);
		onClose();
		if (!L) return;
		const n = window.prompt('Name', L.name);
		if (n === null) return;
		const t = n.trim();
		renameLayer(id, t || L.name);
	}

	function menuDuplicate() {
		if (!menu) return;
		const id = menu.id;
		onClose();
		duplicateLayer(id);
	}

	function menuRemove() {
		if (!menu) return;
		const id = menu.id;
		onClose();
		removeLayer(id);
	}
</script>

{#if menu}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="layer-ctx-backdrop" role="presentation" onclick={onClose}></div>
	<div class="layer-ctx-pop" style:left="{menu.x}px" style:top="{menu.y}px" role="menu">
		<button type="button" class="layer-ctx-item" role="menuitem" onclick={menuRename}>Rename</button>
		<button type="button" class="layer-ctx-item" role="menuitem" onclick={menuDuplicate}
			>Duplicate</button>
		<button type="button" class="layer-ctx-item danger" role="menuitem" onclick={menuRemove}
			>Remove</button>
	</div>
{/if}

<style>
	.layer-ctx-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99990;
		background: transparent;
	}
	.layer-ctx-pop {
		position: fixed;
		z-index: 99991;
		min-width: 160px;
		padding: 4px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.layer-ctx-item {
		text-align: left;
		padding: 8px 10px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: inherit;
		font-size: 13px;
		cursor: pointer;
	}
	.layer-ctx-item:hover {
		background: rgba(255, 255, 255, 0.06);
	}
	.layer-ctx-item.danger {
		color: #f87171;
	}
</style>
