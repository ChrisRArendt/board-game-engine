<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import { persistVoiceDevicePrefs, voiceDevicePrefs } from '$lib/stores/voiceSettings';
	import { applyVoiceOutputSink, refreshLocalAudio } from '$lib/stores/voiceChat';

	let micDevices: MediaDeviceInfo[] = [];
	let speakerDevices: MediaDeviceInfo[] = [];

	let testStream: MediaStream | null = null;
	let testCtx: AudioContext | null = null;
	let testAnalyser: AnalyserNode | null = null;
	let testRaf = 0;
	let micLevel = 0;

	async function refreshDeviceLists() {
		if (!browser || !navigator.mediaDevices?.enumerateDevices) return;
		const list = await navigator.mediaDevices.enumerateDevices();
		micDevices = list.filter((d) => d.kind === 'audioinput');
		speakerDevices = list.filter((d) => d.kind === 'audiooutput');
	}

	function stopMicTest() {
		if (testRaf) {
			cancelAnimationFrame(testRaf);
			testRaf = 0;
		}
		if (testStream) {
			for (const t of testStream.getTracks()) t.stop();
			testStream = null;
		}
		if (testCtx) {
			void testCtx.close().catch(() => {});
			testCtx = null;
		}
		testAnalyser = null;
		micLevel = 0;
	}

	async function startMicTest() {
		stopMicTest();
		if (!browser) return;
		const prefs = $voiceDevicePrefs;
		try {
			testStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					...(prefs.preferredMicId ? { deviceId: { exact: prefs.preferredMicId } } : {})
				},
				video: false
			});
			testCtx = new AudioContext();
			const src = testCtx.createMediaStreamSource(testStream);
			testAnalyser = testCtx.createAnalyser();
			testAnalyser.fftSize = 256;
			const g = testCtx.createGain();
			g.gain.value = prefs.inputGain;
			src.connect(g).connect(testAnalyser);

			const tick = () => {
				if (!testAnalyser) return;
				const buf = new Float32Array(testAnalyser.fftSize);
				testAnalyser.getFloatTimeDomainData(buf);
				let sum = 0;
				for (let i = 0; i < buf.length; i++) {
					const x = buf[i];
					sum += x * x;
				}
				micLevel = Math.min(1, Math.sqrt(sum / buf.length) * 4);
				testRaf = requestAnimationFrame(tick);
			};
			testRaf = requestAnimationFrame(tick);
		} catch (e) {
			console.warn('[bge] mic test', e);
		}
	}

	async function playSpeakerTest() {
		if (!browser) return;
		const ctx = new AudioContext();
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		g.gain.value = 0.08;
		osc.frequency.value = 440;
		osc.connect(g);
		g.connect(ctx.destination);
		const speakerId = $voiceDevicePrefs.preferredSpeakerId;
		const c = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
		if (speakerId && typeof c.setSinkId === 'function') {
			try {
				await c.setSinkId(speakerId);
			} catch {
				/* ignore */
			}
		}
		osc.start();
		setTimeout(() => {
			osc.stop();
			void ctx.close().catch(() => {});
		}, 280);
	}

	async function onMicChange(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		persistVoiceDevicePrefs({ preferredMicId: id });
		stopMicTest();
		await refreshLocalAudio();
		await startMicTest();
	}

	async function onSpeakerChange(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		persistVoiceDevicePrefs({ preferredSpeakerId: id });
		await applyVoiceOutputSink();
	}

	function onGainInput(e: Event) {
		const v = parseFloat((e.currentTarget as HTMLInputElement).value);
		persistVoiceDevicePrefs({ inputGain: v });
		void refreshLocalAudio();
	}

	onMount(() => {
		void refreshDeviceLists();
		if (browser) {
			navigator.mediaDevices?.addEventListener?.('devicechange', refreshDeviceLists);
			void startMicTest();
		}
	});

	onDestroy(() => {
		stopMicTest();
		if (browser) {
			navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDeviceLists);
		}
	});
</script>

<div class="voice-set">
	<p class="hint">Pick devices and test levels. Changes apply to voice chat when connected.</p>

	<label class="row">
		<span>Microphone</span>
		<select
			value={$voiceDevicePrefs.preferredMicId}
			onchange={onMicChange}
		>
			<option value="">Default</option>
			{#each micDevices as d (d.deviceId)}
				<option value={d.deviceId}>{d.label || d.deviceId.slice(0, 8)}</option>
			{/each}
		</select>
	</label>

	<label class="row">
		<span>Speaker / output</span>
		<select
			value={$voiceDevicePrefs.preferredSpeakerId}
			onchange={onSpeakerChange}
		>
			<option value="">Default</option>
			{#each speakerDevices as d (d.deviceId)}
				<option value={d.deviceId}>{d.label || d.deviceId.slice(0, 8)}</option>
			{/each}
		</select>
	</label>

	<div class="row meter-row">
		<span>Mic level (test)</span>
		<div class="meter" aria-hidden="true">
			<div class="meter-fill" style:width="{micLevel * 100}%"></div>
		</div>
	</div>

	<label class="row">
		<span>Input gain ({Math.round($voiceDevicePrefs.inputGain * 100)}%)</span>
		<input
			type="range"
			min="0"
			max="2"
			step="0.05"
			value={$voiceDevicePrefs.inputGain}
			oninput={onGainInput}
		/>
	</label>

	<div class="row actions">
		<button type="button" class="btn" onclick={() => void startMicTest()}>Restart mic test</button>
		<button type="button" class="btn" onclick={() => void playSpeakerTest()}>Play test tone</button>
		<button type="button" class="btn ghost" onclick={() => void refreshDeviceLists()}>Refresh devices</button>
	</div>
</div>

<style>
	.voice-set {
		min-width: 320px;
		max-width: 420px;
		padding: 4px 0;
		font-size: 14px;
	}
	.hint {
		margin: 0 0 12px;
		opacity: 0.85;
		line-height: 1.4;
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 14px;
	}
	.row span {
		font-weight: 600;
	}
	select,
	input[type='range'] {
		width: 100%;
	}
	.meter {
		height: 10px;
		background: var(--color-border);
		border-radius: 4px;
		overflow: hidden;
	}
	.meter-fill {
		height: 100%;
		background: linear-gradient(90deg, #2a7, #4c4);
		transition: width 50ms linear;
	}
	.actions {
		flex-direction: row;
		flex-wrap: wrap;
		gap: 8px;
	}
	.btn {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface-muted);
		color: var(--color-text);
		cursor: pointer;
		font-size: 13px;
	}
	.btn.ghost {
		opacity: 0.85;
	}
</style>
