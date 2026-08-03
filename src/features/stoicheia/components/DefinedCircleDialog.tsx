import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleDot, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { DefinedCircleInput, DefinedCircleMode } from '../store';

interface DefinedCircleDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: DefinedCircleInput) => void;
}

const modes: Array<{ value: DefinedCircleMode; label: string; description: string }> = [
  { value: 'R', label: 'Center and radius (R)', description: 'A center point and a numeric radius' },
  { value: 'diameter', label: 'Diameter', description: 'Two endpoints of a diameter' },
  { value: 'circum', label: 'Circumcircle', description: 'Circle through three triangle vertices' },
  { value: 'in', label: 'Incircle', description: 'Circle tangent to the three triangle sides' },
  { value: 'ex', label: 'Excircle', description: 'Excircle opposite the second vertex' },
  { value: 'euler', label: 'Euler circle', description: 'The triangle nine-point circle' },
  { value: 'nine', label: 'Nine-point circle', description: 'Alias of the Euler circle' },
  { value: 'spieker', label: 'Spieker circle', description: 'Incircle of the medial triangle' },
  { value: 'apollonius', label: 'Apollonius circle', description: 'Circle defined by a segment and coefficient K' },
  { value: 'orthogonal_from', label: 'Orthogonal from', description: 'Orthogonal circle with a specified center' },
  { value: 'orthogonal_through', label: 'Orthogonal through', description: 'Orthogonal circle through two specified points' },
];

const requirements = (mode: DefinedCircleMode) => {
  if (mode === 'R') return { labels: ['Center'], references: [] as string[] };
  if (mode === 'diameter') return { labels: ['Diameter endpoint A', 'Diameter endpoint B'], references: [] as string[] };
  if (mode === 'apollonius') return { labels: ['Segment point A', 'Segment point B'], references: [] as string[] };
  if (mode === 'orthogonal_from') return { labels: ['Base circle center O', 'Base circle point M'], references: ['New circle center'] };
  if (mode === 'orthogonal_through') return { labels: ['Base circle center O', 'Base circle point M'], references: ['Through point A', 'Through point B'] };
  return { labels: ['Triangle vertex A', 'Triangle vertex B', 'Triangle vertex C'], references: [] as string[] };
};

export function DefinedCircleDialog({ open, pointNames, onCancel, onCreate }: DefinedCircleDialogProps) {
  const [mode, setMode] = useState<DefinedCircleMode>('circum');
  const [points, setPoints] = useState<string[]>([]);
  const [references, setReferences] = useState<string[]>([]);
  const [value, setValue] = useState('2');

  const resetSelections = (nextMode: DefinedCircleMode) => {
    const config = requirements(nextMode);
    setPoints(config.labels.map((_, index) => pointNames[index] ?? pointNames[0] ?? ''));
    setReferences(config.references.map((_, index) => pointNames[config.labels.length + index] ?? pointNames[index] ?? pointNames[0] ?? ''));
    setValue('2');
  };

  useEffect(() => {
    if (!open) return;
    setMode('circum');
    resetSelections('circum');
  // pointNames is intentionally part of reset when the parsed document changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  if (!open) return null;
  const config = requirements(mode);
  const numericValue = Number(value);
  const selections = [...points, ...references];
  const requiredCount = config.labels.length + config.references.length;
  const validation = pointNames.length < requiredCount ? `Add at least ${requiredCount} points for this construction.`
    : selections.length !== requiredCount || selections.some(point => !point) || new Set(selections).size !== requiredCount ? `Choose ${requiredCount} distinct points.`
      : mode === 'R' && (!Number.isFinite(numericValue) || numericValue <= 0) ? 'Radius must be positive.'
        : mode === 'apollonius' && (!Number.isFinite(numericValue) || numericValue <= 0 || Math.abs(numericValue - 1) < 1e-12) ? 'K must be positive and different from 1.' : null;
  const selected = modes.find(item => item.value === mode)!;
  const select = (label: string, values: string[], setValues: (values: string[]) => void, index: number) => <label key={label} className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}<select value={values[index] ?? ''} onChange={event => setValues(values.map((point, pointIndex) => pointIndex === index ? event.target.value : point))} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100 outline-none focus:border-cyan-400">{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>;

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="defined-circle-title" className="theme-dialog w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300"><CircleDot size={18} /></span><div><h2 id="defined-circle-title" className="text-sm font-semibold">Define circle</h2><p className="mt-0.5 text-[11px] text-slate-500">Construct center and radius data with \tkzDefCircle.</p></div></div><button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close defined circle dialog"><X size={16} className="mx-auto" /></button></header>
        <div className="space-y-4 p-5"><label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Circle type<select aria-label="Circle definition" value={mode} onChange={event => { const next = event.target.value as DefinedCircleMode; setMode(next); resetSelections(next); }} className="block h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs normal-case text-slate-100 outline-none focus:border-cyan-400">{modes.map(item => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}</select></label><div className={`grid ${requiredCount >= 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>{config.labels.map((label, index) => select(label, points, setPoints, index))}{config.references.map((label, index) => select(label, references, setReferences, index))}</div>{(mode === 'R' || mode === 'apollonius') && <label className="property-field-label text-slate-400">{mode === 'R' ? 'Radius' : 'Coefficient K'}<input aria-label={mode === 'R' ? 'Circle radius' : 'Apollonius coefficient K'} type="number" min="0.01" step="0.1" value={value} onChange={event => setValue(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label>}<div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-3 py-2.5"><span className="text-xs font-semibold text-cyan-300">{selected.label}</span><p className="mt-1 text-[11px] text-slate-500">{selected.description}</p></div>{validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}</div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button><button type="button" disabled={Boolean(validation)} onClick={() => onCreate({ mode, points, references, value: mode === 'R' || mode === 'apollonius' ? numericValue : undefined })} className="h-9 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40">Create circle</button></footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
