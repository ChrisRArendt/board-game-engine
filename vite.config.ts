import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// Uncommon port to avoid clashes with other local apps (Vite default is 5173).
	server: {
		port: 27482
	}
});
