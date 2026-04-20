import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '$lib/supabase/client';
import { allowVoiceAutoReconnectAfterRefresh } from '$lib/browser/ios';
import { buildIceServers, turnRelayConfigured } from '$lib/voice/iceServers';
import { friendVoicePrefs, getEffectivePeerVolume, voiceDevicePrefs } from './voiceSettings';

// #region agent log
function bgeVoiceDbg(
	hypothesisId: string,
	location: string,
	message: string,
	data: Record<string, unknown>
) {
	if (!browser || !import.meta.env.DEV) return;
	const payload = {
		sessionId: 'f22ac7',
		hypothesisId,
		location,
		message,
		data: { ...data, selfTail: typeof selfUserId === 'string' ? selfUserId.slice(-8) : '' },
		timestamp: Date.now()
	};
	console.info('[bge-voice]', JSON.stringify(payload));
}
// #endregion

export type VoicePeerUI = {
	userId: string;
	displayName: string;
	/** From presence / offer; may be null if peer uses an older client */
	avatarUrl: string | null;
	/** e.g. email (you) or @username for others */
	subtitle: string | null;
	speaking: boolean;
	connectionState: RTCPeerConnectionState;
};

/** Passed when joining voice so peers can show your card and you broadcast profile in offers/presence */
export type VoicePresencePayload = {
	userId: string;
	displayName: string;
	avatarUrl?: string | null;
	/** Shown under name: typically your email on your own card; @username for others when shared */
	subtitle?: string | null;
};

export type VoiceChatState = {
	joined: boolean;
	roomId: string | null;
	localStream: MediaStream | null;
	muted: boolean;
	deafened: boolean;
	/** True when your mic picks up speech (same RMS heuristic as remote peers) */
	localSpeaking: boolean;
	peers: Record<string, VoicePeerUI>;
	error: string | null;
};

const initialState: VoiceChatState = {
	joined: false,
	roomId: null,
	localStream: null,
	muted: false,
	deafened: false,
	localSpeaking: false,
	peers: {},
	error: null
};

export const voiceChatState = writable<VoiceChatState>({ ...initialState });

let voiceChannel: RealtimeChannel | null = null;
let supabase = createSupabaseBrowserClient();
let selfUserId = '';
let selfDisplayName = '';
let selfAvatarUrl: string | null = null;
let selfSubtitle: string | null = null;
let localStream: MediaStream | null = null;
let localRawStream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let speakingTimer: ReturnType<typeof setInterval> | null = null;
let unsubPrefs: (() => void) | null = null;
let localMicAnalyser: AnalyserNode | null = null;
let localMicSource: MediaStreamAudioSourceNode | null = null;
let localMicSilentGain: GainNode | null = null;

/** After meterGain, remote RMS ~3.5× higher so quiet mobile uplinks still trip “speaking” (playback is unboosted) */
const REMOTE_METER_BOOST = 3.5;
/** Float time-domain RMS threshold on the boosted meter branch */
const SPEAK_RMS_REMOTE = 0.015;
const SPEAK_RMS_LOCAL = 0.02;

type PeerInternal = {
	pc: RTCPeerConnection;
	remoteUserId: string;
	peerGain: GainNode;
	analyser: AnalyserNode;
	meterGain: GainNode;
	meterSilent: GainNode;
	sourceNode: MediaStreamAudioSourceNode | null;
};

const peersInternal = new Map<string, PeerInternal>();
const pendingRemoteIce = new Map<string, RTCIceCandidateInit[]>();
const pendingLocalIce = new Map<string, RTCIceCandidateInit[]>();
/** Debug: max boosted RMS per remote peer within 4s window (hypothesis C) */
const dbgRemoteRmsWindow = new Map<string, number>();
let dbgPeerRmsLastFlush = 0;

function shouldInitiateOffer(a: string, b: string): boolean {
	return a.localeCompare(b) < 0;
}

function emitState(patch: Partial<VoiceChatState>) {
	voiceChatState.update((s) => ({ ...s, ...patch }));
}

