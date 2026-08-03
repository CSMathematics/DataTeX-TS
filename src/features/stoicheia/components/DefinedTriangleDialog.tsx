import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Triangle, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { DefinedTriangleInput, TriangleDefinitionMode } from '../store';

interface DefinedTriangleDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: DefinedTriangleInput) => void;
}

const modes: { value: TriangleDefinitionMode; label: string; description: string }[] = [
  { value: 'two_angles', label: 'Two angles', description: 'Triangle determined by its angles at A and B' },
  { value: 'equilateral', label: 'Equilateral', description: 'Three equal sides and 60° angles' },
  { value: 'half', label: 'Half', description: 'Right at B with AB = 2·BC' },
  { value: 'isosceles_right', label: 'Isosceles right', description: 'Right at the new vertex' },
  { value: 'pythagore', label: 'Pythagore', description: 'Right triangle proportional to 3–4–5' },
  { value: 'pythagoras', label: 'Pythagoras', description: 'Alias of pythagore' },
  { value: 'egyptian', label: 'Egyptian', description: 'Alias of the 3–4–5 triangle' },
  { value: 'school', label: 'School', description: 'Angles of 30°, 60° and 90°' },
  { value: 'gold', label: 'Gold', description: 'Golden right triangle' },
  { value: 'euclid', label: 'Euclid', description: 'Golden triangle with A as apex' },
  { value: 'golden', label: 'Golden', description: 'Angles 72°, 72° and 36°, new point as apex' },
  { value: 'sublime', label: 'Sublime', description: 'Alias of the golden triangle' },
  { value: 'cheops', label: 'Cheops', description: 'Isosceles triangle proportional to 2, φ and φ' },
];

export function DefinedTriangleDialog({ open, pointNames, onCancel, onCreate }: DefinedTriangleDialogProps) {
  const [mode, setMode] = useState<TriangleDefinitionMode>('equilateral');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [angle1, setAngle1] = useState('50');
  const [angle2, setAngle2] = useState('70');
  const [swap, setSwap] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('equilateral');
    setP1(pointNames[0] ?? '');
    setP2(pointNames[1] ?? pointNames[0] ?? '');
    setAngle1('50');
    setAngle2('70');
    setSwap(false);
  }, [open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  if (!open) return null;
  const firstAngle = Number(angle1);
  const secondAngle = Number(angle2);
  const selectedMode = modes.find(item => item.value === mode)!;
  const validation = pointNames.length < 2 ? 'Add at least two points to define the initial side.'
    : !p1 || !p2 || p1 === p2 ? 'Choose two distinct base points.'
      : mode === 'two_angles' && (!Number.isFinite(firstAngle) || !Number.isFinite(secondAngle) || firstAngle <= 0 || secondAngle <= 0 || firstAngle + secondAngle >= 180) ? 'Angles must be positive and sum to less than 180°.' : null;
  const pointSelect = (label: string, value: string, setValue: (value: string) => void) => <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}<select value={value} onChange={event => setValue(event.target.value)} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100 outline-none focus:border-rose-400">{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>;

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="defined-triangle-title" className="theme-dialog w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300"><Triangle size={18} /></span><div><h2 id="defined-triangle-title" className="text-sm font-semibold">Define triangle</h2><p className="mt-0.5 text-[11px] text-slate-500">Construct the third vertex with \tkzDefTriangle.</p></div></div><button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close defined triangle dialog"><X size={16} className="mx-auto" /></button></header>
        <div className="space-y-4 p-5"><label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Triangle type<select value={mode} onChange={event => setMode(event.target.value as TriangleDefinitionMode)} className="block h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs normal-case text-slate-100 outline-none focus:border-rose-400">{modes.map(item => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}</select></label><div className="grid grid-cols-2 gap-3">{pointSelect('First point A', p1, setP1)}{pointSelect('Second point B', p2, setP2)}</div>{mode === 'two_angles' && <div className="grid grid-cols-2 gap-3"><label className="property-field-label text-slate-400">Angle at A<input type="number" min="0.1" max="179" step="1" value={angle1} onChange={event => setAngle1(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label><label className="property-field-label text-slate-400">Angle at B<input type="number" min="0.1" max="179" step="1" value={angle2} onChange={event => setAngle2(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label></div>}<label className="flex items-center gap-2 rounded-xl border border-slate-700/70 px-3 py-2.5 text-xs text-slate-400"><input type="checkbox" checked={swap} onChange={event => setSwap(event.target.checked)} className="h-4 w-4 accent-rose-500" /> Reflect the new vertex across AB (`swap`)</label><div className="rounded-xl border border-rose-500/15 bg-rose-500/5 px-3 py-2.5"><span className="text-xs font-semibold text-rose-300">{selectedMode.label}</span><p className="mt-1 text-[11px] text-slate-500">{selectedMode.description}</p></div>{validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}</div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button><button type="button" disabled={Boolean(validation)} onClick={() => onCreate({ mode, p1, p2, angle1: mode === 'two_angles' ? firstAngle : undefined, angle2: mode === 'two_angles' ? secondAngle : undefined, swap })} className="h-9 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40">Create triangle</button></footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
