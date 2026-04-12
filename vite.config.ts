import { sveltekit } from '@sveltejs/kit/vite';
import type { PreviewServer, ViteDevServer } from 'vite';
import { defineConfig } from 'vite';
import { setupSocketIOServer } from './src/lib/server/socket-setup';

const socketPlugin = {
	name: 'bge-socket-io',
	configureServer(server: ViteDevServer) {
		setupSocketIOServer(server.httpServer as import('http').Server);
	},
	configurePreviewServer(server: PreviewServer) {
		setupSocketIOServer(server.httpServer as import('http').Server);
	}
};

export default defineConfig({
	plugins: [sveltekit(), socketPlugin],
	// Uncommon port to avoid clashes with other local apps (Vite default is 5173).
	server: {
		port: 27482
	}
});