function updatePeerUI(userId: string, patch: Partial<VoicePeerUI>) {
	voiceChatState.update((s) => {
		const prev = s.peers[userId] ?? {
			userId,
			displayName: 'Player',
			avatarUrl: null,
			subtitle: null,
			speaking: false,
			connectionState: 'new' as RTCPeerConnectionState
		};
		return { ...s, peers: { ...s.peers, [userId]: { ...prev, ...patch } } };
	});
}

function removePeerUI(userId: string) {
	voiceChatState.update((s) => {
		const { [userId]: _, ...rest } = s.peers;
		return { ...s, peers: rest };
	});
}

function ensureAudioGraph() {
	if (!browser) return;
	if (!audioCtx) {
		audioCtx = new AudioContext();
		masterGain = audioCtx.createGain();
		masterGain.gain.value = 1;
		masterGain.connect(audioCtx.destination);
	}
	void audioCtx.resume().catch(() => {});
	void applyVoiceOutputSink();
}

export async function applyVoiceOutputSink() {
	if (!audioCtx || !masterGain) return;
	const speakerId = get(voiceDevicePrefs).preferredSpeakerId;
	const ctx = audioCtx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
	if (speakerId && typeof ctx.setSinkId === 'function') {
		try {
			await ctx.setSinkId(speakerId);
		} catch (e) {
			console.warn('[bge] setSinkId', e);
		}
	}
}

async function acquireLocalStream(): Promise<MediaStream> {
	const prefs = get(voiceDevicePrefs);
	const audioConstraints: MediaTrackConstraints = {
		echoCancellation: true,
		noiseSuppression: true,
		autoGainControl: true,
		...(prefs.preferredMicId ? { deviceId: { exact: prefs.preferredMicId } } : {})
	};
	const raw = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
	localRawStream = raw;
	ensureAudioGraph();
	if (!audioCtx || !masterGain) return raw;
	const g = prefs.inputGain;
	if (g === 1) {
		return raw;
	}
	const src = audioCtx.createMediaStreamSource(raw);
	const gainNode = audioCtx.createGain();
	gainNode.gain.value = g;
	const dest = audioCtx.createMediaStreamDestination();
	src.connect(gainNode).connect(dest);
	return dest.stream;
}

async function flushPendingRemoteIce(remoteId: string) {
	const pc = peersInternal.get(remoteId)?.pc;
	if (!pc?.remoteDescription) return;
	const q = pendingRemoteIce.get(remoteId) ?? [];
	pendingRemoteIce.set(remoteId, []);
	for (const c of q) {
		try {
			await pc.addIceCandidate(c);
		} catch {
			/* ignore */
		}
	}
}

function broadcast(event: string, payload: Record<string, unknown>) {
	if (!voiceChannel) return;
	void voiceChannel.send({ type: 'broadcast', event, payload });
}

function closePeer(remoteId: string) {
	const p = peersInternal.get(remoteId);
	if (p) {
		try {
			p.pc.close();
		} catch {
			/* ignore */
		}
		if (p.sourceNode) {
			try {
				p.sourceNode.disconnect();
			} catch {
				/* ignore */
			}
		}
		peersInternal.delete(remoteId);
	}
	pendingRemoteIce.delete(remoteId);
	pendingLocalIce.delete(remoteId);
	removePeerUI(remoteId);
}

function closeAllPeers() {
	for (const id of [...peersInternal.keys()]) {
		closePeer(id);
	}
}

function applyPeerGain(remoteId: string) {
	const p = peersInternal.get(remoteId);
	if (!p) return;
	const mult = getEffectivePeerVolume(remoteId);
	p.peerGain.gain.value = mult;
}

function applyAllPeerGains() {
	for (const id of peersInternal.keys()) {
		applyPeerGain(id);
	}
}

function detachLocalMicAnalyser() {
	if (localMicSource) {
		try {
			localMicSource.disconnect();
		} catch {
			/* ignore */
		}
		localMicSource = null;
	}
	if (localMicSilentGain) {
		try {
			localMicSilentGain.disconnect();
		} catch {
			/* ignore */
		}
		localMicSilentGain = null;
	}
	if (localMicAnalyser) {
		try {
			localMicAnalyser.disconnect();
		} catch {
			/* ignore */
		}
		localMicAnalyser = null;
	}
}

