/** Card template layer + background types (stored in card_templates JSONB). */

export type LayerType = 'image' | 'text' | 'shape';

export type FieldType = 'text' | 'number' | 'image' | 'color' | 'textarea';

export interface FieldBinding {
	fieldName: string;
	fieldLabel: string;
	fieldType: FieldType;
	defaultValue?: string;
	/**
	 * Set only at runtime in `collectFieldBindings` for shape gradient stops — not stored in template JSON.
	 * Piece editor groups rows with the same `groupId` into one section with `groupTitle`.
	 */
	shapeGradientGroup?: {
		groupId: string;
		stopIndex: number;
		stopCount: number;
		groupTitle: string;
	};
}

export interface LayerBase {
	id: string;
	name: string;
	type: LayerType;
	visible: boolean;
	locked: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex: number;
	opacity: number;
	fieldBinding: FieldBinding | null;
}

export type ShapeFill =
	| { type: 'solid'; color: string }
	| {
			type: 'gradient';
			stops: { offset: number; color: string }[];
			/** Used when `gradientKind` is linear (default). */
			angle: number;
			/** `linear` = straight gradient; `radial` = curved / elliptical from center. */
			gradientKind?: 'linear' | 'radial';
			/** Radial mode: ellipse size as % of the shape box (both axes); default 100. */
			radialRadiusPct?: number;
	  };

/** One per gradient stop — parallel to `fill.stops` when fill is gradient and per-piece colors are enabled. */
export type ShapeGradientColorBinding = { fieldName: string; fieldLabel: string };

export interface ShapeLayer extends LayerBase {
	type: 'shape';
	fill: ShapeFill;
	borderRadius: number;
	/** Per-stop `field_values` keys for piece color overrides (gradient fills only). */
	gradientColorBindings?: ShapeGradientColorBinding[];
}

export interface TextLayer extends LayerBase {
	type: 'text';
	content: string;
	fontFamily: string;
	fontSize: number;
	fontWeight: string;
	color: string;
	textAlign: 'left' | 'center' | 'right';
	/** Vertical alignment of text within the layer box */
	verticalAlign: 'top' | 'center' | 'bottom';
	lineHeight: number;
	letterSpacingPx: number;
	fontStyle: 'normal' | 'italic';
	textDecoration: 'none' | 'underline' | 'line-through';
	textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
	/** CSS `text-shadow`; empty string = none */
	textShadow: string;
}

export interface ImageLayer extends LayerBase {
	type: 'image';
	mediaId: string | null;
	objectFit: 'cover' | 'contain' | 'fill';
	/** CSS `object-position` (e.g. `center`, `left top`). */
	objectPosition?: string;
}

export type CardLayer = ShapeLayer | TextLayer | ImageLayer;

export type CardBackground =
	| { type: 'solid'; color: string }
	| {
			type: 'gradient';
			stops: { offset: number; color: string }[];
			angle: number;
	  }
	| {
			type: 'image';
			mediaId: string | null;
			objectFit?: 'cover' | 'contain' | 'fill';
			/** CSS `background-position` for the image (e.g. `center`, `left top`). */
			objectPosition?: string;
			/** Shown behind the image or when the asset URL is not loaded. */
			fallbackColor?: string;
	  };

export interface CardTemplateState {
	name: string;
	canvas_width: number;
	canvas_height: number;
	border_radius: number;
	background: CardBackground;
	layers: CardLayer[];
	/** Null = no back face designed yet (DB columns null). */
	back_background: CardBackground | null;
	back_layers: CardLayer[] | null;
}

/** Default when user first enables the back tab. */
export function defaultBackBackground(): CardBackground {
	return { type: 'solid', color: '#1e293b' };
}

/** Parse back_layers JSON; null/undefined means no back. */
export function parseOptionalLayersOrNull(raw: unknown): CardLayer[] | null {
	if (raw === null || raw === undefined) return null;
	return parseLayers(raw);
}

/** Parse back_background JSON; null/undefined means no back. */
export function parseOptionalBackgroundOrNull(raw: unknown): CardBackground | null {
	if (raw === null || raw === undefined) return null;
	return parseBackground(raw);
}

/** Whether template has a designed back face (non-null columns). */
export function templateHasBack(
	back_background: unknown,
	back_layers: unknown
): boolean {
	return back_background != null || back_layers != null;
}

export function newId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
	return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Deep-clone a card background for safe paste into another template. */
