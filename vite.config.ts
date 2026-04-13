import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// #region agent log
// Debug session: verify Vite dev server actually starts (after cache clear / --force).
function debugViteDevServerLog() {
	return {
		name: 'debug-vite-dev-server',
		configureServer() {
			try {
				const line =
					JSON.stringify({
						sessionId: 'a428b6',
						hypothesisId: 'H1',
						location: 'vite.config.ts:configureServer',
						message: 'vite_dev_server_ready',
						data: { cwd: process.cwd(), argv: process.argv.slice(2) },
						timestamp: Date.now()
					}) + '\n';
				appendFileSync(join(process.cwd(), '.cursor/debug-a428b6.log'), line);
			} catch {
				/* ignore log I/O errors */
			}
		}
	};
}
// #endregion

export default defineConfig({
	plugins: [sveltekit(), debugViteDevServerLog()],
	// Uncommon port to avoid clashes with other local apps (Vite default is 5173).
	server: {
		port: 27482
	}
});
