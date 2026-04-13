<script lang="ts">
	import type { CardLayer, FieldType, ImageLayer, ShapeLayer, TextLayer } from '$lib/editor/types';
	import ColorPicker from './ColorPicker.svelte';
	import GradientEditor from './GradientEditor.svelte';

	export let layer: CardLayer | null;
	export let onChange: (next: CardLayer) => void;

	function patch(p: Partial<CardLayer>) {
		if (!layer) return;
		onChange({ ...layer, ...p } as CardLayer);
	}
</script>

{#if layer}
	<div class="props">
		<label class="row">
			<span>Name</span>
			<input type="text" value={layer.name} oninput={(e) => patch({ name: (e.currentTarget as HTMLInputElement).value })} />
		</label>
		<label class="row">
			<span>X</span>
			<input
				type="number"
				value={layer.x}
				oninput={(e) => patch({ x: parseFloat((e.currentTarget as HTMLInputElement).value) || 0 })}
			/>
		</label>
		<label class="row">
			<span>Y</span>
			<input
				type="number"
				value={layer.y}
				oninput={(e) => patch({ y: parseFloat((e.currentTarget as HTMLInputElement).value) || 0 })}
			/>
		</label>
		<label class="row">
			<span>W</span>
			<input
				type="number"
				value={layer.width}
				oninput={(e) => patch({ width: Math.max(8, parseFloat((e.currentTarget as HTMLInputElement).value) || 0) })}
			/>
		</label>
		<label class="row">
			<span>H</span>
			<input
				type="number"
				value={layer.height}
				oninput={(e) => patch({ height: Math.max(8, parseFloat((e.currentTarget as HTMLInputElement).value) || 0) })}
			/>
		</label>
		<label class="row">
			<span>Opacity</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.05"
				value={layer.opacity}
				oninput={(e) => patch({ opacity: parseFloat((e.currentTarget as HTMLInputElement).value) })}
			/>
		</label>

		<h4>Field binding</h4>
		<label class="check">
			<input
				type="checkbox"
				checked={layer.fieldBinding != null}
				onchange={(e) => {
					const on = (e.currentTarget as HTMLInputElement).checked;
					if (on) {
						patch({
							fieldBinding: {
								fieldName: 'field_1',
								fieldLabel: 'Field',
								fieldType: 'text',
								defaultValue: ''
							}
						});
					} else patch({ fieldBinding: null });
				}}
			/>
			<span>This layer varies per card</span>
		</label>
		{#if layer.fieldBinding}
			<label class="row">
				<span>Key</span>
				<input
					type="text"
					value={layer.fieldBinding.fieldName}
					oninput={(e) =>
						patch({
							fieldBinding: {
								...layer.fieldBinding!,
								fieldName: (e.currentTarget as HTMLInputElement).value
							}
						})}
				/>
			</label>
			<label class="row">
				<span>Label</span>
				<input
					type="text"
					value={layer.fieldBinding.fieldLabel}
					oninput={(e) =>
						patch({
							fieldBinding: {
								...layer.fieldBinding!,
								fieldLabel: (e.currentTarget as HTMLInputElement).value
							}
						})}
				/>
			</label>
			<label class="row">
				<span>Type</span>
				<select
					value={layer.fieldBinding.fieldType}
					onchange={(e) =>
						patch({
							fieldBinding: {
								...layer.fieldBinding!,
								fieldType: (e.currentTarget as HTMLSelectElement).value as FieldType
							}
						})}
				>
					<option value="text">text</option>
					<option value="textarea">textarea</option>
					<option value="number">number</option>
					<option value="color">color</option>
					<option value="image">image</option>
				</select>
			</label>
		{/if}

		{#if layer.type === 'shape'}
			{@const S = layer as ShapeLayer}
			<h4>Shape</h4>
			<label class="row">
				<span>Fill</span>
				<select
					value={S.fill.type}
					onchange={(e) => {
						const t = (e.currentTarget as HTMLSelectElement).value;
						if (t === 'solid') patch({ fill: { type: 'solid', color: '#444' } } as Partial<ShapeLayer>);
						else patch({ fill: { type: 'gradient', stops: [{ offset: 0, color: '#333' }, { offset: 1, color: '#666' }], angle: 90 } } as Partial<ShapeLayer>);
					}}
				>
					<option value="solid">Solid</option>
					<option value="gradient">Gradient</option>
				</select>
			</label>
			{#if S.fill.type === 'solid'}
				<label class="row">
					<span>Color</span>
					<ColorPicker
						value={S.fill.color}
						onValueChange={(c) =>
							patch({ ...S, fill: { type: 'solid', color: c } } as CardLayer)}
					/>
				</label>
			{:else}
				<GradientEditor
					stops={S.fill.stops}
					angle={S.fill.angle}
					onChange={(next) =>
						patch({
							...S,
							fill: { type: 'gradient', stops: next.stops, angle: next.angle }
						} as CardLayer)}
				/>
			{/if}
			<label class="row">
				<span>Radius</span>
				<input
					type="number"
					value={S.borderRadius}
					oninput={(e) => patch({ borderRadius: parseFloat((e.currentTarget as HTMLInputElement).value) || 0 })}
				/>
			</label>
		{/if}

		{#if layer.type === 'text'}
			{@const T = layer as TextLayer}
			<h4>Text</h4>
			{#if !T.fieldBinding}
				<label class="row">
					<span>Content</span>
					<input
						type="text"
						value={T.content}
						oninput={(e) => patch({ content: (e.currentTarget as HTMLInputElement).value })}
					/>
				</label>
			{/if}
			<label class="row">
				<span>Font size</span>
				<input
					type="number"
					value={T.fontSize}
					oninput={(e) => patch({ fontSize: parseFloat((e.currentTarget as HTMLInputElement).value) || 12 })}
				/>
			</label>
			<label class="row">
				<span>Color</span>
				<ColorPicker value={T.color} onValueChange={(c) => patch({ color: c })} />
			</label>
			<label class="row">
				<span>Align</span>
				<select
					value={T.textAlign}
					onchange={(e) => patch({ textAlign: (e.currentTarget as HTMLSelectElement).value as TextLayer['textAlign'] })}
				>
					<option value="left">left</option>
					<option value="center">center</option>
					<option value="right">right</option>
				</select>
			</label>
		{/if}

		{#if layer.type === 'image'}
			{@const I = layer as ImageLayer}
			<h4>Image</h4>
			{#if !I.fieldBinding}
				<label class="row">
					<span>Media ID</span>
					<input
						type="text"
						placeholder="Paste game_media id"
						value={I.mediaId ?? ''}
						oninput={(e) => patch({ mediaId: (e.currentTarget as HTMLInputElement).value || null })}
					/>
				</label>
			{/if}
			<label class="row">
				<span>Object fit</span>
				<select
					value={I.objectFit}
					onchange={(e) => patch({ objectFit: (e.currentTarget as HTMLSelectElement).value as ImageLayer['objectFit'] })}
				>
					<option value="cover">cover</option>
					<option value="contain">contain</option>
					<option value="fill">fill</option>
				</select>
			</label>
		{/if}
	</div>
{:else}
	<p class="muted">Select a layer</p>
{/if}

<style>
	.props {
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-size: 13px;
	}
	h4 {
		margin: 8px 0 0;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.row input,
	.row select {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.muted {
		color: var(--color-text-muted);
	}
</style>