/** Tap local send stream so we can show the same “speaking” ring on your own avatar */
function attachLocalMicAnalyser() {
	detachLocalMicAnalyser();
	if (!audioCtx || !localStream) return;
	const src = audioCtx.createMediaStreamSource(localStream);
	const analyser = audioCtx.createAnalyser();
	analyser.fftSize = 256;
	src.connect(analyser);
	/* Some browsers only pull the mic graph when the chain reaches destination — silence so nothing is heard */
	const silent = audioCtx.createGain();
	silent.gain.value = 0;
	analyser.connect(silent).connect(audioCtx.destination);
	localMicSource = src;
	localMicAnalyser = analyser;
	localMicSilentGain = silent;
}

function startSpeakingLoop() {
	if (speakingTimer) return;
	speakingTimer = setInterval(() => {
		if (!audioCtx) return;
		for (const [uid, p] of peersInternal) {
			const buf = new Float32Array(p.analyser.fftSize);
			p.analyser.getFloatTimeDomainData(buf);
			let sum = 0;
			for (let i = 0; i < buf.length; i++) {
				const x = buf[i];
				sum += x * x;
			}
			const rms = Math.sqrt(sum / buf.length);
			const prevMax = dbgRemoteRmsWindow.get(uid) ?? 0;
			if (rms > prevMax) dbgRemoteRmsWindow.set(uid, rms);
			const speaking = rms > SPEAK_RMS_REMOTE;
			const cur = get(voiceChatState).peers[uid]?.speaking;
			if (speaking !== cur) {
				updatePeerUI(uid, { speaking });
			}
		}
		const la = localMicAnalyser;
		const st = get(voiceChatState);
		if (la && !st.muted) {
			const buf = new Float32Array(la.fftSize);
			la.getFloatTimeDomainData(buf);
			let sum = 0;
			for (let i = 0; i < buf.length; i++) {
				const x = buf[i];
				sum += x * x;
			}
			const rms = Math.sqrt(sum / buf.length);
			const speaking = rms > SPEAK_RMS_LOCAL;
			if (speaking !== st.localSpeaking) {
				emitState({ localSpeaking: speaking });
			}
		} else if (st.localSpeaking) {
			emitState({ localSpeaking: false });
		}
		// #region agent log
		const now = Date.now();
		if (now - dbgPeerRmsLastFlush >= 4000 && peersInternal.size > 0) {
			dbgPeerRmsLastFlush = now;
			for (const [uid, p] of peersInternal) {
				const maxR = dbgRemoteRmsWindow.get(uid) ?? 0;
				dbgRemoteRmsWindow.set(uid, 0);
				bgeVoiceDbg('C', 'voiceChat:rmsWindow', 'peer_meter_max_4s', {
					peerTail: uid.slice(-8),
					maxRmsBoosted: Number(maxR.toFixed(6)),
					conn: p.pc.connectionState,
					ice: p.pc.iceConnectionState,
					acState: audioCtx.state
				});
			}
		}
		// #endregion
	}, 80);
}

function stopSpeakingLoop() {
	if (speakingTimer) {
		clearInterval(speakingTimer);
		speakingTimer = null;
	}
}

