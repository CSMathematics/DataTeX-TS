import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { ShowTransformationInput, ShowTransformationMode } from '../store';

interface Props {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: ShowTransformationInput) => void;
}

const modes: { value: ShowTransformationMode; label: string }[] = [
  { value: 'translation', label: 'Translation construction' },
  { value: 'reflection', label: 'Reflection construction' },
  { value: 'symmetry', label: 'Central symmetry construction' },
  { value: 'projection', label: 'Projection construction' },
];

export function ShowTransformationDialog({ open, pointNames, onCancel, onCreate }: Props) {
  const [mode, setMode] = useState<ShowTransformationMode>('translation');
  const [source, setSource] = useState('');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [length, setLength] = useState('1');
  const [ratio, setRatio] = useState('.5');
  const [gap, setGap] = useState('2');
  const [size, setSize] = useState('1');
  const [factor, setFactor] = useState('1');

  const referenceCount = mode === 'symmetry' ? 1 : 2;
  const references = [first, second].slice(0, referenceCount);

  useEffect(() => {
    if (!open) return;
    setMode('translation');
    setSource(pointNames[0] ?? '');
    setFirst(pointNames[1] ?? pointNames[0] ?? '');
    setSecond(pointNames[2] ?? pointNames[0] ?? '');
    setLength('1'); setRatio('.5'); setGap('2'); setSize('1'); setFactor('1');
  }, [open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onCancel]);

  const numbers = [length, ratio, gap, size, factor].map(Number);
  const error = useMemo(() => pointNames.length < (mode === 'symmetry' ? 1 : 2) ? 'Add enough points for this construction.'
    : !source || references.some(point => !point) ? 'Complete all point fields.'
      : ['translation', 'reflection', 'projection'].includes(mode) && first === second ? 'Choose distinct reference points.'
        : numbers.some(value => !Number.isFinite(value)) ? 'All numeric options must be valid.' : null,
  [first, mode, numbers.join('|'), pointNames.length, references.join('|'), second, source]);

  if (!open) return null;

  const pointSelect = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="property-field-label text-slate-400">
      {label}
      <select value={value} onChange={event => onChange(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100">
        {pointNames.map(point => <option key={point} value={point}>{point}</option>)}
      </select>
    </label>
  );
  const numberField = (label: string, value: string, onChange: (value: string) => void, step = '.1') => (
    <label className="property-field-label text-slate-400">
      {label}
      <input aria-label={`Show transformation ${label.toLowerCase()}`} type="number" step={step} value={value} onChange={event => onChange(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" />
    </label>
  );
  const referenceLabels = mode === 'translation' ? ['Vector from', 'Vector to']
    : mode === 'symmetry' ? ['Center']
      : ['Line point 1', 'Line point 2'];

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="show-transformation-title" className="theme-dialog w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <RefreshCw size={19} className="text-violet-400" />
            <div>
              <h2 id="show-transformation-title" className="text-sm font-semibold">Show transformation</h2>
              <p className="text-[11px] text-slate-500">Configure `\tkzShowTransformation` construction traces.</p>
            </div>
          </div>
          <button type="button" aria-label="Close show transformation dialog" onClick={onCancel}><X size={17} /></button>
        </header>
        <div className="space-y-4 p-5">
          <label className="property-field-label text-slate-400">
            Transformation
            <select aria-label="Show transformation mode" value={mode} onChange={event => setMode(event.target.value as ShowTransformationMode)} className="property-input mt-1.5 bg-slate-950 text-slate-100">
              {modes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {pointSelect('Point to show', source, setSource)}
            {referenceLabels.map((label, index) => pointSelect(label, [first, second][index], [setFirst, setSecond][index]))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {numberField('Arc length', length, setLength)}
            {numberField('Ratio', ratio, setRatio)}
            {numberField('Gap', gap, setGap)}
            {numberField('Arc size', size, setSize)}
            {numberField('Coefficient K', factor, setFactor)}
          </div>
          {error && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button type="button" onClick={onCancel} className="h-9 px-3 text-xs text-slate-400">Cancel</button>
          <button type="button" disabled={Boolean(error)} onClick={() => onCreate({ mode, source, references, length: Number(length), ratio: Number(ratio), gap: Number(gap), size: Number(size), factor: Number(factor) })} className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-40">Insert construction</button>
        </footer>
      </section>
    </div>,
    getScopedPortalTarget(),
  );
}
