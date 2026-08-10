const TIKZ_COLOR_HEX: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  gray: '#808080',
  red: '#ff0000',
  green: '#00ff00',
  blue: '#0000ff',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  yellow: '#ffff00',
  orange: '#ff8000',
  violet: '#800080',
  purple: '#bf0040',
  brown: '#bf8040',
  lime: '#bfff00',
  olive: '#808000',
  pink: '#ffb5c5',
  teal: '#008080',
};

export const TIKZ_COLOR_NAMES = Object.keys(TIKZ_COLOR_HEX);

export const hexToTikzColor = (hex: string) => {
  const normalized = hex.toLowerCase();
  const known = Object.entries(TIKZ_COLOR_HEX).find(([, value]) => value === normalized);
  if (known) return known[0];
  const match = normalized.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!match) return 'black';
  const [, red, green, blue] = match;
  return `{rgb,255:red,${Number.parseInt(red, 16)};green,${Number.parseInt(green, 16)};blue,${Number.parseInt(blue, 16)}}`;
};

export const tikzColorToHex = (value: string) => {
  const normalized = value.trim().replace(/^\{|\}$/g, '').toLowerCase();
  const base = normalized.split('!')[0];
  if (TIKZ_COLOR_HEX[base]) return TIKZ_COLOR_HEX[base];
  const rgb = normalized.match(/^rgb\s*,\s*255\s*:\s*red\s*,\s*(\d+)\s*;\s*green\s*,\s*(\d+)\s*;\s*blue\s*,\s*(\d+)$/);
  if (!rgb) return '#000000';
  return `#${rgb.slice(1).map(channel => Math.min(255, Number(channel)).toString(16).padStart(2, '0')).join('')}`;
};

interface TikzColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  allowNone?: boolean;
}

export function TikzColorField({ label, value, onChange, ariaLabel, allowNone = false }: TikzColorFieldProps) {
  const choices = allowNone ? ['none', ...TIKZ_COLOR_NAMES] : TIKZ_COLOR_NAMES;
  const selected = choices.includes(value.trim().toLowerCase()) ? value.trim().toLowerCase() : '';
  return (
    <div className="property-field-label col-span-2" role="group" aria-label={`${ariaLabel ?? label} controls`}>
      <span>{label}</span>
      <div className="mt-1 grid grid-cols-[2rem_minmax(0,1fr)_5.75rem] gap-1.5">
        <input
          aria-label={`${ariaLabel ?? label} picker`}
          type="color"
          className="h-8 w-8 cursor-pointer rounded-lg border p-0.5 theme-border"
          value={tikzColorToHex(value)}
          onChange={event => onChange(hexToTikzColor(event.target.value))}
          title="Choose a custom color"
        />
        <input
          aria-label={ariaLabel ?? label}
          className="property-input !mt-0 min-w-0 font-mono"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder="red!50!blue"
        />
        <select
          aria-label={`${ariaLabel ?? label} preset`}
          className="property-input !mt-0 px-1"
          value={selected}
          onChange={event => event.target.value && onChange(event.target.value)}
          title="TikZ color names"
        >
          <option value="">Names</option>
          {choices.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
    </div>
  );
}
