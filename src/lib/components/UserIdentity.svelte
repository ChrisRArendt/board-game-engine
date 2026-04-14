<script lang="ts">
	import { initialsFromDisplayName, avatarFallbackHue } from '$lib/avatar';

	/** Primary label (display name). */
	export let displayName: string;
	/** Profile or OAuth avatar URL. */
	export let avatarUrl: string | null | undefined = undefined;
	/** Secondary line: email, @username, or status. */
	export let subtitle: string | null | undefined = undefined;
	/**
	 * nav — header bar (avatar + stacked name/subtitle)
	 * row — list row, comfortable padding
	 * compact — tight row (search results)
	 * board — floating user list on game table (avatar + name below)
	 */
	export let variant: 'nav' | 'row' | 'compact' | 'board' = 'row';
	/** Selection / presence ring color (e.g. multiplayer cursor color). */
	export let ringColor: string | undefined = undefined;
	export let showRing = false;
	/** Wrap avatar in an outer ring slot (e.g. voice panel) so speaking glow is not clipped by .circle overflow */
	export let wrapVoiceRing = false;
	export let voiceActive = false;

	let imgError = false;

	$: hue = avatarFallbackHue(displayName || 'user');
	$: fallbackBg = `linear-gradient(135deg, hsl(${hue}, 55%, 42%), hsl(${(hue + 40) % 360}, 50%, 32%))`;
	$: initials = initialsFromDisplayName(displayName);

	$: size =
		variant === 'nav' ? 36 : variant === 'compact' ? 32 : variant === 'board' ? 40 : 36;
	$: showSubtitle = subtitle != null && String(subtitle).length > 0;
</script>

<div class="identity" class:nav={variant === 'nav'} class:row={variant === 'row'} class:compact={variant === 'compact'} class:board={variant === 'board'}>
	{#if wrapVoiceRing}
		<div class="voice-ring-slot" class:active={voiceActive} aria-hidden="true">
			<div
				class="circle"
				class:has-ring={showRing && ringColor}
				style:width="{size}px"
				style:height="{size}px"
				style:--ring={ringColor ?? 'transparent'}
				style:background={avatarUrl && !imgError ? undefined : fallbackBg}
			>
				{#if avatarUrl && !imgError}
					<img
						src={avatarUrl}
						alt=""
						referrerpolicy="no-referrer"
						on:error={() => (imgError = true)}
					/>
				{:else}
					<span class="initials" aria-hidden="true">{initials}</span>
				{/if}
			</div>
		</div>
	{:else}
		<div
			class="circle"
			class:has-ring={showRing && ringColor}
			style:width="{size}px"
			style:height="{size}px"
			style:--ring={ringColor ?? 'transparent'}
			style:background={avatarUrl && !imgError ? undefined : fallbackBg}
		>
			{#if avatarUrl && !imgError}
				<img
					src={avatarUrl}
					alt=""
					referrerpolicy="no-referrer"
					on:error={() => (imgError = true)}
				/>
			{:else}
				<span class="initials" aria-hidden="true">{initials}</span>
			{/if}
		</div>
	{/if}
	<div class="text" class:stacked={variant === 'nav' || variant === 'row' || variant === 'compact'}>
		<span class="primary">{displayName}</span>
		{#if showSubtitle}
			<span class="sub">{subtitle}</span>
		{/if}
	</div>
</div>

<style>
	.identity {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
	}
	.identity.board {
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
	}
	.identity.board .text {
		align-items: center;
		text-align: center;
	}
	.circle {
		flex-shrink: 0;
		border-radius: 50%;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}
	.circle.has-ring {
		box-shadow:
			0 0 0 1px #000,
			0 0 0 4px var(--ring),
			0 1px 2px 4px #000;
	}
	.circle img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.initials {
		font-size: 0.65em;
		font-weight: 600;
		color: #fff;
		text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
		user-select: none;
	}
	.nav .circle {
		width: 36px;
		height: 36px;
	}
	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 0.1rem;
	}
	.text.stacked .primary {
		font-weight: 600;
		font-size: 0.9rem;
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.identity.nav .primary {
		color: #f8fafc;
	}
	.sub {
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.row .primary,
	.compact .primary {
		color: var(--color-text);
		font-size: 0.88rem;
		font-weight: 600;
	}
	.row .sub,
	.compact .sub {
		color: var(--color-text-muted);
	}
	.board .primary {
		font-size: 11px;
		font-weight: 500;
		color: #fff;
		text-shadow:
			-1px -1px 1px #000,
			1px -1px 1px #000,
			-1px 1px 1px #000,
			1px 1px 1px #000;
		max-width: 90px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.board .sub {
		color: #cbd5e1;
		font-size: 10px;
	}
	.voice-ring-slot {
		flex-shrink: 0;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: content-box;
	}
	.voice-ring-slot.active {
		padding: 3px;
		box-shadow:
			0 0 0 2px rgba(34, 197, 94, 0.92),
			0 0 14px rgba(34, 197, 94, 0.45);
		animation: bge-voice-ring-pulse 1.1s ease-in-out infinite;
	}
	@keyframes bge-voice-ring-pulse {
		0%,
		100% {
			box-shadow:
				0 0 0 2px rgba(34, 197, 94, 0.85),
				0 0 10px rgba(34, 197, 94, 0.3);
		}
		50% {
			box-shadow:
				0 0 0 3px rgba(52, 211, 153, 0.95),
				0 0 22px rgba(34, 197, 94, 0.55);
		}
	}
</style>
