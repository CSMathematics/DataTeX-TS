import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Braces, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';

interface VectorCoordinatesDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (p1: string, p2: string, macro: string) => void;
}

export function VectorCoordinatesDialog({ open, pointNames, onCancel, onCreate }: VectorCoordinatesDialogProps) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [macro, setMacro] = useState('V');

  useEffect(() => {
    if (!open) return;
    setP1(pointNames[0] ?? '');
    setP2(pointNames[1] ?? pointNames[0] ?? '');
    setMacro('V');
  }, [open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  if (!open) return null;
  const cleanMacro = macro.trim();
  const validation = pointNames.length < 2 ? 'Add at least two points to define a vector.'
    : !p1 || !p2 || p1 === p2 ? 'Choose two distinct vector points.'
      : !/^[A-Za-z]+$/.test(cleanMacro) ? 'The macro name must contain Latin letters only.' : null;
  const pointSelect = (label: string, value: string, setValue: (value: string) => void) => <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}<select value={value} onChange={event => setValue(event.target.value)} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100 outline-none focus:border-emerald-400">{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>;

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="vector-coordinates-title" className="theme-dialog w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"><Braces size={18} /></span><div><h2 id="vector-coordinates-title" className="text-sm font-semibold">Get vector coordinates</h2><p className="mt-0.5 text-[11px] text-slate-500">Insert \tkzGetVectxy and define two macros.</p></div></div><button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close vector coordinates dialog"><X size={16} className="mx-auto" /></button></header>
        <div className="space-y-4 p-5"><div className="grid grid-cols-2 gap-3">{pointSelect('Vector start', p1, setP1)}{pointSelect('Vector end', p2, setP2)}</div><label className="property-field-label text-slate-400">Macro prefix<input value={macro} onChange={event => setMacro(event.target.value)} className="property-input mt-1.5 bg-slate-950 font-mono text-slate-100" aria-label="Macro prefix" /></label><div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5 text-xs"><code>\{cleanMacro || 'V'}x</code><span className="text-slate-500"> and </span><code>\{cleanMacro || 'V'}y</code><span className="text-slate-500"> will contain the vector components.</span></div>{validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}</div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button><button type="button" disabled={Boolean(validation)} onClick={() => onCreate(p1, p2, cleanMacro)} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">Insert command</button></footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
