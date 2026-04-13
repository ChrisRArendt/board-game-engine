<script lang="ts">
	import type { CardLayer, FieldType, ImageLayer, ShapeLayer, TextLayer } from '$lib/editor/types';
	import ColorPicker from './ColorPicker.svelte';
	import FontFamilyPicker from './FontFamilyPicker.svelte';
	import GameMediaImageTools from './GameMediaImageTools.svelte';
	import GradientEditor from './GradientEditor.svelte';
	import ImageLayoutControls from './ImageLayoutControls.svelte';

	export let layer: CardLayer | null;
	export let onChange: (next: CardLayer) => void;
	/** When set, static (non-field) image layers get library + AI pickers instead of a raw media id. */
	export let gameMedia: {
		gameId: string;
		mediaUrls: Record<string, string>;
		onMergeUrls: (m: Record<string, string>) => void;
		onAfterPick?: () => void;
	} | null = null;

	export let pieceColorPalette: string[] | undefined = undefined;
	export let onPieceColorPaletteChange: ((next: string[]) => void) | undefined = undefined;

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
						const fromText = layer.type === 'text' ? (layer as TextLayer).content ?? '' : '';
						const fromImage =
							layer.type === 'image' ? (layer as ImageLayer).mediaId ?? '' : '';
						const defaultType =
							layer.type === 'image' ? ('image' as FieldType) : ('text' as FieldType);
						patch({
							fieldBinding: {
								fieldName: 'field_1',
								fieldLabel: 'Field',
								fieldType: defaultType,
								defaultValue: fromText || fromImage
							}
						});
					} else patch({ fieldBinding: null });
				}}
			/>
			<span>Per-piece field</span>
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
					<option value="text">Single line</option>
					<option value="textarea">Multiline</option>
					<option value="number">number</option>
					<option value="color">color</option>
					<option value="image">image</option>
				</select>
			</label>
			{#if !(layer.type === 'image' && layer.fieldBinding.fieldType === 'image')}
			<label class="row">
				<span>Default</span>
				{#if layer.fieldBinding.fieldType === 'textarea'}
					<textarea
						class="default-area"
						style="min-height: {Math.min(280, Math.max(72, layer.height))}px"
						value={layer.fieldBinding.defaultValue ?? ''}
						oninput={(e) =>
							patch({
								fieldBinding: {
									...layer.fieldBinding!,
									defaultValue: (e.currentTarget as HTMLTextAreaElement).value
								}
							})}
					></textarea>
				{:else if layer.fieldBinding.fieldType === 'image'}
					<input
						type="text"
						placeholder="game_media id"
						value={layer.fieldBinding.defaultValue ?? ''}
						oninput={(e) =>
							patch({
								fieldBinding: {
									...layer.fieldBinding!,
									defaultValue: (e.currentTarget as HTMLInputElement).value
								}
							})}
					/>
				{:else if layer.fieldBinding.fieldType === 'color'}
					<ColorPicker
						value={layer.fieldBinding.defaultValue || '#334155'}
						palette={pieceColorPalette}
						onPaletteChange={onPieceColorPaletteChange}
						onValueChange={(c: string) =>
							patch({
								fieldBinding: {
									...layer.fieldBinding!,
									defaultValue: c
								}
							})}
					/>
				{:else}
					<input
						type={layer.fieldBinding.fieldType === 'number' ? 'number' : 'text'}
						value={layer.fieldBinding.defaultValue ?? ''}
						oninput={(e) =>
							patch({
								fieldBinding: {
									...layer.fieldBinding!,
									defaultValue: (e.currentTarget as HTMLInputElement).value
								}
							})}
					/>
				{/if}
			</label>
			{/if}
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
						palette={pieceColorPalette}
						onPaletteChange={onPieceColorPaletteChange}
						onValueChange={(c: string) =>
							patch({ ...S, fill: { type: 'solid', color: c } } as CardLayer)}
					/>
				</label>
			{:else}
				<GradientEditor
					stops={S.fill.stops}
					angle={S.fill.angle}
					palette={pieceColorPalette}
					onPaletteChange={onPieceColorPaletteChange}
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
			<div class="font-block">
				<FontFamilyPicker value={T.fontFamily} onChange={(fontFamily) => patch({ fontFamily })} />
			</div>
			<label class="row">
				<span>Font size</span>
				<input
					type="number"
					min="4"
					step="1"
					value={T.fontSize}
					oninput={(e) => patch({ fontSize: parseFloat((e.currentTarget as HTMLInputElement).value) || 12 })}
				/>
			</label>
			<label class="row">
				<span>Weight</span>
				<select
					value={T.fontWeight}
					onchange={(e) => patch({ fontWeight: (e.currentTarget as HTMLSelectElement).value })}
				>
					<option value="100">100</option>
					<option value="200">200</option>
					<option value="300">300</option>
					<option value="400">400</option>
					<option value="500">500</option>
					<option value="600">600</option>
					<option value="700">700</option>
					<option value="800">800</option>
					<option value="900">900</option>
				</select>
			</label>
			<label class="row">
				<span>Line height</span>
				<input
					type="number"
					min="0.5"
					step="0.05"
					value={T.lineHeight}
					oninput={(e) => patch({ lineHeight: parseFloat((e.currentTarget as HTMLInputElement).value) || 1.2 })}
				/>
			</label>
			<label class="row">
				<span>Letter spacing (px)</span>
				<input
					type="number"
					step="0.25"
					value={T.letterSpacingPx}
					oninput={(e) =>
						patch({ letterSpacingPx: parseFloat((e.currentTarget as HTMLInputElement).value) || 0 })}
				/>
			</label>
			<label class="row">
				<span>Color</span>
				<ColorPicker
					value={T.color}
					palette={pieceColorPalette}
					onPaletteChange={onPieceColorPaletteChange}
					onValueChange={(c: string) => patch({ color: c })}
				/>
			</label>
			<label class="row">
				<span>Align (horizontal)</span>
				<select
					value={T.textAlign}
					onchange={(e) => patch({ textAlign: (e.currentTarget as HTMLSelectElement).value as TextLayer['textAlign'] })}
				>
					<option value="left">left</option>
					<option value="center">center</option>
					<option value="right">right</option>
				</select>
			</label>
			<label class="row">
				<span>Align (vertical)</span>
				<select
					value={T.verticalAlign}
					onchange={(e) =>
						patch({
							verticalAlign: (e.currentTarget as HTMLSelectElement).value as TextLayer['verticalAlign']
						})}
				>
					<option value="top">top</option>
					<option value="center">center</option>
					<option value="bottom">bottom</option>
				</select>
			</label>
			<label class="row">
				<span>Style</span>
				<select
					value={T.fontStyle}
					onchange={(e) =>
						patch({ fontStyle: (e.currentTarget as HTMLSelectElement).value as TextLayer['fontStyle'] })}
				>
					<option value="normal">normal</option>
					<option value="italic">italic</option>
				</select>
			</label>
			<label class="row">
				<span>Decoration</span>
				<select
					value={T.textDecoration}
					onchange={(e) =>
						patch({
							textDecoration: (e.currentTarget as HTMLSelectElement).value as TextLayer['textDecoration']
						})}
				>
					<option value="none">none</option>
					<option value="underline">underline</option>
					<option value="line-through">line-through</option>
				</select>
			</label>
			<label class="row">
				<span>Transform</span>
				<select
					value={T.textTransform}
					onchange={(e) =>
						patch({
							textTransform: (e.currentTarget as HTMLSelectElement).value as TextLayer['textTransform']
						})}
				>
					<option value="none">none</option>
					<option value="uppercase">uppercase</option>
					<option value="lowercase">lowercase</option>
					<option value="capitalize">capitalize</option>
				</select>
			</label>
			<label class="row">
				<span>Text shadow (CSS)</span>
				<input
					type="text"
					placeholder="e.g. 0 1px 2px rgba(0,0,0,0.5)"
					value={T.textShadow}
					oninput={(e) => patch({ textShadow: (e.currentTarget as HTMLInputElement).value })}
				/>
			</label>
		{/if}

		{#if layer.type === 'image'}
			{@const I = layer as ImageLayer}
			<h4>Image</h4>
			{#if I.fieldBinding?.fieldType === 'image' || !I.fieldBinding}
				<p class="field-hint">
					{#if I.fieldBinding?.fieldType === 'image'}
						Default artwork for new pieces (each piece can override in the piece editor).
					{:else}
						Static artwork — same on every piece using this template.
					{/if}
				</p>
			{/if}
			{#if I.fieldBinding?.fieldType === 'image'}
				{#if gameMedia}
					<div class="row">
						<span>Default artwork</span>
						<GameMediaImageTools
							gameId={gameMedia.gameId}
							mediaId={I.fieldBinding!.defaultValue?.trim() || null}
							mediaUrls={gameMedia.mediaUrls}
							onMediaIdChange={(id) =>
								patch({
									fieldBinding: { ...I.fieldBinding!, defaultValue: id ?? '' }
								})}
							onMergeUrls={gameMedia.onMergeUrls}
							onAfterPick={gameMedia.onAfterPick}
						/>
					</div>
				{:else}
					<label class="row">
						<span>Default (media id)</span>
						<input
							type="text"
							placeholder="game_media id"
							value={I.fieldBinding?.defaultValue ?? ''}
							oninput={(e) =>
								patch({
									fieldBinding: {
										...I.fieldBinding!,
										defaultValue: (e.currentTarget as HTMLInputElement).value
									}
								})}
						/>
					</label>
				{/if}
			{:else if !I.fieldBinding}
				{#if gameMedia}
					<div class="row">
						<span>Artwork</span>
						<GameMediaImageTools
							gameId={gameMedia.gameId}
							mediaId={I.mediaId}
							mediaUrls={gameMedia.mediaUrls}
							onMediaIdChange={(id) => patch({ mediaId: id })}
							onMergeUrls={gameMedia.onMergeUrls}
							onAfterPick={gameMedia.onAfterPick}
						/>
					</div>
				{:else}
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
			{/if}
			<div class="layout-block">
				<ImageLayoutControls
					objectFit={I.objectFit}
					objectPosition={I.objectPosition?.trim() ? I.objectPosition : 'center'}
					onFitChange={(fit) => patch({ objectFit: fit })}
					onPositionChange={(pos) => patch({ objectPosition: pos })}
				/>
			</div>
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
	.row select,
	.row textarea {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.default-area {
		width: 100%;
		resize: vertical;
		font: inherit;
		line-height: 1.4;
		box-sizing: border-box;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.muted {
		color: var(--color-text-muted);
	}
	.field-hint {
		margin: 0 0 8px;
		font-size: 12px;
		line-height: 1.45;
		color: var(--color-text-muted);
	}
	.layout-block {
		margin-top: 4px;
	}
	.font-block {
		margin-top: 4px;
	}
</style>