async function createPeerConnection(
	remoteUserId: string,
	remoteName: string,
	meta?: { avatarUrl?: string | null; subtitle?: string | null }
): Promise<RTCPeerConnection> {
	ensureAudioGraph();
	if (!audioCtx || !masterGain) throw new Error('AudioContext unavailable');

	const existing = peersInternal.get(remoteUserId);
	if (existing) return existing.pc;

	const pc = new RTCPeerConnection({
		iceServers: buildIceServers(),
		bundlePolicy: 'balanced',
		rtcpMuxPolicy: 'require',
		/** Pre-gather candidates so offers/answers converge faster when relay is available */
		iceCandidatePoolSize: turnRelayConfigured() ? 8 : 0
	});

	const peerGain = audioCtx.createGain();
	applyPeerGain(remoteUserId);
	peerGain.connect(masterGain);

	const analyser = audioCtx.createAnalyser();
	analyser.fftSize = 256;
	const meterGain = audioCtx.createGain();
	meterGain.gain.value = REMOTE_METER_BOOST;
	const meterSilent = audioCtx.createGain();
	meterSilent.gain.value = 0;
	/* Meter branch only — playback goes src → peerGain so quiet mobile sends don’t affect heard level */
	analyser.connect(meterSilent).connect(audioCtx.destination);

	peersInternal.set(remoteUserId, {
		pc,
		remoteUserId,
		peerGain,
		analyser,
		meterGain,
		meterSilent,
		sourceNode: null
	});

	updatePeerUI(remoteUserId, {
		userId: remoteUserId,
		displayName: remoteName,
		avatarUrl: meta?.avatarUrl ?? null,
		subtitle: meta?.subtitle ?? null,
		speaking: false,
		connectionState: pc.connectionState
	});

	pc.onconnectionstatechange = () => {
		updatePeerUI(remoteUserId, { connectionState: pc.connectionState });
		// #region agent log
		bgeVoiceDbg('A', 'voiceChat:connState', 'pc_connection', {
			peerTail: remoteUserId.slice(-8),
			connectionState: pc.connectionState,
			iceConnectionState: pc.iceConnectionState
		});
		// #endregion
	};

	pc.oniceconnectionstatechange = () => {
		// #region agent log
		bgeVoiceDbg('A', 'voiceChat:iceState', 'pc_ice', {
			peerTail: remoteUserId.slice(-8),
			iceConnectionState: pc.iceConnectionState,
			connectionState: pc.connectionState
		});
		// #endregion
	};

	pc.onicecandidate = (ev) => {
		if (!ev.candidate) return;
		broadcast('voice_ice', {
			from: selfUserId,
			to: remoteUserId,
			candidate: ev.candidate.toJSON()
		});
	};

	pc.ontrack = (ev) => {
		const stream = ev.streams[0];
		if (!stream) return;
		const peer = peersInternal.get(remoteUserId);
		if (!peer || !audioCtx) return;
		if (peer.sourceNode) {
			try {
				peer.sourceNode.disconnect();
			} catch {
				/* ignore */
			}
		}
		const src = audioCtx.createMediaStreamSource(stream);
		peer.sourceNode = src;
		src.connect(peer.peerGain);
		src.connect(peer.meterGain);
		peer.meterGain.connect(peer.analyser);
		/* Desktop often keeps AudioContext suspended until explicit resume; remote RTP can arrive without unlocking output. */
		void audioCtx.resume();
		const t = ev.track;
		// #region agent log
		bgeVoiceDbg('B', 'voiceChat:ontrack', 'remote_track', {
			peerTail: remoteUserId.slice(-8),
			kind: t?.kind,
			muted: t?.muted,
			readyState: t?.readyState,
			id: t?.id,
			acState: audioCtx.state
		});
		// #endregion
		if (t) {
			t.addEventListener(
				'unmute',
				() => {
					// #region agent log
					bgeVoiceDbg('B', 'voiceChat:trackUnmute', 'track_unmute', {
						peerTail: remoteUserId.slice(-8),
						muted: t.muted,
						acState: audioCtx?.state ?? 'gone'
					});
					// #endregion
					void audioCtx?.resume();
				},
				{ once: true }
			);
		}
	};

	if (localStream) {
		for (const track of localStream.getAudioTracks()) {
			pc.addTrack(track, localStream);
		}
	}

	return pc;
}

