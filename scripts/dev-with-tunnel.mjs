#!/usr/bin/env node
/**
 * Default `pnpm dev`: Vite + cloudflared quick tunnel, public URL + terminal QR code.
 * Use `pnpm dev:local` for Vite only (no tunnel).
 *
 * Requires `cloudflared` on PATH: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
 *
 * Port must match vite.config.ts `server.port` (override with `BGE_DEV_PORT`).
 */
import { spawn } from 'node:child_process';
import QRCode from 'qrcode';

/** @sveltejs/kit vite — keep in sync with vite.config.ts (or set `BGE_DEV_PORT`) */
const DEV_PORT = Number(process.env.BGE_DEV_PORT) || 27482;
const TUNNEL_URL_RE = /https:\/\/[a-z0-9][-a-z0-9]*\.trycloudflare\.com\/?/gi;

const viteExtraArgs = process.argv.slice(2);

/** Avoid 431 Request Header Fields Too Large when many/large cookies hit Node’s default header limit. */
function envWithLargeHttpHeaders() {
	const flag = '--max-http-header-size=98304';
	const cur = process.env.NODE_OPTIONS ?? '';
	if (cur.includes('max-http-header-size')) return process.env;
	return { ...process.env, NODE_OPTIONS: cur.trim() ? `${cur} ${flag}` : flag };
}

let tunnelPrinted = false;
let cloudflaredProc = null;

function printTunnelBlock(url) {
	if (tunnelPrinted) return;
	tunnelPrinted = true;
	const u = url.replace(/\/$/, '');
	console.log('\n\x1b[1;36m━━━━━━━━ Cloudflare tunnel ━━━━━━━━\x1b[0m');
	console.log('\x1b[33m  Open on your phone (same Wi‑Fi not required):\x1b[0m');
	console.log(`\n  \x1b[1;32m${u}\x1b[0m\n`);
	QRCode.toString(u, { type: 'terminal', small: true })
		.then((qr) => {
			console.log(qr);
			console.log(
				'\x1b[2m(Supabase auth redirect URLs must allow this host if you use login on the tunnel.)\x1b[0m\n'
			);
		})
		.catch(() => {
			console.log('\x1b[2m(could not render QR — use the URL above)\x1b[0m\n');
		});
}

function attachTunnelParser(stream) {
	let buf = '';
	stream.on('data', (chunk) => {
		buf += chunk.toString();
		const lines = buf.split('\n');
		buf = lines.pop() ?? '';
		for (const line of lines) {
			const m = line.match(TUNNEL_URL_RE);
			if (m?.[0]) printTunnelBlock(m[0]);
		}
		const tail = buf.slice(-400);
		const m2 = tail.match(TUNNEL_URL_RE);
		if (m2?.[0]) printTunnelBlock(m2[0]);
	});
}

const vite = spawn('pnpm', ['exec', 'vite', 'dev', ...viteExtraArgs], {
	cwd: process.cwd(),
	stdio: 'inherit',
	shell: process.platform === 'win32',
	env: envWithLargeHttpHeaders()
});

vite.on('error', (err) => {
	console.error('[dev-with-tunnel] Failed to start Vite:', err.message);
	process.exit(1);
});

const startTunnel = () => {
	cloudflaredProc = spawn(
		'cloudflared',
		['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${DEV_PORT}`],
		{
			stdio: ['ignore', 'pipe', 'pipe']
		}
	);
	attachTunnelParser(cloudflaredProc.stdout);
	attachTunnelParser(cloudflaredProc.stderr);
	cloudflaredProc.on('error', (err) => {
		if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
			console.error(
				'\n\x1b[33m[dev-with-tunnel]\x1b[0m cloudflared not found. Install:\n  https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/\n'
			);
		} else {
			console.error('\n\x1b[33m[dev-with-tunnel]\x1b[0m', err.message);
		}
	});
	cloudflaredProc.on('exit', (code, signal) => {
		if (signal === 'SIGTERM') return;
		if (code !== 0 && code !== null) {
			console.error(`\n\x1b[33m[dev-with-tunnel]\x1b[0m cloudflared exited (${code}). Tunnel is gone.\n`);
		}
	});
};

setTimeout(startTunnel, 2000);

function shutdown(signal) {
	if (cloudflaredProc && !cloudflaredProc.killed) {
		cloudflaredProc.kill(signal);
	}
	if (vite.pid && !vite.killed) {
		vite.kill(signal);
	}
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

vite.on('exit', (code, signal) => {
	if (cloudflaredProc && !cloudflaredProc.killed) cloudflaredProc.kill();
	process.exit(code ?? (signal ? 1 : 0));
});
