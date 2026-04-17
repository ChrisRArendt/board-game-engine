<script lang="ts">
	/** Icons for PlayAssistBar; stack / fan / pile match ArrangementControls layout artwork. */
	export let kind:
		| 'stack'
		/** Horizontal row of pieces (assist “Spread” = linear spread, not the Fan layout). */
		| 'spreadRow'
		/** Same as ArrangementControls layout “Fan”. */
		| 'fan'
		/** Same as ArrangementControls “Pile” (used for Smart shortcut). */
		| 'pile'
		| 'flip'
		| 'shuffle'
		| 'deal'
		| 'sort'
		| 'duplicate'
		| 'trash';
	/** Pixel size (width/height). */
	export let size = 18;
</script>

<svg
	class="assist-act-ico"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	aria-hidden="true"
>
	{#if kind === 'stack'}
		<!-- Same as ArrangementControls layout "stack" -->
		<rect
			x="5"
			y="13"
			width="11"
			height="7"
			rx="1"
			stroke="currentColor"
			stroke-width="1.5"
		/>
		<rect
			x="6.5"
			y="9"
			width="11"
			height="7"
			rx="1"
			stroke="currentColor"
			stroke-width="1.5"
		/>
		<rect
			x="8"
			y="5"
			width="11"
			height="7"
			rx="1"
			stroke="currentColor"
			stroke-width="1.5"
		/>
	{:else if kind === 'spreadRow'}
		<!-- Horizontal row (linear spread; medium gap in game logic) -->
		<rect x="2" y="8" width="5" height="10" rx="1" stroke="currentColor" stroke-width="1.5" />
		<rect x="9.5" y="8" width="5" height="10" rx="1" stroke="currentColor" stroke-width="1.5" />
		<rect x="17" y="8" width="5" height="10" rx="1" stroke="currentColor" stroke-width="1.5" />
	{:else if kind === 'fan'}
		<!-- Same as ArrangementControls layout "fan" -->
		<path
			d="M5 18 Q12 7 19 18"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
		<rect
			x="3"
			y="13"
			width="7"
			height="7"
			rx="1"
			stroke="currentColor"
			stroke-width="1.5"
			transform="rotate(-28 6.5 16.5)"
		/>
		<rect
			x="8.5"
			y="6"
			width="7"
			height="7"
			rx="1"
			stroke="currentColor"
			stroke-width="1.5"
		/>
		<rect
			x="14"
			y="13"
			width="7"
			height="7"
			rx="1"
			stroke="currentColor"
			stroke-width="1.5"
			transform="rotate(28 17.5 16.5)"
		/>
	{:else if kind === 'pile'}
		<!-- Same as ArrangementControls layout "pile" -->
		<rect
			x="4"
			y="10"
			width="10"
			height="8"
			rx="1"
			stroke="currentColor"
			stroke-width="1.5"
		/>
		<rect
			x="6"
			y="7"
			width="10"
			height="8"
			rx="1"
			stroke="currentColor"
			stroke-width="1.5"
		/>
		<rect
			x="8"
			y="4"
			width="10"
			height="8"
			rx="1"
			stroke="currentColor"
			stroke-width="1.5"
		/>
	{:else if kind === 'flip'}
		<rect x="5" y="5" width="9" height="12" rx="1" stroke="currentColor" stroke-width="1.5" />
		<rect x="10" y="7" width="9" height="12" rx="1" stroke="currentColor" stroke-width="1.5" opacity="0.45" />
		<path
			d="M16 4v4h4"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else if kind === 'shuffle'}
		<path
			d="M3 7h4.5a3 3 0 0 1 2.1.9l6.8 6.8a3 3 0 0 0 2.1.9H21M3 17h4.5a3 3 0 0 0 2.1-.9l2.2-2.2M21 7h-4.5a3 3 0 0 1-2.1-.9L13.3 4.8M3 17l4 2M21 17l-4 2"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else if kind === 'deal'}
		<!-- Stack + arrow to hand zones (abstract) -->
		<rect x="3" y="6" width="8" height="10" rx="1" stroke="currentColor" stroke-width="1.5" />
		<rect x="5" y="4" width="8" height="10" rx="1" stroke="currentColor" stroke-width="1.5" opacity="0.5" />
		<path
			d="M16 12h4M18 10v4"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
	{:else if kind === 'sort'}
		<path d="M4 6h8M4 12h12M4 18h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
		<path d="M18 8l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
	{:else if kind === 'duplicate'}
		<rect x="5" y="5" width="10" height="12" rx="1" stroke="currentColor" stroke-width="1.5" />
		<rect x="9" y="7" width="10" height="12" rx="1" stroke="currentColor" stroke-width="1.5" opacity="0.55" />
	{:else if kind === 'trash'}
		<path
			d="M9 9V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M5 9h14M7 9v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/if}
</svg>

<style>
	.assist-act-ico {
		flex-shrink: 0;
		color: currentColor;
		opacity: 0.92;
	}
</style>