async function sendOffer(
	remoteUserId: string,
	remoteName: string,
	remoteMeta?: { avatarUrl?: string | null; subtitle?: string | null }
) {
	if (peersInternal.has(remoteUserId)) return;
	const pc = await createPeerConnection(remoteUserId, remoteName, remoteMeta);
	// #region agent log
	bgeVoiceDbg('D', 'voiceChat:sendOffer', 'initiating_offer', { toTail: remoteUserId.slice(-8) });
	// #endregion
	const offer = await pc.createOffer();
	await pc.setLocalDescription(offer);
	broadcast('voice_offer', {
		from: selfUserId,
		to: remoteUserId,
		name: selfDisplayName,
		avatar_url: selfAvatarUrl,
		subtitle: selfSubtitle,
		sdp: { type: pc.localDescription!.type, sdp: pc.localDescription!.sdp }
	});
}

async function handleRemoteOffer(
	from: string,
	fromName: string | undefined,
	sdp: RTCSessionDescriptionInit,
	meta?: { avatarUrl?: string | null; subtitle?: string | null }
) {
	if (peersInternal.has(from)) return;
	// #region agent log
	bgeVoiceDbg('D', 'voiceChat:handleRemoteOffer', 'incoming_offer', { fromTail: from.slice(-8) });
	// #endregion
	const pc = await createPeerConnection(from, fromName ?? 'Player', meta);
	await pc.setRemoteDescription(new RTCSessionDescription(sdp));
	await flushPendingRemoteIce(from);
	const answer = await pc.createAnswer();
	await pc.setLocalDescription(answer);
	broadcast('voice_answer', {
		from: selfUserId,
		to: from,
		sdp: { type: pc.localDescription!.type, sdp: pc.localDescription!.sdp }
	});
}

async function handleRemoteAnswer(from: string, sdp: RTCSessionDescriptionInit) {
	const peer = peersInternal.get(from);
	if (!peer) return;
	await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
	await flushPendingRemoteIce(from);
}

async function handleRemoteIce(from: string, candidate: RTCIceCandidateInit) {
	const peer = peersInternal.get(from);
	if (!peer?.pc.remoteDescription) {
		const q = pendingRemoteIce.get(from) ?? [];
		q.push(candidate);
		pendingRemoteIce.set(from, q);
		return;
	}
	try {
		await peer.pc.addIceCandidate(candidate);
	} catch {
		const q = pendingRemoteIce.get(from) ?? [];
		q.push(candidate);
		pendingRemoteIce.set(from, q);
	}
}

function presencePeers(ch: RealtimeChannel): {
	userId: string;
	name: string;
	avatarUrl: string | null;
	subtitle: string | null;
}[] {
	const state = ch.presenceState();
	const out: {
		userId: string;
		name: string;
		avatarUrl: string | null;
		subtitle: string | null;
	}[] = [];
	for (const key of Object.keys(state)) {
		const presences = state[key] as {
			user_id?: string;
			name?: string;
			avatar_url?: string | null;
			subtitle?: string | null;
		}[];
		const meta = presences?.[0];
		const uid = meta?.user_id ?? key;
		if (!uid || uid === selfUserId) continue;
		out.push({
			userId: uid,
			name: meta?.name ?? 'Player',
			avatarUrl: meta?.avatar_url ?? null,
			subtitle: meta?.subtitle ?? null
		});
	}
	return out;
}

function syncPeersFromPresence(ch: RealtimeChannel) {
	const list = presencePeers(ch);
	const ids = new Set(list.map((p) => p.userId));
	for (const id of peersInternal.keys()) {
		if (!ids.has(id)) {
			closePeer(id);
		}
	}
	for (const p of list) {
		updatePeerUI(p.userId, {
			displayName: p.name,
			avatarUrl: p.avatarUrl,
			subtitle: p.subtitle
		});
		if (!peersInternal.has(p.userId) && shouldInitiateOffer(selfUserId, p.userId)) {
			void sendOffer(p.userId, p.name, {
				avatarUrl: p.avatarUrl,
				subtitle: p.subtitle
			}).catch((e) => console.warn('[bge] sendOffer', e));
		}
	}
}

