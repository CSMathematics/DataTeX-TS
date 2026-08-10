import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Construction, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { ShowLineInput, ShowLineMode } from '../store';

interface Props {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: ShowLineInput) => void;
}

const modes: { value: ShowLineMode; label: string }[] = [
  { value: 'mediator', label: 'Perpendicular bisector (mediator)' },
  { value: 'perpendicular', label: 'Perpendicular through point' },
  { value: 'orthogonal', label: 'Orthogonal through point' },
  { value: 'parallel', label: 'Parallel through point' },
  { value: 'bisector', label: 'Angle bisector construction' },
];

export function ShowLineDialog({ open, pointNames, onCancel, onCreate }: Props) {
  const [mode, setMode] = useState<ShowLineMode>('mediator');
  const [points, setPoints] = useState<string[]>([]);
  const [through, setThrough] = useState('');
  const [length, setLength] = useState('1');
  const [ratio, setRatio] = useState('.5');
  const [gap, setGap] = useState('2');
  const [size, setSize] = useState('1');
  const [factor, setFactor] = useState('1');

  const pointCount = mode === 'bisector' ? 3 : 2;
  const needsThrough = ['perpendicular', 'orthogonal', 'parallel'].includes(mode);
  useEffect(() => {
    if (!open) return;
    setMode('mediator'); setPoints(pointNames.slice(0, 3)); setThrough(pointNames[2] ?? pointNames[0] ?? '');
    setLength('1'); setRatio('.5'); setGap('2'); setSize('1'); setFactor('1');
  }, [open, pointNames]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, [open, onCancel]);

  const selected = points.slice(0, pointCount);
  const numbers = [length, ratio, gap, size, factor].map(Number);
  const error = useMemo(() => pointNames.length < pointCount ? `Add at least ${pointCount} points.`
    : selected.some(point => !point) || new Set(selected).size !== selected.length ? 'Choose distinct defining points.'
      : needsThrough && !through ? 'Choose the point through which the line passes.'
        : numbers.some(value => !Number.isFinite(value)) ? 'All numeric options must be valid.' : null,
  [needsThrough, numbers.join('|'), pointCount, pointNames.length, selected.join('|'), through]);
  if (!open) return null;

  const selectPoint = (index: number, label: string) => <label className="property-field-label text-slate-400">{label}<select value={points[index] ?? ''} onChange={event => setPoints(current => { const next = [...current]; next[index] = event.target.value; return next; })} className="property-input mt-1.5 bg-slate-950 text-slate-100">{pointNames.map(point => <option key={point}>{point}</option>)}</select></label>;
  const numberField = (label: string, value: string, setValue: (value: string) => void, step = '.1') => <label className="property-field-label text-slate-400">{label}<input type="number" step={step} value={value} onChange={event => setValue(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label>;
  const labels = mode === 'bisector' ? ['First side', 'Vertex', 'Second side'] : ['Base point 1', 'Base point 2'];
  return createPortal(<div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}><section role="dialog" aria-modal="true" aria-labelledby="show-line-title" className="theme-dialog w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl" onMouseDown={event => event.stopPropagation()}><header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><Construction size={19} className="text-cyan-400" /><div><h2 id="show-line-title" className="text-sm font-semibold">Show line construction</h2><p className="text-[11px] text-slate-500">Configure `\tkzShowLine` compass traces.</p></div></div><button type="button" aria-label="Close show line dialog" onClick={onCancel}><X size={17} /></button></header><div className="space-y-4 p-5"><label className="property-field-label text-slate-400">Construction<select aria-label="Show line mode" value={mode} onChange={event => setMode(event.target.value as ShowLineMode)} className="property-input mt-1.5 bg-slate-950 text-slate-100">{modes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="grid grid-cols-2 gap-3">{labels.map((label, index) => selectPoint(index, label))}{needsThrough && <label className="property-field-label text-slate-400">Through point<select aria-label="Show line through point" value={through} onChange={event => setThrough(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100">{pointNames.map(point => <option key={point}>{point}</option>)}</select></label>}</div><div className="grid grid-cols-3 gap-3">{numberField('Arc length', length, setLength)}{numberField('Ratio', ratio, setRatio)}{numberField('Gap', gap, setGap)}{numberField('Arc size', size, setSize)}{numberField('Coefficient K', factor, setFactor)}</div>{error && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{error}</p>}</div><footer className="flex justify-end gap-2 border-t border-white/10 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 px-3 text-xs text-slate-400">Cancel</button><button type="button" disabled={Boolean(error)} onClick={() => onCreate({ mode, points: selected, through: needsThrough ? through : undefined, length: Number(length), ratio: Number(ratio), gap: Number(gap), size: Number(size), factor: Number(factor) })} className="h-9 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white disabled:opacity-40">Insert construction</button></footer></section></div>, getScopedPortalTarget());
}
