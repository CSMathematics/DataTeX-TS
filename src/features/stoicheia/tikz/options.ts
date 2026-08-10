export const splitTikzOptions = (value: string): string[] => {
  const options: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of value) {
    if (char === '{' || char === '[' || char === '(') depth++;
    if (char === '}' || char === ']' || char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      if (current.trim()) options.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) options.push(current.trim());
  return options;
};

const colorMap: Record<string, string> = {
  black: '#0f172a',
  white: '#ffffff',
  red: '#dc2626',
  blue: '#2563eb',
  green: '#16a34a',
  orange: '#ea580c',
  yellow: '#ca8a04',
  purple: '#9333ea',
  violet: '#7c3aed',
  magenta: '#db2777',
  cyan: '#0891b2',
  teal: '#0d9488',
  gray: '#64748b',
  grey: '#64748b',
  brown: '#92400e',
};

export type FastArrowTip = 'default' | 'Latex' | 'Stealth' | 'Triangle' | 'To';

export interface FastArrow {
  tip: FastArrowTip;
  scale: number;
}

export interface FastPathArrow extends FastArrow {
  position: number;
  each: boolean;
}

const arrowTips: FastArrowTip[] = ['Latex', 'Stealth', 'Triangle', 'To'];

export const resolveTikzColor = (value: string | undefined, fallback = '#0f172a') => {
  if (!value) return fallback;
  const normalized = value.trim().replace(/^\{?|\}?$/g, '');
  const rgb = normalized.match(/^rgb\s*,\s*255\s*:\s*red\s*,\s*(\d+)\s*;\s*green\s*,\s*(\d+)\s*;\s*blue\s*,\s*(\d+)$/i);
  if (rgb) return `rgb(${rgb.slice(1).map(channel => Math.min(255, Number(channel))).join(', ')})`;
  const base = normalized.split('!')[0].toLowerCase();
  return colorMap[base] || (base.startsWith('#') ? base : fallback);
};

export interface FastStyle {
  stroke: string;
  fill: string;
  strokeWidth: number;
  opacity: number;
  dashArray?: string;
  arrowStart: boolean;
  arrowEnd: boolean;
  arrowStartTip: FastArrowTip;
  arrowEndTip: FastArrowTip;
  arrowStartScale: number;
  arrowEndScale: number;
  arrowMiddle?: FastPathArrow;
  arrowEach?: FastPathArrow;
  extendBefore: number;
  extendAfter: number;
}

const stripOuterBraces = (value: string) => value.trim().replace(/^\{|\}$/g, '').trim();

const parseArrowTip = (value: string | undefined, fallback: FastArrowTip = 'default'): FastArrow => {
  const clean = stripOuterBraces(value ?? '');
  const tip = arrowTips.find(item => new RegExp(`^${item}\\b`).test(clean)) ?? fallback;
  const scaleMatch = clean.match(/(?:^|[,\[])\s*scale\s*=\s*(-?[\d.]+)/);
  const scale = scaleMatch ? Number.parseFloat(scaleMatch[1]) : 1;
  return { tip, scale: Number.isFinite(scale) && scale > 0 ? scale : 1 };
};

const topLevelHyphen = (value: string) => {
  let depth = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '{' || char === '[' || char === '(') depth++;
    else if (char === '}' || char === ']' || char === ')') depth = Math.max(0, depth - 1);
    else if (char === '-' && depth === 0) return index;
  }
  return -1;
};

const isArrowTipText = (value: string) => {
  const clean = stripOuterBraces(value);
  return !clean || arrowTips.some(tip => new RegExp(`^${tip}\\b`).test(clean));
};

const parseEndpointArrowOption = (option: string): { start?: FastArrow; end?: FastArrow } | null => {
  const clean = option.trim();
  if (clean === '->') return { end: { tip: 'default', scale: 1 } };
  if (clean === '<-') return { start: { tip: 'default', scale: 1 } };
  if (clean === '<->') return { start: { tip: 'default', scale: 1 }, end: { tip: 'default', scale: 1 } };

  const separator = topLevelHyphen(clean);
  if (separator < 0) return null;
  const start = clean.slice(0, separator).trim();
  const end = clean.slice(separator + 1).trim();
  if (!isArrowTipText(start) || !isArrowTipText(end) || (!start && !end)) return null;
  return {
    start: start ? parseArrowTip(start) : undefined,
    end: end ? parseArrowTip(end) : undefined,
  };
};

