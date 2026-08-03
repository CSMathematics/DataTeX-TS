import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dice5, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { RandomPointInput, RandomPointMode } from '../store';

interface Props {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: RandomPointInput) => void;
}

const modes: Array<{ value: RandomPointMode; label: string; description: string }> = [
  { value: 'rectangle', label: 'Rectangle', description: 'Inside the axis-aligned rectangle defined by two opposite corners.' },
  { value: 'segment', label: 'Segment', description: 'On the finite segment between two points.' },
  { value: 'line', label: 'Line', description: 'On the infinite line through two points.' },
  { value: 'circle', label: 'Circle with radius', description: 'On a circle defined by center and numeric radius.' },
  { value: 'circle_through', label: 'Circle through point', description: 'On the circumference defined by center and one point.' },
  { value: 'disk_through', label: 'Disk through point', description: 'Inside the disk defined by center and one boundary point.' },
];

export function RandomPointDialog({ open, pointNames, onCancel, onCreate }: Props) {
  const [mode, setMode] = useState<RandomPointMode>('rectangle');
  const [references, setReferences] = useState<string[]>([]);
  const [radius, setRadius] = useState('2');

  useEffect(() => {
    if (!open) return;
    setMode('rectangle');
    setReferences([pointNames[0] ?? '', pointNames[1] ?? '']);
    setRadius('2');
  }, [open, pointNames]);

  if (!open) return null;
  const count = mode === 'circle' ? 1 : 2;
  const activeReferences = references.slice(0, count);
  const numericRadius = Number(radius);
  const labels = mode === 'rectangle' ? ['First corner', 'Opposite corner']
    : mode === 'segment' || mode === 'line' ? ['First point', 'Second point']
      : mode === 'circle' ? ['Center'] : ['Center', 'Point on circumference'];
  const validation = pointNames.length < count ? `Add at least ${count} point${count === 1 ? '' : 's'}.`
    : activeReferences.some(point => !point) || new Set(activeReferences).size !== count ? 'Choose distinct reference points.'
      : mode === 'circle' && (!Number.isFinite(numericRadius) || numericRadius <= 0) ? 'Radius must be positive.' : '';
  const selected = modes.find(item => item.value === mode)!;

  const setReference = (index: number, value: string) => setReferences(current => {
    const next = [...current];
    next[index] = value;
    return next;
  });

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="random-point-title" className="theme-dialog w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><Dice5 size={18} /></span><div><h2 id="random-point-title" className="text-sm font-semibold">Random point</h2><p className="mt-0.5 text-[11px] text-slate-500">Insert \tkzDefRandPointOn and retain the result.</p></div></div><button onClick={onCancel} aria-label="Close random point dialog" className="h-8 w-8 text-slate-500"><X size={16} className="mx-auto" /></button></header>
        <div className="space-y-4 p-5">
          <label className="property-field-label text-slate-400">Region<select aria-label="Random point mode" value={mode} onChange={event => { const next = event.target.value as RandomPointMode; setMode(next); setReferences(next === 'circle' ? [pointNames[0] ?? ''] : [pointNames[0] ?? '', pointNames[1] ?? '']); }} className="property-input mt-1.5 bg-slate-950 text-slate-100">{modes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <div className={`grid gap-3 ${count === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>{labels.map((label, index) => <label key={label} className="property-field-label text-slate-400">{label}<select aria-label={label} value={activeReferences[index] ?? ''} onChange={event => setReference(index, event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100">{pointNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>)}</div>
          {mode === 'circle' && <label className="property-field-label text-slate-400">Radius<input aria-label="Random circle radius" type="number" min="0.01" step="0.1" value={radius} onChange={event => setRadius(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label>}
          <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-3 py-2.5 text-xs text-slate-400">{selected.description}<br /><span className="text-slate-500">Instant preview uses a stable representative position; LaTeX generates the actual random point.</span></div>
          {validation && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{validation}</div>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button onClick={onCancel} className="h-9 px-3 text-xs text-slate-400">Cancel</button><button disabled={Boolean(validation)} onClick={() => onCreate({ mode, references: activeReferences, radius: mode === 'circle' ? numericRadius : undefined })} className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-40">Create random point</button></footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
