<script lang="ts">
	import { settings, persistSettings } from '$lib/stores/settings';
</script>

<ul class="set">
	<li>
		<label class="check">
			<input
				type="checkbox"
				checked={$settings.zoomWithScroll}
				on:change={(e) =>
					persistSettings({ zoomWithScroll: (e.currentTarget as HTMLInputElement).checked })}
			/>
			<span>Zoom with scroll wheel</span>
		</label>
	</li>
	<li>
		<label class="check">
			<input
				type="checkbox"
				checked={$settings.panScreenEdge}
				on:change={(e) =>
					persistSettings({ panScreenEdge: (e.currentTarget as HTMLInputElement).checked })}
			/>
			<span>Pan at screen edge</span>
		</label>
	</li>
</ul>

<style>
	.set {
		list-style: none;
		padding: 8px;
		margin: 0;
		width: 280px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		margin-bottom: 8px;
	}
</style>
