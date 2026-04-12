<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { settings, persistSettings } from '$lib/stores/settings';
	import { getLocalPlayerColor, syncLocalPresenceColor } from '$lib/stores/network';
	import { savePlayerColorToAccount } from '$lib/profile/playerColor';
	import VoiceSettings from '$lib/components/windows/VoiceSettings.svelte';

	/** `type="color"` needs hex; when using automatic, the control uses a neutral placeholder. */
	$: pickerHex = $settings.playerColor?.trim() || '#6b7280';

	let swatchColor = getLocalPlayerColor();
	$: {
		$settings;
		swatchColor = getLocalPlayerColor();
	}

	async function applyPlayerColor(hex: string) {
		persistSettings({ playerColor: hex });
		syncLocalPresenceColor();
		if ($page.data.session?.user) {
			const { ok } = await savePlayerColorToAccount(hex);
			if (ok) await invalidate('supabase:auth');
		}
	}
</script>

<ul class="set">
	<li>
		<label class="check">
			<input
				type="checkbox"
				checked={$settings.zoomWithScroll}
				onchange={(e) =>
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
				onchange={(e) =>
					persistSettings({ panScreenEdge: (e.currentTarget as HTMLInputElement).checked })}
			/>
			<span>Pan at screen edge</span>
		</label>
	</li>
	<li class="color-block">
		<div class="color-label">Your color (ring & highlights)</div>
		<p class="color-hint">
			Used for your portrait ring and selection outline. “Use automatic” picks a stable hue from your
			account. Signed-in users: saved to your profile for future sessions.
		</p>
		<div class="color-row">
			<label class="swatch-picker" title="Choose color">
				<span class="sr-only">Choose your color</span>
				<input
					class="color-input-overlay"
					type="color"
					value={pickerHex}
					onchange={(e) => applyPlayerColor((e.currentTarget as HTMLInputElement).value)}
				/>
				<span class="swatch" style:background={swatchColor} aria-hidden="true"></span>
			</label>
			<button type="button" class="reset-color" onclick={() => applyPlayerColor('')}>
				Use automatic
			</button>
		</div>
	</li>
	<li class="voice-block">
		<div class="voice-label">Voice &amp; audio</div>
		<p class="voice-hint">
			Microphone, speakers, and levels. Used when you join voice chat from the toolbar.
		</p>
		<VoiceSettings />
	</li>
</ul>

<style>
	.set {
		list-style: none;
		padding: 8px;
		margin: 0;
		width: min(400px, 92vw);
		max-height: min(85vh, 720px);
		overflow-y: auto;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		margin-bottom: 8px;
	}
	.color-block {
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid rgba(0, 0, 0, 0.1);
	}
	.color-label {
		font-size: 13px;
		font-weight: 600;
		color: #333;
		margin-bottom: 4px;
	}
	.color-hint {
		margin: 0 0 8px;
		font-size: 12px;
		line-height: 1.35;
		color: #666;
	}
	.color-row {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.swatch-picker {
		position: relative;
		display: inline-flex;
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		cursor: pointer;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
	}
	.swatch {
		position: absolute;
		inset: 0;
		pointer-events: none;
		border-radius: 6px;
		border: 1px solid rgba(0, 0, 0, 0.2);
	}
	.color-input-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		border: none;
		cursor: pointer;
		opacity: 0.001;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.reset-color {
		font-size: 12px;
		padding: 4px 10px;
		cursor: pointer;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: linear-gradient(to bottom, #f8f8f8, #e8e8e8);
	}
	.reset-color:hover {
		background: linear-gradient(to bottom, #eee, #ddd);
	}
	.voice-block {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid rgba(0, 0, 0, 0.12);
	}
	.voice-label {
		font-size: 13px;
		font-weight: 600;
		color: #333;
		margin-bottom: 4px;
	}
	.voice-hint {
		margin: 0 0 8px;
		font-size: 12px;
		line-height: 1.35;
		color: #666;
	}
	.voice-block :global(.voice-set) {
		padding-left: 0;
	}
</style>