function wireBroadcastHandlers(ch: RealtimeChannel) {
	ch.on('broadcast', { event: 'voice_offer' }, ({ payload }) => {
		const p = payload as {
			from?: string;
			to?: string;
			sdp?: RTCSessionDescriptionInit;
			name?: string;
			avatar_url?: string | null;
			subtitle?: string | null;
		};
		if (p.to !== selfUserId || !p.from || !p.sdp) return;
		void handleRemoteOffer(p.from, p.name, p.sdp, {
			avatarUrl: p.avatar_url ?? null,
			subtitle: p.subtitle ?? null
		}).catch((e) => console.warn('[bge] voice_offer', e));
	});
	ch.on('broadcast', { event: 'voice_answer' }, ({ payload }) => {
		const p = payload as { from?: string; to?: string; sdp?: RTCSessionDescriptionInit };
		if (p.to !== selfUserId || !p.from || !p.sdp) return;
		void handleRemoteAnswer(p.from, p.sdp).catch((e) => console.warn('[bge] voice_answer', e));
	});
	ch.on('broadcast', { event: 'voice_ice' }, ({ payload }) => {
		const p = payload as { from?: string; to?: string; candidate?: RTCIceCandidateInit };
		if (p.to !== selfUserId || !p.from || !p.candidate) return;
		void handleRemoteIce(p.from, p.candidate);
	});
}

/**
 * Join voice for a lobby (stays connected across client nav until leaveVoiceRoom).
 */
export async function joinVoiceRoom(lobbyId: string, presence: VoicePresencePayload): Promise<void> {
	if (!browser) return;
	if (get(voiceChatState).joined && get(voiceChatState).roomId === lobbyId) {
		return;
	}
	emitState({ error: null });
	selfUserId = presence.userId;
	selfDisplayName = presence.displayName;
	selfAvatarUrl = presence.avatarUrl ?? null;
	selfSubtitle = presence.subtitle ?? null;

	if (get(voiceChatState).joined) {
		await leaveVoiceRoom();
	}

	try {
		localStream = await acquireLocalStream();
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Microphone permission denied';
		emitState({ error: msg, joined: false });
		throw e;
	}

	supabase = createSupabaseBrowserClient();
	const topic = `voice:${lobbyId}`;
	const ch = supabase.channel(topic, {
		config: {
			broadcast: { self: false },
			presence: { key: presence.userId }
		}
	});

	wireBroadcastHandlers(ch);

	ch.on('presence', { event: 'sync' }, () => {
		syncPeersFromPresence(ch);
	});
	ch.on('presence', { event: 'join' }, ({ key, newPresences }) => {
		const meta = (newPresences as {
			user_id?: string;
			name?: string;
			avatar_url?: string | null;
			subtitle?: string | null;
		}[])?.[0];
		const uid = meta?.user_id ?? key;
		if (!uid || uid === selfUserId) return;
		updatePeerUI(uid, {
			displayName: meta?.name ?? 'Player',
			avatarUrl: meta?.avatar_url ?? null,
			subtitle: meta?.subtitle ?? null
		});
		if (shouldInitiateOffer(selfUserId, uid)) {
			void sendOffer(uid, meta?.name ?? 'Player', {
				avatarUrl: meta?.avatar_url ?? null,
				subtitle: meta?.subtitle ?? null
			}).catch((e) => console.warn('[bge] offer', e));
		}
	});
	ch.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
		const meta = (leftPresences as { user_id?: string }[])?.[0];
		const uid = meta?.user_id ?? key;
		if (uid && uid !== selfUserId) closePeer(uid);
	});

	await new Promise<void>((resolve, reject) => {
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				voiceChannel = ch;
				await ch.track({
					user_id: selfUserId,
					name: selfDisplayName,
					avatar_url: selfAvatarUrl,
					subtitle: selfSubtitle
				});
				syncPeersFromPresence(ch);
				attachLocalMicAnalyser();
				startSpeakingLoop();

				unsubPrefs?.();
				unsubPrefs = friendVoicePrefs.subscribe(() => applyAllPeerGains());

				voiceChatState.update((s) => ({
					...s,
					joined: true,
					roomId: lobbyId,
					localStream,
					muted: false,
					deafened: false,
					localSpeaking: false,
					error: null
				}));
				applyDeafenGain();
				if (!turnRelayConfigured() && import.meta.env.PROD) {
					console.warn(
						'[bge] Voice: no PUBLIC_TURN_URL — mesh audio often fails across NAT/firewalls (one device hears all; laptops hear nothing). Configure TURN in production.'
					);
				}
				// #region agent log
				bgeVoiceDbg('E', 'voiceChat:joined', 'turn_relay_status', {
					relay: turnRelayConfigured(),
					prod: import.meta.env.PROD,
					/** 2 = STUN only; 3+ means at least one TURN URL made it into the client bundle */
					iceServerCount: buildIceServers().length
				});
				// #endregion
				try {
					sessionStorage.setItem(`bge_voice_auto_join:${lobbyId}`, '1');
				} catch {
					/* ignore */
				}
				resolve();
			} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
				reject(new Error(`Voice channel: ${status}`));
			}
		});
	});
}

