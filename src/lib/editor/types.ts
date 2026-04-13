/** Card template layer + background types (stored in card_templates JSONB). */

export type LayerType = 'image' | 'text' | 'shape';

export type FieldType = 'text' | 'number' | 'image' | 'color' | 'textarea';

export interface FieldBinding {
	fieldName: string;
	fieldLabel: string;
	fieldType: FieldType;
	defaultValue?: string;
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
			angle: number;
	  };

export interface ShapeLayer extends LayerBase {
	type: 'shape';
	fill: ShapeFill;
	borderRadius: number;
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
}

export function newId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
	return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
		borderRadius: 0
	};
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
				L = { ...L, visible, locked };
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
	name: string;
	rendered_image_path: string | null;
	canvas_width: number;
	canvas_height: number;
}
