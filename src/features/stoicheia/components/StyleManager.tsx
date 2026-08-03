import { useEffect, useMemo, useState } from 'react';
import { Check, Circle, Compass, Minus, Palette, Plus, Tags, Trash2, X } from 'lucide-react';
import { useEditorStore } from '../store';
import { splitTikzOptions } from '../tikz/options';
import { GLOBAL_STYLE_CONFIGS, GlobalStyleConfig, GlobalStyleKind, parseStyleCommands, SourceStyleCommand, upsertGlobalStyleInSource } from '../tikz/styleCommands';
import { TikzColorField } from './TikzColorField';

const iconFor = (kind: GlobalStyleConfig['kind'] | 'custom') => {
  switch (kind) {
    case 'point': return <Circle size={16} className="text-blue-500" />;
    case 'line': return <Minus size={16} className="text-emerald-500" />;
    case 'arc': return <Circle size={16} className="text-orange-500" />;
    case 'compass': return <Compass size={16} className="text-cyan-500" />;
    case 'label': return <Tags size={16} className="style-manager-icon-muted" />;
    case 'colors': return <Palette size={16} className="text-fuchsia-500" />;
    default: return <Palette size={16} className="text-amber-500" />;
  }
};

const optionValue = (options: string[], key: string, fallback = '') => (
  options.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? fallback
);

const replaceOption = (optionsText: string, matches: (option: string) => boolean, next?: string) => {
  const retained = splitTikzOptions(optionsText).filter(option => !matches(option));
  if (next?.trim()) retained.push(next.trim());
  return retained.join(', ');
};

const replaceKey = (optionsText: string, key: string, value: string) => (
  replaceOption(optionsText, option => option.startsWith(`${key}=`), value.trim() ? `${key}=${value.trim()}` : undefined)
);

const replaceStylePattern = (optionsText: string, pattern: string) => (
  replaceOption(optionsText, option => option.startsWith('style='), pattern === 'solid' ? undefined : `style=${pattern}`)
);

const STYLE_PROFILES: Array<{ name: string; description: string; styles: Partial<Record<GlobalStyleKind, string>> }> = [
  {
    name: 'Clean geometry',
    description: 'Balanced teal drawing defaults for everyday diagrams.',
    styles: {
      point: 'size=2,color=teal,fill=teal',
      line: 'line width=.4pt,color=teal',
      arc: 'color=gray,line width=.4pt',
      label: 'font=\\scriptsize,color=teal',
    },
  },
  {
    name: 'Presentation',
    description: 'Larger points, stronger lines and compact labels.',
    styles: {
      point: 'size=3,color=blue,fill=blue!30',
      line: 'line width=.8pt,color=blue!70!black',
      arc: 'color=orange,line width=.8pt',
      compass: 'color=orange,line width=.6pt,delta=12',
      label: 'font=\\small,color=black',
    },
  },
  {
    name: 'Blueprint',
    description: 'Cool technical colors with a quiet compass layer.',
    styles: {
      point: 'size=2,color=cyan!50!black,fill=cyan!20',
      line: 'line width=.4pt,color=cyan!45!black',
      arc: 'color=violet,line width=.4pt',
      compass: 'color=gray,line width=.2pt,delta=10',
      label: 'font=\\scriptsize,color=cyan!35!black',
      colors: 'background=white,text=black',
    },
  },
];

interface StyleOptionControlsProps {
  kind: GlobalStyleConfig['kind'] | 'custom';
  optionsText: string;
  setOptionsText: (options: string) => void;
  label: string;
}

