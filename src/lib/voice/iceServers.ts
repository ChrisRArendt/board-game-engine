import { env } from '$env/dynamic/public';

/**
 * Build ICE servers for RTCPeerConnection.
 * STUN is always included; TURN is optional (Metered.ca, etc.) via PUBLIC_TURN_* env.
 */
export function buildIceServers(): RTCIceServer[] {
	const servers: RTCIceServer[] = [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' }
	];
	const url = env.PUBLIC_TURN_URL?.trim();
	const username = env.PUBLIC_TURN_USERNAME?.trim() ?? '';
	const credential = env.PUBLIC_TURN_CREDENTIAL?.trim() ?? '';
	if (url) {
		servers.push({
			urls: url,
			username: username || undefined,
			credential: credential || undefined
		});
	}
	return servers;
}
