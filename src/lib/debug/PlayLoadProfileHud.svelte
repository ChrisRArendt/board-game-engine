<script lang="ts">
	import { browser } from '$app/environment';
	import {
		getLastPlayLoadProfileJson,
		isPlayLoadProfilingEnabled,
		PLAY_PROFILE_STORAGE_KEY,
		playLoadProfileLines
	} from '$lib/debug/playLoadProfile';
	import { isAppleTouchWebKit } from '$lib/browser/ios';

	let copyStatus = '';

	/** On-screen HUD only — Apple touch WebKit keeps JSON in sessionStorage (fixed layer can worsen GPU pressure). */
	$: show = browser && isPlayLoadProfilingEnabled() && !isAppleTouchWebKit();

	async function copyJson() {
		const raw = getLastPlayLoadProfileJson();
		if (!raw) {
			copyStatus = 'Nothing stored yet';
			return;
		}
		try {
			await navigator.clipboard.writeText(raw);
			copyStatus = 'Copied JSON';
		} catch {
			copyStatus = 'Copy failed — see storage key';
		}
		window.setTimeout(() => {
			copyStatus = '';
		}, 2000);
	}
</script>

{#if show}
	<div class="bge-play-profiler" aria-live="polite">
		<div class="bge-play-profiler-head">
			<span class="bge-play-profiler-title">Play load profile</span>
			<button type="button" class="bge-play-profiler-copy" onclick={copyJson}>Copy JSON</button>
		</div>
		{#if copyStatus}
			<p class="bge-play-profiler-status">{copyStatus}</p>
		{/if}
		<pre class="bge-play-profiler-pre">{$playLoadProfileLines.join('\n')}</pre>
		<p class="bge-play-profiler-hint">
			Also saved under <code>{PLAY_PROFILE_STORAGE_KEY}</code> (updates each step). After a crash, reopen
			the site and check Application → Session Storage, or use Copy.
		</p>
	</div>
{/if}

<style>
	.bge-play-profiler {
		position: fixed;
		right: 8px;
		bottom: 8px;
		z-index: 2147483600;
		max-width: min(420px, calc(100vw - 16px));
		max-height: min(38vh, 280px);
		display: flex;
		flex-direction: column;
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid var(--color-border, #334155);
		background: rgba(15, 23, 42, 0.94);
		color: #e2e8f0;
		font-size: 11px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
		pointer-events: auto;
		box-sizing: border-box;
	}
	.bge-play-profiler-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 6px;
		flex-shrink: 0;
	}
	.bge-play-profiler-title {
		font-weight: 600;
		color: #93c5fd;
	}
	.bge-play-profiler-copy {
		padding: 4px 8px;
		font-size: 11px;
		border-radius: 6px;
		border: 1px solid #475569;
		background: #1e293b;
		color: #e2e8f0;
		cursor: pointer;
	}
	.bge-play-profiler-copy:hover {
		background: #334155;
	}
	.bge-play-profiler-status {
		margin: 0 0 4px;
		font-size: 10px;
		color: #86efac;
	}
	.bge-play-profiler-pre {
		margin: 0;
		flex: 1;
		min-height: 0;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.35;
	}
	.bge-play-profiler-hint {
		margin: 8px 0 0;
		font-size: 10px;
		color: #94a3b8;
		line-height: 1.35;
		flex-shrink: 0;
	}
	.bge-play-profiler-hint code {
		font-size: 9px;
		color: #cbd5e1;
	}
</style>
