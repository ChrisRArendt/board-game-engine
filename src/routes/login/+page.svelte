<script lang="ts">
	import { page } from '$app/stores';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';

	export let data: { redirectTo: string };

	const supabase = createSupabaseBrowserClient();

	let email = '';
	let message = '';
	let loading = false;

	$: redirectTo = $page.url.searchParams.get('redirectTo') ?? data.redirectTo ?? '/lobby';

	function callbackUrl() {
		const next = encodeURIComponent(redirectTo);
		return `${$page.url.origin}/auth/callback?next=${next}`;
	}

	async function oauthGoogle() {
		loading = true;
		message = '';
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: callbackUrl() }
		});
		loading = false;
		if (error) message = error.message;
	}

	async function magicLink() {
		if (!email.trim()) {
			message = 'Enter your email';
			return;
		}
		loading = true;
		message = '';
		const { error } = await supabase.auth.signInWithOtp({
			email: email.trim(),
			options: { emailRedirectTo: callbackUrl() }
		});
		loading = false;
		if (error) message = error.message;
		else message = 'Check your email for the login link.';
	}
</script>

<div class="login">
	<h1>Sign in</h1>
	<p class="sub">Board Game Engine — multiplayer tabletop</p>

	<div class="oauth">
		<button type="button" class="btn primary" disabled={loading} on:click={oauthGoogle}>
			Continue with Google
		</button>
	</div>

	<div class="divider">or email magic link</div>

	<form
		class="email-form"
		on:submit|preventDefault={magicLink}
	>
		<input
			type="email"
			placeholder="you@example.com"
			bind:value={email}
			autocomplete="email"
			disabled={loading}
		/>
		<button type="submit" class="btn primary" disabled={loading}>Send link</button>
	</form>

	{#if message}
		<p class="msg" role="status">{message}</p>
	{/if}

	<p class="settings-link"><a href="/settings">Appearance &amp; settings</a></p>
</div>

<style>
	.login {
		max-width: 380px;
		margin: 4rem auto;
		padding: 2rem;
		font-family: Roboto, system-ui, sans-serif;
		color: var(--color-text);
	}
	h1 {
		margin: 0 0 0.25rem;
		font-size: 1.75rem;
		color: var(--color-text);
	}
	.sub {
		color: var(--color-text-muted);
		margin: 0 0 2rem;
		font-size: 0.95rem;
	}
	.oauth {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.btn {
		padding: 0.6rem 1rem;
		border: 1px solid var(--color-border-strong);
		border-radius: 6px;
		background: var(--color-surface-muted);
		color: var(--color-text);
		cursor: pointer;
		font-size: 0.95rem;
	}
	.btn.primary {
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		border-color: var(--color-accent-hover);
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.divider {
		text-align: center;
		margin: 1.5rem 0;
		color: var(--color-text-muted);
		font-size: 0.85rem;
	}
	.email-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.email-form input {
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--color-border-strong);
		border-radius: 6px;
		font-size: 1rem;
		background: var(--color-input-bg);
		color: var(--color-text);
	}
	.msg {
		margin-top: 1rem;
		font-size: 0.9rem;
		color: var(--color-text);
	}
	.settings-link {
		margin: 1.75rem 0 0;
		font-size: 0.88rem;
		text-align: center;
	}
	.settings-link a {
		color: var(--color-link);
		text-decoration: none;
	}
	.settings-link a:hover {
		text-decoration: underline;
	}
</style>
