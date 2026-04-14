import { env } from '$env/dynamic/public';

/**
 * Build ICE servers for RTCPeerConnection.
 * STUN is always included; TURN relay is optional via PUBLIC_TURN_* env.
 * Without TURN, mesh voice often fails asymmetrically across NATs (e.g. laptops hear nobody
 * while a phone on cellular still receives) — use a relay (Metered, Twilio, Cloudflare, etc.).
 *
 * PUBLIC_TURN_URL may be comma-separated for multiple `turn:` / `turns:` endpoints sharing the same user/credential.
 */
export function turnRelayConfigured(): boolean {
	const raw = env.PUBLIC_TURN_URL?.trim() ?? '';
	return raw.length > 0;
}

export function buildIceServers(): RTCIceServer[] {
	const servers: RTCIceServer[] = [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' }
	];
	const raw = env.PUBLIC_TURN_URL?.trim() ?? '';
	if (!raw) return servers;

	const username = env.PUBLIC_TURN_USERNAME?.trim() ?? '';
	const credential = env.PUBLIC_TURN_CREDENTIAL?.trim() ?? '';
	const urls = raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

	for (const url of urls) {
		servers.push({
			urls: url,
			username: username || undefined,
			credential: credential || undefined
		});
	}
	return servers;
}
