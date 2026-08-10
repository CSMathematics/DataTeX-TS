import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoveUpRight, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { VectorPointInput, VectorPointMode } from '../store';

interface VectorPointDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: VectorPointInput) => void;
}

const modes: { value: VectorPointMode; label: string; description: string }[] = [
  { value: 'orthogonal', label: 'Orthogonal', description: 'Perpendicular vector with the original length' },
  { value: 'orthogonal_normed', label: 'Orthogonal normed', description: 'Perpendicular unit vector' },
  { value: 'linear', label: 'Linear', description: 'A multiple of the original vector' },
  { value: 'linear_normed', label: 'Linear normed', description: 'A multiple of the normalized vector' },
  { value: 'colinear', label: 'Colinear at point', description: 'Copy the vector to another anchor' },
  { value: 'colinear_normed', label: 'Colinear normed at point', description: 'Copy its unit direction to another anchor' },
];

export function VectorPointDialog({ open, pointNames, onCancel, onCreate }: VectorPointDialogProps) {
  const [mode, setMode] = useState<VectorPointMode>('orthogonal');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [anchor, setAnchor] = useState('');
  const [factor, setFactor] = useState('1');

  useEffect(() => {
    if (!open) return;
    setMode('orthogonal');
    setP1(pointNames[0] ?? '');
    setP2(pointNames[1] ?? pointNames[0] ?? '');
    setAnchor(pointNames[2] ?? pointNames[0] ?? '');
    setFactor('1');
  }, [open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  if (!open) return null;
  const isColinear = mode === 'colinear' || mode === 'colinear_normed';
  const numericFactor = Number(factor);
  const validation = pointNames.length < 2 ? 'Add at least two points to define a vector.'
    : !p1 || !p2 || p1 === p2 ? 'Choose two distinct vector points.'
      : isColinear && !anchor ? 'Choose the point where the copied vector starts.'
        : !Number.isFinite(numericFactor) ? 'K must be a valid number.' : null;
  const selectedMode = modes.find(item => item.value === mode)!;
  const pointSelect = (label: string, value: string, setValue: (value: string) => void) => <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}<select value={value} onChange={event => setValue(event.target.value)} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100 outline-none focus:border-sky-400">{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>;

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="vector-point-title" className="theme-dialog w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300"><MoveUpRight size={18} /></span><div><h2 id="vector-point-title" className="text-sm font-semibold">Vector-defined point</h2><p className="mt-0.5 text-[11px] text-slate-500">Create a point with \tkzDefPointWith.</p></div></div><button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close vector point dialog"><X size={16} className="mx-auto" /></button></header>
        <div className="space-y-4 p-5">
          <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Vector condition<select value={mode} onChange={event => setMode(event.target.value as VectorPointMode)} className="block h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs normal-case text-slate-100 outline-none focus:border-sky-400">{modes.map(item => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">{pointSelect('Vector start', p1, setP1)}{pointSelect('Vector end', p2, setP2)}{isColinear && pointSelect('Copy at point', anchor, setAnchor)}<label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Multiplier K<input type="number" step="0.1" value={factor} onChange={event => setFactor(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label></div>
          <div className="rounded-xl border border-sky-500/15 bg-sky-500/5 px-3 py-2.5"><span className="text-xs font-semibold text-sky-300">{selectedMode.label}</span><p className="mt-1 text-[11px] text-slate-500">{selectedMode.description} · K={factor || '—'}</p></div>
          {validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button><button type="button" disabled={Boolean(validation)} onClick={() => onCreate({ mode, p1, p2, anchor: isColinear ? anchor : undefined, factor: numericFactor })} className="h-9 rounded-lg bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40">Create point</button></footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
