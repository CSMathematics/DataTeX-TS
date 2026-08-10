import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CopyPlus, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import type { DuplicateSegmentInput } from '../store';

interface DuplicateSegmentDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: DuplicateSegmentInput) => void;
}

export function DuplicateSegmentDialog({ open, pointNames, onCancel, onCreate }: DuplicateSegmentDialogProps) {
  const [rayStart, setRayStart] = useState('');
  const [rayThrough, setRayThrough] = useState('');
  const [segmentStart, setSegmentStart] = useState('');
  const [segmentEnd, setSegmentEnd] = useState('');

  useEffect(() => {
    if (!open) return;
    setRayStart(pointNames[0] ?? '');
    setRayThrough(pointNames[1] ?? pointNames[0] ?? '');
    setSegmentStart(pointNames[0] ?? '');
    setSegmentEnd(pointNames[1] ?? pointNames[0] ?? '');
  }, [open, pointNames]);

  const validation = useMemo(() => {
    if (pointNames.length < 2) return 'Add at least two points.';
    if (!rayStart || !rayThrough || !segmentStart || !segmentEnd) return 'Choose every point.';
    if (rayStart === rayThrough) return 'The target ray needs two distinct points.';
    if (segmentStart === segmentEnd) return 'The copied segment needs two distinct endpoints.';
    return '';
  }, [pointNames.length, rayStart, rayThrough, segmentStart, segmentEnd]);

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
      <section role="dialog" aria-modal="true" aria-labelledby="duplicate-segment-title" className="theme-dialog w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300"><CopyPlus size={18} /></span>
            <div>
              <h2 id="duplicate-segment-title" className="text-sm font-semibold">Duplicate segment</h2>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">\tkzDuplicateSegment</p>
            </div>
          </div>
          <button onClick={onCancel} aria-label="Close duplicate segment dialog" className="h-8 w-8 text-slate-500"><X size={16} className="mx-auto" /></button>
        </header>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            {selectPoint('Ray start', rayStart, setRayStart)}
            {selectPoint('Ray through', rayThrough, setRayThrough)}
            {selectPoint('Segment start', segmentStart, setSegmentStart)}
            {selectPoint('Segment end', segmentEnd, setSegmentEnd)}
          </div>
          {validation && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{validation}</div>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4">
          <button onClick={onCancel} className="h-9 px-3 text-xs text-slate-400">Cancel</button>
          <button disabled={Boolean(validation)} onClick={() => onCreate({ rayStart, rayThrough, segmentStart, segmentEnd })} className="h-9 rounded-lg bg-sky-600 px-4 text-xs font-semibold text-white disabled:opacity-40">Create point</button>
        </footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