function StyleOptionControls({ kind, optionsText, setOptionsText, label }: StyleOptionControlsProps) {
  const options = splitTikzOptions(optionsText);
  const color = optionValue(options, 'color', kind === 'arc' ? 'gray' : kind === 'compass' || kind === 'custom' ? 'orange' : 'teal');
  const fill = optionValue(options, 'fill', kind === 'point' ? 'teal' : '');
  const lineWidth = optionValue(options, 'line width', kind === 'line' || kind === 'arc' || kind === 'compass' ? '.4pt' : '');
  const pattern = optionValue(options, 'style', 'solid');

  if (kind === 'colors') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <TikzColorField label="Background" ariaLabel={`${label} background`} value={optionValue(options, 'background', 'white')} onChange={value => setOptionsText(replaceKey(optionsText, 'background', value))} />
        <TikzColorField label="Text" ariaLabel={`${label} text`} value={optionValue(options, 'text', 'black')} onChange={value => setOptionsText(replaceKey(optionsText, 'text', value))} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <TikzColorField label="Color" ariaLabel={`${label} color`} value={color} onChange={value => setOptionsText(replaceKey(optionsText, 'color', value))} />
      {(kind === 'point' || kind === 'custom') && (
        <TikzColorField label="Fill" ariaLabel={`${label} fill`} value={fill} allowNone onChange={value => setOptionsText(replaceKey(optionsText, 'fill', value))} />
      )}
      {kind === 'point' && (
        <>
          <label className="property-field-label">
            Size
            <input aria-label={`${label} size`} className="property-input mt-1" value={optionValue(options, 'size', '2')} onChange={event => setOptionsText(replaceKey(optionsText, 'size', event.target.value))} />
          </label>
          <label className="property-field-label">
            Shape
            <select aria-label={`${label} shape`} className="property-input mt-1" value={optionValue(options, 'shape', 'circle')} onChange={event => setOptionsText(replaceKey(optionsText, 'shape', event.target.value))}>
              <option value="circle">Circle</option>
              <option value="cross">Cross</option>
              <option value="cross out">Cross out</option>
              <option value="diamond">Diamond</option>
              <option value="square">Square</option>
            </select>
          </label>
        </>
      )}
      {(kind === 'line' || kind === 'arc' || kind === 'compass' || kind === 'custom') && (
        <>
          <label className="property-field-label">
            Width
            <select aria-label={`${label} line width`} className="property-input mt-1" value={lineWidth} onChange={event => setOptionsText(replaceKey(optionsText, 'line width', event.target.value))}>
              <option value=".2pt">.2pt</option>
              <option value=".4pt">.4pt</option>
              <option value=".8pt">.8pt</option>
              <option value="1pt">1pt</option>
              <option value="1.5pt">1.5pt</option>
              <option value="2pt">2pt</option>
            </select>
          </label>
          <label className="property-field-label">
            Pattern
            <select aria-label={`${label} pattern`} className="property-input mt-1" value={pattern} onChange={event => setOptionsText(replaceStylePattern(optionsText, event.target.value))}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="densely dashed">Dense dash</option>
              <option value="densely dotted">Dense dots</option>
            </select>
          </label>
        </>
      )}
      {(kind === 'arc' || kind === 'compass') && (
        <label className="property-field-label">
          Delta
          <input aria-label={`${label} delta`} className="property-input mt-1" value={optionValue(options, 'delta', kind === 'compass' ? '10' : '')} onChange={event => setOptionsText(replaceKey(optionsText, 'delta', event.target.value))} />
        </label>
      )}
      {kind === 'label' && (
        <label className="property-field-label">
          Font
          <select aria-label={`${label} font`} className="property-input mt-1" value={optionValue(options, 'font', '\\scriptsize')} onChange={event => setOptionsText(replaceKey(optionsText, 'font', event.target.value))}>
            <option value="\tiny">tiny</option>
            <option value="\scriptsize">scriptsize</option>
            <option value="\footnotesize">footnotesize</option>
            <option value="\small">small</option>
            <option value="\normalsize">normalsize</option>
          </select>
        </label>
      )}
      {kind === 'custom' && (
        <label className="property-field-label">
          Opacity
          <input aria-label={`${label} opacity`} className="property-input mt-1" value={optionValue(options, 'opacity', '')} onChange={event => setOptionsText(replaceKey(optionsText, 'opacity', event.target.value))} />
        </label>
      )}
    </div>
  );
}