function applyDeafenGain() {
	const deaf = get(voiceChatState).deafened;
	if (masterGain) masterGain.gain.value = deaf ? 0 : 1;
}

export function setMuted(muted: boolean) {
	if (!localStream) return;
	for (const t of localStream.getAudioTracks()) {
		t.enabled = !muted;
	}
	emitState({ muted, ...(muted ? { localSpeaking: false } : {}) });
}

export function setDeafened(deafened: boolean) {
	emitState({ deafened });
	applyDeafenGain();
}

export function toggleMuted() {
	const next = !get(voiceChatState).muted;
	setMuted(next);
	return next;
}

export function toggleDeafened() {
	const next = !get(voiceChatState).deafened;
	setDeafened(next);
	return next;
}

/**
 * Call after changing mic / speaker / input gain in settings while connected.
 */
export async function refreshLocalAudio(): Promise<void> {
	if (!get(voiceChatState).joined) return;
	try {
		if (localRawStream) {
			for (const t of localRawStream.getTracks()) {
				t.stop();
			}
		}
		localStream = await acquireLocalStream();
		emitState({ localStream });
		attachLocalMicAnalyser();
		for (const [_id, peer] of peersInternal) {
			const senders = peer.pc.getSenders().filter((s) => s.track?.kind === 'audio');
			const newTrack = localStream.getAudioTracks()[0];
			for (const s of senders) {
				if (newTrack) void s.replaceTrack(newTrack);
			}
		}
	} catch (e) {
		console.warn('[bge] refreshLocalAudio', e);
	}
}

export async function leaveVoiceRoom(): Promise<void> {
	if (!browser) return;
	const rid = get(voiceChatState).roomId;
	stopSpeakingLoop();
	detachLocalMicAnalyser();
	unsubPrefs?.();
	unsubPrefs = null;
	selfAvatarUrl = null;
	selfSubtitle = null;

	closeAllPeers();

	if (voiceChannel) {
		void supabase.removeChannel(voiceChannel);
		voiceChannel = null;
	}
	if (rid) {
		try {
			sessionStorage.removeItem(`bge_voice_auto_join:${rid}`);
		} catch {
			/* ignore */
		}
	}

	if (localRawStream) {
		for (const t of localRawStream.getTracks()) {
			t.stop();
		}
		localRawStream = null;
	}
	localStream = null;

	if (audioCtx) {
		try {
			await audioCtx.close();
		} catch {
			/* ignore */
		}
		audioCtx = null;
		masterGain = null;
	}

	emitState({ ...initialState });
}

export function isVoiceJoined(): boolean {
	return get(voiceChatState).joined;
}

/** Reconnect voice after refresh if user had joined this lobby in the session. */
export function tryAutoJoinVoice(lobbyId: string, presence: VoicePresencePayload): void {
	if (!browser) return;
	if (!allowVoiceAutoReconnectAfterRefresh()) return;
	try {
		if (sessionStorage.getItem(`bge_voice_auto_join:${lobbyId}`) !== '1') return;
	} catch {
		return;
	}
	void joinVoiceRoom(lobbyId, presence).catch(() => {});
}
