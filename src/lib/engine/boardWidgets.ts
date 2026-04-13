import type { BoardWidget, WidgetData, WidgetType } from './types';

/** New widget placed from the board editor library. */
export function createDefaultBoardWidget(
	type: WidgetType,
	id: number,
	x: number,
	y: number,
	zIndex: number
): BoardWidget {
	const cfg = defaultWidgetConfig(type);
	const size = defaultWidgetSize(type);
	let value: string | number | boolean = defaultValueForWidgetType(type);
	if (type === 'label' && typeof cfg.text === 'string') {
		value = cfg.text;
	}
	return {
		id,
		type,
		x,
		y,
		w: size.w,
		h: size.h,
		zIndex,
		config: { ...cfg },
		value
	};
}

export function defaultWidgetSize(type: WidgetType): { w: number; h: number } {
	switch (type) {
		case 'counter':
			return { w: 140, h: 52 };
		case 'label':
			return { w: 280, h: 80 };
		case 'textbox':
			return { w: 220, h: 96 };
		case 'dice':
			return { w: 160, h: 64 };
		case 'toggle':
			return { w: 140, h: 44 };
		default:
			return { w: 120, h: 48 };
	}
}

export function defaultWidgetConfig(type: WidgetType): Record<string, unknown> {
	switch (type) {
		case 'counter':
			return { min: 0, max: 999, step: 1 };
		case 'label':
			return {
				text: 'Label',
				fontFamily: 'system-ui, sans-serif',
				fontSize: 18,
				fontWeight: '600',
				color: '#e2e8f0',
				textAlign: 'center',
				verticalAlign: 'center',
				lineHeight: 1.3,
				letterSpacingPx: 0,
				fontStyle: 'normal',
				textDecoration: 'none',
				textTransform: 'none',
				textShadow: '',
				backgroundTransparent: true,
				backgroundColor: '#0f172a'
			};
		case 'textbox':
			return { placeholder: 'Notes…', maxLength: 4000 };
		case 'dice':
			return { sides: 6, count: 1 };
		case 'toggle':
			return { onText: 'On', offText: 'Off' };
		default:
			return {};
	}
}

/** Resolved label typography + box background (matches template text layers). */
export type LabelWidgetStyle = {
	text: string;
	fontFamily: string;
	fontSize: number;
	fontWeight: string;
	color: string;
	textAlign: 'left' | 'center' | 'right';
	verticalAlign: 'top' | 'center' | 'bottom';
	lineHeight: number;
	letterSpacingPx: number;
	fontStyle: 'normal' | 'italic';
	textDecoration: 'none' | 'underline' | 'line-through';
	textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
	textShadow: string;
	backgroundTransparent: boolean;
	backgroundColor: string;
};

export function normalizeLabelConfig(config: Record<string, unknown>): LabelWidgetStyle {
	const base = defaultWidgetConfig('label') as Record<string, unknown>;
	const c = { ...base, ...config };

	const textAlignRaw = c.textAlign;
	const textAlign: LabelWidgetStyle['textAlign'] =
		textAlignRaw === 'left' || textAlignRaw === 'center' || textAlignRaw === 'right'
			? textAlignRaw
			: 'center';

	const vaRaw = c.verticalAlign;
	const verticalAlign: LabelWidgetStyle['verticalAlign'] =
		vaRaw === 'top' || vaRaw === 'center' || vaRaw === 'bottom' ? vaRaw : 'center';

	const fontStyle: LabelWidgetStyle['fontStyle'] = c.fontStyle === 'italic' ? 'italic' : 'normal';

	let textDecoration: LabelWidgetStyle['textDecoration'] = 'none';
	if (c.textDecoration === 'underline' || c.textDecoration === 'line-through') {
		textDecoration = c.textDecoration;
	}

	let textTransform: LabelWidgetStyle['textTransform'] = 'none';
	if (
		c.textTransform === 'uppercase' ||
		c.textTransform === 'lowercase' ||
		c.textTransform === 'capitalize'
	) {
		textTransform = c.textTransform;
	}

	const backgroundTransparent =
		typeof c.backgroundTransparent === 'boolean' ? c.backgroundTransparent : false;

	return {
		text: typeof c.text === 'string' ? c.text : 'Label',
		fontFamily: typeof c.fontFamily === 'string' && c.fontFamily.trim() ? c.fontFamily : 'system-ui, sans-serif',
		fontSize:
			typeof c.fontSize === 'number' && Number.isFinite(c.fontSize) && c.fontSize > 0 ? c.fontSize : 18,
		fontWeight: typeof c.fontWeight === 'string' && c.fontWeight.trim() ? c.fontWeight : '600',
		color: typeof c.color === 'string' && c.color.trim() ? String(c.color) : '#e2e8f0',
		textAlign,
		verticalAlign,
		lineHeight:
			typeof c.lineHeight === 'number' && Number.isFinite(c.lineHeight) && c.lineHeight > 0
				? c.lineHeight
				: 1.3,
		letterSpacingPx:
			typeof c.letterSpacingPx === 'number' && Number.isFinite(c.letterSpacingPx) ? c.letterSpacingPx : 0,
		fontStyle,
		textDecoration,
		textTransform,
		textShadow: typeof c.textShadow === 'string' ? c.textShadow : '',
		backgroundTransparent,
		backgroundColor:
			typeof c.backgroundColor === 'string' && c.backgroundColor.trim()
				? String(c.backgroundColor)
				: '#0f172a'
	};
}

export function defaultValueForWidgetType(type: WidgetType): string | number | boolean {
	switch (type) {
		case 'counter':
			return 0;
		case 'label':
			return '';
		case 'textbox':
			return '';
		case 'dice':
			return 0;
		case 'toggle':
			return false;
		default:
			return '';
	}
}

/** Build runtime widget from persisted JSON row (assigns id). */
export function boardWidgetFromData(
	data: WidgetData,
	id: number,
	opts?: { stripEditorOnly?: boolean }
): BoardWidget {
	const hidden = opts?.stripEditorOnly ? undefined : data.editor_hidden === true ? true : undefined;
	const locked = opts?.stripEditorOnly ? undefined : data.editor_locked === true ? true : undefined;
	const def = defaultWidgetSize(data.type);
	const w = typeof data.w === 'number' && data.w > 0 ? data.w : def.w;
	const h = typeof data.h === 'number' && data.h > 0 ? data.h : def.h;
	const zi = typeof data.z_index === 'number' ? data.z_index : id;
	const cfgIn = data.config && typeof data.config === 'object' ? data.config : {};
	const mergedConfig = { ...defaultWidgetConfig(data.type), ...cfgIn };
	let val: string | number | boolean =
		data.default_value !== undefined && data.default_value !== null
			? data.default_value
			: defaultValueForWidgetType(data.type);
	if (data.type === 'label' && typeof mergedConfig.text === 'string' && val === '') {
		val = mergedConfig.text;
	}
	return {
		id,
		type: data.type,
		x: data.x,
		y: data.y,
		w,
		h,
		zIndex: zi,
		label: data.label,
		config: mergedConfig,
		value: val,
		hidden,
		locked
	};
}

export function widgetDataFromInstance(w: BoardWidget): WidgetData {
	return {
		type: w.type,
		x: w.x,
		y: w.y,
		w: w.w,
		h: w.h,
		z_index: w.zIndex,
		label: w.label,
		config: { ...w.config },
		default_value: w.value,
		...(w.hidden ? { editor_hidden: true } : {}),
		...(w.locked ? { editor_locked: true } : {})
	};
}