function GlobalStyleCard({ config, command }: { config: GlobalStyleConfig; command?: SourceStyleCommand }) {
  const [optionsText, setOptionsText] = useState(command?.options || config.defaults);
  useEffect(() => setOptionsText(command?.options || config.defaults), [command?.options, config.defaults]);
  const enabled = command?.enabled ?? false;

  return (
    <section className="property-card space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="style-manager-icon grid h-8 w-8 shrink-0 place-items-center rounded-lg">{iconFor(config.kind)}</span>
          <div className="min-w-0">
            <h3 className="style-manager-title truncate text-sm font-semibold">{config.label}</h3>
            <p className="style-manager-command truncate font-mono text-[11px]">{`\\${config.command}`}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label={`${enabled ? 'Disable' : 'Enable'} ${config.label} style`}
          onClick={() => command ? useEditorStore.getState().toggleStyleSetup(config.kind, !enabled) : useEditorStore.getState().upsertStyleSetup(config.kind, optionsText, true)}
          className={`style-manager-toggle h-7 rounded-lg px-2 text-xs font-semibold ${enabled ? 'style-manager-toggle-on' : 'style-manager-toggle-off'}`}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </header>
      <StyleOptionControls kind={config.kind} label={config.label} optionsText={optionsText} setOptionsText={setOptionsText} />
      <div className="flex gap-2">
        <input aria-label={`${config.label} options`} className="property-input min-w-0 flex-1 font-mono" value={optionsText} onChange={event => setOptionsText(event.target.value)} />
        <button type="button" aria-label={`Apply ${config.label} style`} onClick={() => useEditorStore.getState().upsertStyleSetup(config.kind, optionsText, command?.enabled ?? true)} className="style-manager-action grid h-8 w-9 place-items-center rounded-lg">
          <Check size={14} />
        </button>
        {command && (
          <button type="button" aria-label={`Remove ${config.label} style`} onClick={() => useEditorStore.getState().removeStyleSetup(config.kind)} className="style-manager-danger grid h-8 w-9 place-items-center rounded-lg">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </section>
  );
}

function CustomStyleCard({ command }: { command: SourceStyleCommand }) {
  const [optionsText, setOptionsText] = useState(command.options);
  useEffect(() => setOptionsText(command.options), [command.options]);
  const name = command.name ?? '';

  return (
    <section className="property-card space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="style-manager-icon style-manager-icon-warm grid h-8 w-8 shrink-0 place-items-center rounded-lg">{iconFor('custom')}</span>
          <div className="min-w-0">
            <h3 className="style-manager-title truncate text-sm font-semibold">{name}</h3>
            <p className="style-manager-command truncate font-mono text-[11px]">{'\\tkzSetUpStyle'}</p>
          </div>
        </div>
        <button type="button" aria-label={`${command.enabled ? 'Disable' : 'Enable'} ${name} style`} onClick={() => useEditorStore.getState().toggleCustomStyle(name, !command.enabled)} className={`style-manager-toggle h-7 rounded-lg px-2 text-xs font-semibold ${command.enabled ? 'style-manager-toggle-on' : 'style-manager-toggle-off'}`}>
          {command.enabled ? 'On' : 'Off'}
        </button>
      </header>
      <StyleOptionControls kind="custom" label={name} optionsText={optionsText} setOptionsText={setOptionsText} />
      <div className="flex gap-2">
        <input aria-label={`${name} options`} className="property-input min-w-0 flex-1 font-mono" value={optionsText} onChange={event => setOptionsText(event.target.value)} />
        <button type="button" aria-label={`Apply ${name} style`} onClick={() => useEditorStore.getState().upsertCustomStyle(name, optionsText, command.enabled)} className="style-manager-action grid h-8 w-9 place-items-center rounded-lg">
          <Check size={14} />
        </button>
        <button type="button" aria-label={`Remove ${name} style`} onClick={() => useEditorStore.getState().removeCustomStyle(name)} className="style-manager-danger grid h-8 w-9 place-items-center rounded-lg">
          <Trash2 size={14} />
        </button>
      </div>
    </section>
  );
}

export function StyleManager() {
  const source = useEditorStore(state => state.source);
  const commands = useMemo(() => parseStyleCommands(source), [source]);
  const globalByKind = new Map(commands.filter(command => command.kind !== 'custom').map(command => [command.kind, command]));
  const customCommands = commands.filter(command => command.kind === 'custom');
  const [customName, setCustomName] = useState('mystyle');
  const [customOptions, setCustomOptions] = useState('color=blue!20!black,fill=blue!20,line width=.8pt');
  const [customError, setCustomError] = useState<string | null>(null);

  const createCustom = () => {
    const ok = useEditorStore.getState().upsertCustomStyle(customName, customOptions, true);
    setCustomError(ok ? null : 'Use letters, numbers, underscores or hyphens.');
  };
  const applyProfile = (profile: typeof STYLE_PROFILES[number]) => {
    const { source: currentSource, setSource } = useEditorStore.getState();
    const nextSource = (Object.entries(profile.styles) as Array<[GlobalStyleKind, string]>)
      .reduce((updatedSource, [kind, options]) => upsertGlobalStyleInSource(updatedSource, kind, options, true), currentSource);
    setSource(nextSource);
  };

  return (
    <div className="style-manager inspector-scroll h-full overflow-y-auto">
      <div className="space-y-3 p-3">
        <section className="style-manager-hero rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <span className="style-manager-hero-icon grid h-8 w-8 place-items-center rounded-lg"><Palette size={16} /></span>
            <div>
              <h2 className="style-manager-title text-sm font-bold">Style Manager</h2>
              <p className="style-manager-command font-mono text-[11px]">tkz-euclide setup</p>
            </div>
          </div>
        </section>

        <section className="property-card space-y-3">
          <header className="flex items-center gap-2">
            <span className="style-manager-icon grid h-8 w-8 shrink-0 place-items-center rounded-lg"><Palette size={16} className="text-indigo-500" /></span>
            <div>
              <h3 className="style-manager-title text-sm font-semibold">Style profiles</h3>
              <p className="style-manager-command text-[11px]">Apply a complete visual set</p>
            </div>
          </header>
          <div className="grid gap-2">
            {STYLE_PROFILES.map(profile => (
              <button key={profile.name} type="button" onClick={() => applyProfile(profile)} className="style-profile-button">
                <span className="font-semibold">{profile.name}</span>
                <span className="theme-muted text-[11px]">{profile.description}</span>
              </button>
            ))}
          </div>
        </section>

        {GLOBAL_STYLE_CONFIGS.map(config => (
          <GlobalStyleCard key={config.kind} config={config} command={globalByKind.get(config.kind)} />
        ))}

        <section className="property-card space-y-3">
          <header className="flex items-center gap-2">
            <span className="style-manager-icon style-manager-icon-warm grid h-8 w-8 shrink-0 place-items-center rounded-lg">{iconFor('custom')}</span>
            <div>
              <h3 className="style-manager-title text-sm font-semibold">Custom style</h3>
              <p className="style-manager-command font-mono text-[11px]">{'\\tkzSetUpStyle'}</p>
            </div>
          </header>
          <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-2">
            <label className="property-field-label">
              Name
              <input aria-label="Custom style name" className="property-input mt-1 font-mono" value={customName} onChange={event => setCustomName(event.target.value)} />
            </label>
            <label className="property-field-label">
              Options
              <input aria-label="Custom style options" className="property-input mt-1 font-mono" value={customOptions} onChange={event => setCustomOptions(event.target.value)} />
            </label>
          </div>
          <StyleOptionControls kind="custom" label="Custom style" optionsText={customOptions} setOptionsText={setCustomOptions} />
          {customError && <div className="style-manager-error flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold"><X size={13} />{customError}</div>}
          <button type="button" aria-label="Create custom style" onClick={createCustom} className="style-manager-create flex h-8 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold">
            <Plus size={14} /> Create style
          </button>
        </section>

        {customCommands.map(command => <CustomStyleCard key={command.id} command={command} />)}
      </div>
    </div>
  );
}