export function cloneCardBackground(bg: CardBackground): CardBackground {
	return parseBackground(JSON.parse(JSON.stringify(bg)) as unknown);
}

/** Deep-clone layers with new ids (e.g. after copying from another template). */
export function cloneLayersWithNewIds(layers: CardLayer[]): CardLayer[] {
	return layers.map((L) => {
		const j = JSON.parse(JSON.stringify(L)) as CardLayer;
		j.id = newId();
		return j;
	});
}

export function defaultTextLayer(): TextLayer {
	return {
		id: newId(),
		name: 'Text',
		type: 'text',
		visible: true,
		locked: false,
		x: 40,
		y: 40,
		width: 200,
		height: 40,
		zIndex: 1,
		opacity: 1,
		fieldBinding: null,
		content: 'Title',
		fontFamily: 'system-ui, sans-serif',
		fontSize: 18,
		fontWeight: '600',
		color: '#ffffff',
		textAlign: 'left',
		verticalAlign: 'top',
		lineHeight: 1.2,
		letterSpacingPx: 0,
		fontStyle: 'normal',
		textDecoration: 'none',
		textTransform: 'none',
		textShadow: ''
	};
}

export function defaultImageLayer(): ImageLayer {
	return {
		id: newId(),
		name: 'Image',
		type: 'image',
		visible: true,
		locked: false,
		x: 40,
		y: 80,
		width: 200,
		height: 200,
		zIndex: 0,
		opacity: 1,
		fieldBinding: null,
		mediaId: null,
		objectFit: 'cover',
		objectPosition: 'center'
	};
}

export function defaultShapeLayer(): ShapeLayer {
	return {
		id: newId(),
		name: 'Shape',
		type: 'shape',
		visible: true,
		locked: false,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		zIndex: 0,
		opacity: 1,
		fieldBinding: null,
		fill: { type: 'solid', color: '#333333' },
		borderRadius: 0,
		gradientColorBindings: undefined
	};
}

/** Strip `_stop_N` suffix to get prefix used for auto-generated keys. */
export function inferShapeGradientKeyPrefix(
	fieldBinding: FieldBinding,
	existing: ShapeGradientColorBinding[] | undefined
): string {
	const cand = existing?.[0]?.fieldName?.trim() || fieldBinding.fieldName.trim();
	const m = /^(.+)_stop_\d+$/i.exec(cand);
	if (m) return m[1];
	return cand || 'field_1';
}

/** Build or resize per-stop field keys to match gradient stops (preserves existing names where possible). */
export function syncShapeGradientColorBindings(
	basePrefix: string,
	stops: { offset: number; color: string }[],
	existing: ShapeGradientColorBinding[] | undefined
): ShapeGradientColorBinding[] {
	const prefix = basePrefix.trim() || 'field_1';
	const out: ShapeGradientColorBinding[] = [];
	for (let i = 0; i < stops.length; i++) {
		const ex = existing?.[i];
		out.push({
			fieldName: ex?.fieldName?.trim() || `${prefix}_stop_${i}`,
			fieldLabel: ex?.fieldLabel?.trim() || `Color ${i + 1}`
		});
	}
	return out;
}

function normalizeTextLayer(
	t: TextLayer,
	o: Record<string, unknown>,
	visible: boolean,
	locked: boolean
): TextLayer {
	const T = t;
	const letterSpacingPx =
		typeof T.letterSpacingPx === 'number' && Number.isFinite(T.letterSpacingPx)
			? T.letterSpacingPx
			: typeof o.letterSpacingPx === 'number' && Number.isFinite(o.letterSpacingPx as number)
				? (o.letterSpacingPx as number)
				: 0;

	const fontStyle: TextLayer['fontStyle'] = T.fontStyle === 'italic' ? 'italic' : 'normal';

	let textDecoration: TextLayer['textDecoration'] = 'none';
	if (T.textDecoration === 'underline' || T.textDecoration === 'line-through') {
		textDecoration = T.textDecoration;
	} else if (o.textDecoration === 'underline' || o.textDecoration === 'line-through') {
		textDecoration = o.textDecoration;
	}

	let textTransform: TextLayer['textTransform'] = 'none';
	if (
		T.textTransform === 'uppercase' ||
		T.textTransform === 'lowercase' ||
		T.textTransform === 'capitalize'
	) {
		textTransform = T.textTransform;
	} else if (
		o.textTransform === 'uppercase' ||
		o.textTransform === 'lowercase' ||
		o.textTransform === 'capitalize'
	) {
		textTransform = o.textTransform as TextLayer['textTransform'];
	}

	const textShadow =
		typeof T.textShadow === 'string'
			? T.textShadow
			: typeof o.textShadow === 'string'
				? o.textShadow
				: '';

	const verticalAlign: TextLayer['verticalAlign'] =
		T.verticalAlign === 'center' || T.verticalAlign === 'bottom'
			? T.verticalAlign
			: o.verticalAlign === 'center' || o.verticalAlign === 'bottom'
				? (o.verticalAlign as TextLayer['verticalAlign'])
				: 'top';

	return {
		...T,
		visible,
		locked,
		letterSpacingPx,
		fontStyle,
		textDecoration,
		textTransform,
		textShadow,
		verticalAlign
	};
}

