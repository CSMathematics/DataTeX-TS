export const node = (cx: number, cy: number, r = 1.7, key?: string) => (
  <circle key={key} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
);

export const openNode = (cx: number, cy: number, r = 1.7, key?: string) => (
  <circle key={key} cx={cx} cy={cy} r={r} fill="var(--panel, transparent)" />
);

export const helperLine = (x1: number, y1: number, x2: number, y2: number, key?: string) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray="2.4 2.4" opacity={0.58} />
);

export const segment = (x1: number, y1: number, x2: number, y2: number, key?: string) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} />
);

export const arrow = (x1: number, y1: number, x2: number, y2: number, key?: string) => (
  <path key={key} d={`M ${x1} ${y1} L ${x2} ${y2} m -3 -2 l 3 2 l -3 2`} />
);

export const rightAngle = (x: number, y: number, size = 3.2, key?: string) => (
  <path key={key} d={`M ${x} ${y - size} L ${x + size} ${y - size} L ${x + size} ${y}`} />
);

export const smallCheck = (x = 17, y = 6, key = 'check') => (
  <path key={key} d={`M ${x - 3} ${y} l 2 2 l 4 -4`} strokeWidth={1.9} />
);