const parsePathArrowOption = (option: string, each: boolean): FastPathArrow | null => {
  const key = each ? 'tkz arrows' : 'tkz arrow';
  const clean = option.trim();
  if (clean !== key && !clean.startsWith(`${key}=`)) return null;
  const value = clean === key ? '' : stripOuterBraces(clean.slice(key.length + 1));
  const positionMatch = value.match(/\bat\s+(-?[\d.]+)/);
  const rawPosition = positionMatch ? Number.parseFloat(positionMatch[1]) : 0.5;
  return {
    ...parseArrowTip(value),
    position: Number.isFinite(rawPosition) ? Math.min(Math.max(rawPosition, 0), 1) : 0.5,
    each,
  };
};

export const isArrowOption = (option: string) => {
  const clean = option.trim();
  return clean.startsWith('>=') ||
    Boolean(parseEndpointArrowOption(clean)) ||
    Boolean(parsePathArrowOption(clean, false)) ||
    Boolean(parsePathArrowOption(clean, true));
};

export const parseFastStyle = (input?: string): FastStyle => {
  const options = splitTikzOptions(input || '');
  const keyValue = (key: string) => options.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim();
  const bareColor = options.find(option => colorMap[option.toLowerCase()]);
  const widthOption = keyValue('line width')?.replace('pt', '');
  const widthTokens: Record<string, number> = {
    'ultra thin': 0.35,
    'very thin': 0.5,
    thin: 0.65,
    semithick: 1,
    thick: 1.35,
    'very thick': 1.8,
    'ultra thick': 2.4,
  };
  const widthToken = options.find(option => widthTokens[option] !== undefined);
  const opacity = Number(keyValue('opacity') || 1);
  const addMatch = keyValue('add')?.match(/^(-?[\d.]+)\s+and\s+(-?[\d.]+)$/);
  const arrowHead = parseArrowTip(keyValue('>'));
  const endpointArrow = options.map(parseEndpointArrowOption).find(Boolean);
  const endpointStart = endpointArrow?.start;
  const endpointEnd = endpointArrow?.end;
  const arrowEach = options.map(option => parsePathArrowOption(option, true)).find(Boolean);
  const arrowMiddle = options.map(option => parsePathArrowOption(option, false)).find(Boolean);

  let dashArray: string | undefined;
  if (options.includes('dashed')) dashArray = '7 5';
  else if (options.includes('densely dashed')) dashArray = '5 3';
  else if (options.includes('loosely dashed')) dashArray = '9 7';
  else if (options.includes('dotted')) dashArray = '1.5 4';
  else if (options.includes('densely dotted')) dashArray = '1.5 2.5';
  else if (options.includes('loosely dotted')) dashArray = '1.5 6';

  return {
    stroke: resolveTikzColor(keyValue('draw') || keyValue('color') || keyValue('style') || bareColor),
    fill: keyValue('fill') ? resolveTikzColor(keyValue('fill'), 'transparent') : 'transparent',
    strokeWidth: widthOption && Number.isFinite(Number(widthOption))
      ? Number(widthOption) * 1.333
      : widthToken
        ? widthTokens[widthToken]
        : 0.8,
    opacity: Number.isFinite(opacity) ? Math.min(Math.max(opacity, 0), 1) : 1,
    dashArray,
    arrowStart: Boolean(endpointStart),
    arrowEnd: Boolean(endpointEnd),
    arrowStartTip: endpointStart?.tip === 'default' || !endpointStart ? arrowHead.tip : endpointStart.tip,
    arrowEndTip: endpointEnd?.tip === 'default' || !endpointEnd ? arrowHead.tip : endpointEnd.tip,
    arrowStartScale: endpointStart?.tip === 'default' || !endpointStart ? arrowHead.scale : endpointStart.scale,
    arrowEndScale: endpointEnd?.tip === 'default' || !endpointEnd ? arrowHead.scale : endpointEnd.scale,
    arrowMiddle: arrowMiddle ?? undefined,
    arrowEach: arrowEach ?? undefined,
    extendBefore: addMatch ? Number(addMatch[1]) : 0,
    extendAfter: addMatch ? Number(addMatch[2]) : 0,
  };
};
