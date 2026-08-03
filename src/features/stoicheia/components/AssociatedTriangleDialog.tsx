import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Network, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { AssociatedTriangleInput, AssociatedTriangleMode } from '../store';

interface AssociatedTriangleDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: AssociatedTriangleInput) => void;
}

const modes: { value: AssociatedTriangleMode; label: string; description: string }[] = [
  { value: 'orthic', label: 'Orthic', description: 'Feet of the three altitudes' },
  { value: 'centroid', label: 'Centroid', description: 'Midpoints of the three sides' },
  { value: 'medial', label: 'Medial', description: 'Alias of centroid' },
  { value: 'in', label: 'Incentral', description: 'Angle-bisector intersections with opposite sides' },
  { value: 'incentral', label: 'Incentral (alias)', description: 'Alias of in' },
  { value: 'ex', label: 'Excentral', description: 'The three excenters' },
  { value: 'excentral', label: 'Excentral (alias)', description: 'Alias of ex' },
  { value: 'extouch', label: 'Extouch', description: 'Tangency points of the excircles' },
  { value: 'intouch', label: 'Intouch', description: 'Tangency points of the incircle' },
  { value: 'contact', label: 'Contact', description: 'Alias of intouch' },
  { value: 'euler', label: 'Euler', description: 'Midpoints between vertices and orthocenter' },
  { value: 'symmedial', label: 'Symmedial', description: 'Intersections of symmedians with opposite sides' },
  { value: 'tangential', label: 'Tangential', description: 'Intersections of circumcircle tangents' },
  { value: 'feuerbach', label: 'Feuerbach', description: 'Tangencies of nine-point circle and excircles' },
];

export function AssociatedTriangleDialog({ open, pointNames, onCancel, onCreate }: AssociatedTriangleDialogProps) {
  const [mode, setMode] = useState<AssociatedTriangleMode>('centroid');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');
  const [usePrefix, setUsePrefix] = useState(false);
  const [prefix, setPrefix] = useState('M');

  useEffect(() => {
    if (!open) return;
    setMode('centroid');
    setP1(pointNames[0] ?? '');
    setP2(pointNames[1] ?? pointNames[0] ?? '');
    setP3(pointNames[2] ?? pointNames[0] ?? '');
    setUsePrefix(false);
    setPrefix('M');
  }, [open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  if (!open) return null;
  const cleanPrefix = prefix.trim();
  const selectedMode = modes.find(item => item.value === mode)!;
  const validation = pointNames.length < 3 ? 'Add at least three points to define the reference triangle.'
    : !p1 || !p2 || !p3 || new Set([p1, p2, p3]).size !== 3 ? 'Choose three distinct triangle vertices.'
      : usePrefix && !/^[A-Za-z][A-Za-z0-9]*$/.test(cleanPrefix) ? 'The name prefix must start with a Latin letter.' : null;
  const pointSelect = (label: string, value: string, setValue: (value: string) => void) => <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}<select value={value} onChange={event => setValue(event.target.value)} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100 outline-none focus:border-purple-400">{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>;

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="associated-triangle-title" className="theme-dialog w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300"><Network size={18} /></span><div><h2 id="associated-triangle-title" className="text-sm font-semibold">Associated triangle</h2><p className="mt-0.5 text-[11px] text-slate-500">Construct three related vertices with \tkzDefSpcTriangle.</p></div></div><button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close associated triangle dialog"><X size={16} className="mx-auto" /></button></header>
        <div className="space-y-4 p-5"><label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Associated triangle type<select value={mode} onChange={event => setMode(event.target.value as AssociatedTriangleMode)} className="block h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs normal-case text-slate-100 outline-none focus:border-purple-400">{modes.map(item => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}</select></label><div className="grid grid-cols-3 gap-3">{pointSelect('Vertex A', p1, setP1)}{pointSelect('Vertex B', p2, setP2)}{pointSelect('Vertex C', p3, setP3)}</div><div className="rounded-xl border border-slate-700/70 p-3"><label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={usePrefix} onChange={event => setUsePrefix(event.target.checked)} className="h-4 w-4 accent-purple-500" /> Use the `name` option</label>{usePrefix && <label className="property-field-label mt-3 text-slate-400">Vertex prefix<input value={prefix} onChange={event => setPrefix(event.target.value)} className="property-input mt-1.5 bg-slate-950 font-mono text-slate-100" aria-label="Vertex prefix" /><span className="mt-1 block text-[10px] normal-case tracking-normal text-slate-500">Creates {cleanPrefix || 'M'}a, {cleanPrefix || 'M'}b and {cleanPrefix || 'M'}c.</span></label>}</div><div className="rounded-xl border border-purple-500/15 bg-purple-500/5 px-3 py-2.5"><span className="text-xs font-semibold text-purple-300">{selectedMode.label}</span><p className="mt-1 text-[11px] text-slate-500">{selectedMode.description}</p></div>{validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}</div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button><button type="button" disabled={Boolean(validation)} onClick={() => onCreate({ mode, p1, p2, p3, namePrefix: usePrefix ? cleanPrefix : undefined })} className="h-9 rounded-lg bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40">Create associated triangle</button></footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
