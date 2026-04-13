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
	lineHeight: number;
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
		lineHeight: 1.2
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

export function parseLayers(raw: unknown): CardLayer[] {
	if (!Array.isArray(raw)) return [];
	const out: CardLayer[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) continue;
		const o = item as Record<string, unknown>;
		if (o.type === 'text' || o.type === 'image' || o.type === 'shape') {
			let L = item as CardLayer;
			if (o.type === 'image') {
				const img = L as ImageLayer;
				const p = img.objectPosition;
				L = {
					...img,
					objectPosition: typeof p === 'string' && p.trim() !== '' ? p.trim() : 'center'
				};
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