function normalizeShapeLayer(S: ShapeLayer, visible: boolean, locked: boolean): ShapeLayer {
	let L: ShapeLayer = { ...S, visible, locked };
	if (L.fill.type !== 'gradient' || !L.fieldBinding) {
		if (L.gradientColorBindings?.length) {
			const { gradientColorBindings: _, ...rest } = L;
			L = rest as ShapeLayer;
		}
		return L;
	}
	const stops = L.fill.stops;
	const base = inferShapeGradientKeyPrefix(L.fieldBinding, L.gradientColorBindings);
	const gcb = syncShapeGradientColorBindings(base, stops, L.gradientColorBindings);
	const primaryKey = gcb[0]?.fieldName ?? L.fieldBinding.fieldName;
	L = {
		...L,
		gradientColorBindings: gcb,
		fieldBinding: {
			...L.fieldBinding,
			fieldName: primaryKey,
			fieldType: 'color',
			defaultValue: stops[0]?.color ?? L.fieldBinding.defaultValue
		}
	};
	return L;
}

export function parseLayers(raw: unknown): CardLayer[] {
	if (!Array.isArray(raw)) return [];
	const out: CardLayer[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) continue;
		const o = item as Record<string, unknown>;
		if (o.type === 'text' || o.type === 'image' || o.type === 'shape') {
			let L = item as CardLayer;
			const visible = typeof o.visible === 'boolean' ? o.visible : true;
			const locked = typeof o.locked === 'boolean' ? o.locked : false;
			if (o.type === 'image') {
				const img = L as ImageLayer;
				const p = img.objectPosition;
				L = {
					...img,
					objectPosition: typeof p === 'string' && p.trim() !== '' ? p.trim() : 'center',
					visible,
					locked
				};
			} else if (o.type === 'text') {
				L = normalizeTextLayer(L as TextLayer, o, visible, locked);
			} else {
				L = normalizeShapeLayer(L as ShapeLayer, visible, locked);
			}
			out.push(L);
		}
	}
	return out;
}

export function parseBackground(raw: unknown): CardBackground {
	if (typeof raw !== 'object' || raw === null) {
		return { type: 'solid', color: '#1a1a1a' };
	}
	const o = raw as Record<string, unknown>;
	if (o.type === 'gradient' && Array.isArray(o.stops)) {
		return raw as CardBackground;
	}
	if (o.type === 'image') {
		const fit = o.objectFit;
		const mid = typeof o.mediaId === 'string' ? o.mediaId.trim() : '';
		const posRaw = o.objectPosition;
		const objectPosition =
			typeof posRaw === 'string' && posRaw.trim() !== '' ? posRaw.trim() : 'center';
		return {
			type: 'image',
			mediaId: mid !== '' ? mid : null,
			objectFit: fit === 'contain' || fit === 'fill' ? fit : 'cover',
			objectPosition,
			fallbackColor: typeof o.fallbackColor === 'string' ? o.fallbackColor : '#1a1a1a'
		};
	}
	if (o.type === 'solid' && typeof o.color === 'string') {
		return { type: 'solid', color: o.color };
	}
	return { type: 'solid', color: '#1a1a1a' };
}

/** Card with a rendered PNG — used in board editor “add piece from card”. */
export interface CardForBoardPiece {
	id: string;
	/** `card_templates.id` — stored on board pieces for “group by type” in play. */
	template_id: string;
	name: string;
	rendered_image_path: string | null;
	canvas_width: number;
	canvas_height: number;
	/** Template has a designed back — piece gets flip so the board can show front/back from the sprite. */
	has_back: boolean;
}
