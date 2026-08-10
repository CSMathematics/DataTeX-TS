import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LocateFixed, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { TriangleCenterOption } from '../store';

interface TriangleCenterDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (option: TriangleCenterOption, p1: string, p2: string, p3: string) => void;
}

const centerOptions: { value: TriangleCenterOption; label: string; description: string }[] = [
  { value: 'ortho', label: 'Orthocenter', description: 'Intersection of altitudes' },
  { value: 'orthic', label: 'Orthic (alias)', description: 'Alias of ortho' },
  { value: 'centroid', label: 'Centroid', description: 'Intersection of medians' },
  { value: 'median', label: 'Median (alias)', description: 'Alias of centroid' },
  { value: 'circum', label: 'Circumcenter', description: 'Center of the circumscribed circle' },
  { value: 'in', label: 'Incenter', description: 'Center of the incircle' },
  { value: 'ex', label: 'Excenter', description: 'Center of an excircle' },
  { value: 'euler', label: 'Euler center', description: 'Center of the nine-point circle' },
  { value: 'gergonne', label: 'Gergonne point', description: 'Defined by the contact triangle' },
  { value: 'symmedian', label: 'Symmedian point', description: 'Lemoine / Grebe center' },
  { value: 'lemoine', label: 'Lemoine (alias)', description: 'Alias of symmedian' },
  { value: 'grebe', label: 'Grebe (alias)', description: 'Alias of symmedian' },
  { value: 'spieker', label: 'Spieker center', description: 'Incenter of the medial triangle' },
  { value: 'nagel', label: 'Nagel center', description: 'Concurrency of the splitters' },
  { value: 'mittenpunkt', label: 'Mittenpunkt', description: 'Symmedian point of the excentral triangle' },
  { value: 'feuerbach', label: 'Feuerbach point', description: 'Tangency of incircle and nine-point circle' },
];

export function TriangleCenterDialog({ open, pointNames, onCancel, onCreate }: TriangleCenterDialogProps) {
  const [option, setOption] = useState<TriangleCenterOption>('circum');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');

  useEffect(() => {
    if (!open) return;
    setOption('circum');
    setP1(pointNames[0] ?? '');
    setP2(pointNames[1] ?? pointNames[0] ?? '');
    setP3(pointNames[2] ?? pointNames[0] ?? '');
  }, [open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  if (!open) return null;
  const invalid = pointNames.length < 3 || !p1 || !p2 || !p3 || new Set([p1, p2, p3]).size < 3;
  const selectedOption = centerOptions.find(item => item.value === option)!;
  const pointSelect = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}<select value={value} onChange={event => onChange(event.target.value)} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100 outline-none focus:border-indigo-400">{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>
  );

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="triangle-center-title" className="theme-dialog w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300"><LocateFixed size={18} /></span><div><h2 id="triangle-center-title" className="text-sm font-semibold">Triangle center</h2><p className="mt-0.5 text-[11px] text-slate-500">Select vertices and a tkz-euclide center option.</p></div></div><button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close triangle center dialog"><X size={16} className="mx-auto" /></button></header>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">{pointSelect('Vertex A', p1, setP1)}{pointSelect('Vertex B', p2, setP2)}{pointSelect('Vertex C', p3, setP3)}</div>
          <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Center type<select value={option} onChange={event => setOption(event.target.value as TriangleCenterOption)} className="block h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs normal-case text-slate-100 outline-none focus:border-rose-400">{centerOptions.map(item => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}</select></label>
          <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 px-3 py-2.5"><span className="text-xs font-semibold text-rose-200">{selectedOption.label}</span><p className="mt-1 text-[11px] text-slate-500">{selectedOption.description} · <span className="font-mono text-slate-400">[{option}]</span></p></div>
          {invalid && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Choose three distinct points.</div>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button><button type="button" disabled={invalid} onClick={() => onCreate(option, p1, p2, p3)} className="h-9 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40">Create center</button></footer>
      </section>
    </div>,
    getScopedPortalTarget(),
  );
}
