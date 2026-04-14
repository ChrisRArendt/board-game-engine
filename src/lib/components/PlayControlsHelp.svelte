<div class="help">
	<section>
		<h3>Keyboard</h3>
		<p class="note">Shortcuts are ignored while typing in an input or text field.</p>
		<div class="item-grid">
			<div class="label"><kbd>P</kbd> <span class="hint">hold</span></div>
			<div class="desc">Large preview of the top selected piece; release to dismiss. <kbd>Esc</kbd> also closes.</div>

			<div class="label"><kbd>Space</kbd> <span class="hint">hold</span></div>
			<div class="desc">Pan by dragging instead of selecting.</div>

			<div class="label"><kbd>−</kbd> / <kbd>=</kbd></div>
			<div class="desc">Zoom out / in.</div>

			<div class="label"><kbd>Arrow keys</kbd></div>
			<div class="desc">Nudge the view.</div>

			<div class="label"><kbd>Shift</kbd></div>
			<div class="desc">Add to selection when clicking (where supported).</div>

			<div class="label"><kbd>D</kbd></div>
			<div class="desc">Duplicate (if allowed).</div>

			<div class="label"><kbd>F</kbd></div>
			<div class="desc">Flip (if the piece can flip).</div>

			<div class="label"><kbd>S</kbd></div>
			<div class="desc">Shuffle selection.</div>

			<div class="label"><kbd>A</kbd></div>
			<div class="desc">Smart arrange (fan or stack by face).</div>

			<div class="label"><kbd>Backspace</kbd></div>
			<div class="desc">Destroy (if allowed).</div>
		</div>
		<p class="sub foot">With pieces selected, these apply to the selection (where the piece supports the action).</p>
	</section>

	<section>
		<h3>Table &amp; camera</h3>
		<div class="item-grid">
			<div class="label">Drag pieces</div>
			<div class="desc">Move them; multi-select moves together.</div>

			<div class="label">Drag table</div>
			<div class="desc">Pan (or hold <kbd>Space</kbd> and drag).</div>

			<div class="label">Scroll wheel</div>
			<div class="desc">
				Zooms by default. In <strong>Settings</strong>, you can use <strong>pan with scroll wheel</strong> instead.
			</div>

			<div class="label">Context menu</div>
			<div class="desc"><strong>Right-click</strong> the table, or <strong>long-press</strong> on touch.</div>

			<div class="label">Double-click</div>
			<div class="desc">Opens the <strong>Viewer</strong> when that piece supports it.</div>
		</div>
	</section>

	<section>
		<h3>Top bar</h3>
		<div class="item-grid">
			<div class="label"><strong>−</strong> / <strong>+</strong></div>
			<div class="desc">Zoom out / in. Center shows zoom % (click to reset).</div>

			<div class="label">Target</div>
			<div class="desc">Recenter the camera on the table.</div>

			<div class="label">Rules</div>
			<div class="desc">Open the game rulebook (if configured).</div>

			<div class="label">Roller</div>
			<div class="desc">Dice roller window.</div>

			<div class="label">Viewer</div>
			<div class="desc">Large preview of the selected piece (local only).</div>

			<div class="label">History</div>
			<div class="desc">Replay snapshots / exit replay.</div>

			<div class="label">Settings</div>
			<div class="desc">Table behavior, your color, voice prefs.</div>

			<div class="label">Connection</div>
			<div class="desc">Sync status.</div>

			<div class="label">Voice</div>
			<div class="desc">Join or leave voice (when enabled).</div>

			<div class="label"><strong>☰</strong> menu</div>
			<div class="desc">On narrow screens: Rules, Roller, Viewer, Settings, Connection.</div>
		</div>
	</section>

	<section>
		<h3>Context menu</h3>
		<div class="item-grid">
			<div class="label">Deal to…</div>
			<div class="desc">Deal selected cards to players’ deal zones.</div>

			<div class="label">Flip / Shuffle / Sort</div>
			<div class="desc">Available when the selection allows.</div>

			<div class="label">Arrange</div>
			<div class="desc">
				Stack, grid, honeycomb, fan, pile; spacing for most layouts; face up/down for double-sided cards.
			</div>
		</div>
	</section>

	<section>
		<h3>Selection row</h3>
		<p class="sub">
			When pieces are selected, extra actions may appear under the top bar: Duplicate, Destroy, Flip, Shuffle, Fan,
			Stack — depending on piece abilities.
		</p>
	</section>
</div>

<style>
	.help {
		font-size: 14px;
		line-height: 1.45;
		color: var(--color-text);
		max-height: min(70vh, 520px);
		overflow-y: auto;
		padding: 4px 2px 8px;
	}
	.help section + section {
		margin-top: 1.1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}
	h3 {
		margin: 0 0 0.5rem;
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}
	.note {
		margin: 0 0 0.65rem;
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.sub {
		margin: 0;
		font-size: 13px;
		color: var(--color-text-muted);
	}
	.sub.foot {
		margin-top: 0.65rem;
		font-size: 12px;
	}
	.item-grid {
		display: grid;
		grid-template-columns: minmax(6.5rem, min(32%, 11rem)) 1fr;
		gap: 0.45rem 0.85rem;
		align-items: baseline;
		font-size: 13px;
	}
	@media (max-width: 380px) {
		.item-grid {
			grid-template-columns: 1fr;
		}
	}
	.label {
		color: var(--color-text);
		font-weight: 600;
	}
	.label .hint {
		font-weight: 400;
		font-size: 0.88em;
		color: var(--color-text-muted);
	}
	.desc {
		color: var(--color-text);
		font-weight: 400;
	}
	kbd {
		display: inline-block;
		padding: 0.1em 0.45em;
		font-size: 0.88em;
		font-family: ui-monospace, monospace;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
	}
</style>
