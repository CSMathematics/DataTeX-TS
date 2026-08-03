import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleDot, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import type { RadicalAxisInput } from '../store';

interface RadicalAxisDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: RadicalAxisInput) => void;
}

export function RadicalAxisDialog({ open, pointNames, onCancel, onCreate }: RadicalAxisDialogProps) {
  const [c1, setC1] = useState('');
  const [r1, setR1] = useState('');
  const [c2, setC2] = useState('');
  const [r2, setR2] = useState('');

  useEffect(() => {
    if (!open) return;
    setC1(pointNames[0] ?? '');
    setR1(pointNames[1] ?? pointNames[0] ?? '');
    setC2(pointNames[2] ?? pointNames[0] ?? '');
    setR2(pointNames[3] ?? pointNames[1] ?? pointNames[0] ?? '');
  }, [open, pointNames]);

  const validation = useMemo(() => {
    if (pointNames.length < 3) return 'Add at least three points.';
    if (!c1 || !r1 || !c2 || !r2) return 'Choose every point.';
    if (c1 === r1 || c2 === r2) return 'Each circle needs a distinct radius point.';
    if (c1 === c2) return 'The circles must have distinct centers.';
    return '';
  }, [c1, c2, pointNames.length, r1, r2]);

  if (!open) return null;

  const selectPoint = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="property-field-label text-slate-400">
      {label}
      <select aria-label={label} value={value} onChange={event => onChange(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100">
        {pointNames.map(point => <option key={point} value={point}>{point}</option>)}
      </select>
    </label>
  );

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="radical-axis-title" className="theme-dialog w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300"><CircleDot size={18} /></span>
            <div>
              <h2 id="radical-axis-title" className="text-sm font-semibold">Radical axis</h2>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">\tkzDefRadicalAxis</p>
            </div>
          </div>
          <button onClick={onCancel} aria-label="Close radical axis dialog" className="h-8 w-8 text-slate-500"><X size={16} className="mx-auto" /></button>
        </header>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            {selectPoint('Circle 1 center', c1, setC1)}
            {selectPoint('Circle 1 radius point', r1, setR1)}
            {selectPoint('Circle 2 center', c2, setC2)}
            {selectPoint('Circle 2 radius point', r2, setR2)}
          </div>
          {validation && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{validation}</div>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4">
          <button onClick={onCancel} className="h-9 px-3 text-xs text-slate-400">Cancel</button>
          <button disabled={Boolean(validation)} onClick={() => onCreate({ circle1: [c1, r1], circle2: [c2, r2] })} className="h-9 rounded-lg bg-purple-600 px-4 text-xs font-semibold text-white disabled:opacity-40">Create axis</button>
        </footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
