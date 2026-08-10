import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { CircleTransformationInput, CircleTransformationMode } from '../store';

interface Props { open: boolean; pointNames: string[]; onCancel: () => void; onCreate: (input: CircleTransformationInput) => void; }
const modes: Array<{ value: CircleTransformationMode; label: string }> = [
  { value: 'translation', label: 'Translation' }, { value: 'homothety', label: 'Homothety' },
  { value: 'reflection', label: 'Reflection' }, { value: 'symmetry', label: 'Central symmetry' },
  { value: 'projection', label: 'Projection' }, { value: 'rotation', label: 'Rotation' }, { value: 'inversion', label: 'Inversion' },
];

export function CircleTransformationDialog({ open, pointNames, onCancel, onCreate }: Props) {
  const [mode, setMode] = useState<CircleTransformationMode>('translation');
  const [circle, setCircle] = useState<string[]>([]);
  const [references, setReferences] = useState<string[]>([]);
  const [value, setValue] = useState('0.5');
  const requirement = useMemo(() => mode === 'translation' ? ['Vector from', 'Vector to'] : mode === 'homothety' ? ['Center'] : mode === 'reflection' || mode === 'projection' ? ['Line point 1', 'Line point 2'] : mode === 'symmetry' || mode === 'rotation' ? ['Center'] : ['Inversion center', 'Circle through'], [mode]);
  const reset = (next: CircleTransformationMode) => { setCircle([pointNames[0] ?? '', pointNames[1] ?? '']); setReferences(requirementFor(next).map((_, index) => pointNames[index + 2] ?? pointNames[index] ?? '')); setValue(next === 'rotation' ? '30' : '0.5'); };
  useEffect(() => { if (open) { setMode('translation'); reset('translation'); } }, [open, pointNames]);
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onCancel, open]);
  if (!open) return null;
  const needsValue = mode === 'homothety' || mode === 'rotation';
  const all = [...circle, ...references];
  const validation = pointNames.length < 2 ? 'Add at least two points.' : circle[0] === circle[1] ? 'The circle pair must contain distinct points.' : all.some(point => !point) ? 'Complete all point fields.' : needsValue && !Number.isFinite(Number(value)) ? 'Enter a numeric value.' : (mode === 'translation' || mode === 'reflection' || mode === 'projection' || mode === 'inversion') && references[0] === references[1] ? 'The defining pair must be distinct.' : null;
  const select = (label: string, values: string[], setter: (values: string[]) => void, index: number) => <label key={label} className="property-field-label text-slate-400">{label}<select value={values[index] ?? ''} onChange={event => setter(values.map((point, i) => i === index ? event.target.value : point))} className="property-input mt-1.5 bg-slate-950 font-mono text-slate-100">{pointNames.map(point => <option key={point}>{point}</option>)}</select></label>;
  return createPortal(<div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}><section role="dialog" aria-modal="true" aria-labelledby="circle-transformation-title" className="theme-dialog w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}><header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300"><RefreshCw size={18} /></span><div><h2 id="circle-transformation-title" className="text-sm font-semibold">Transform circle</h2><p className="mt-0.5 text-[11px] text-slate-500">Define its image with \tkzDefCircleBy.</p></div></div><button onClick={onCancel} aria-label="Close circle transformation dialog" className="h-8 w-8 text-slate-500"><X size={16} className="mx-auto" /></button></header><div className="space-y-4 p-5"><label className="property-field-label text-slate-400">Transformation<select aria-label="Circle transformation" value={mode} onChange={event => { const next = event.target.value as CircleTransformationMode; setMode(next); setReferences(requirementFor(next).map((_, index) => pointNames[index + 2] ?? pointNames[index] ?? '')); setValue(next === 'rotation' ? '30' : '0.5'); }} className="property-input mt-1.5 bg-slate-950 text-slate-100">{modes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="grid grid-cols-2 gap-3">{select('Circle center', circle, setCircle, 0)}{select('Point on circle', circle, setCircle, 1)}{requirement.map((label, index) => select(label, references, setReferences, index))}</div>{needsValue && <label className="property-field-label text-slate-400">{mode === 'homothety' ? 'Ratio' : 'Angle (degrees)'}<input aria-label={mode === 'homothety' ? 'Circle homothety ratio' : 'Circle rotation angle'} type="number" value={value} onChange={event => setValue(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label>}{mode === 'projection' && <p className="text-[11px] text-amber-300">Projection is documented by tkz-euclide but may require a recent package version.</p>}{validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}</div><footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button onClick={onCancel} className="h-9 px-3 text-xs text-slate-400">Cancel</button><button disabled={Boolean(validation)} onClick={() => onCreate({ mode, center: circle[0], radiusPoint: circle[1], references, value: needsValue ? value : undefined })} className="h-9 rounded-lg bg-fuchsia-600 px-4 text-xs font-semibold text-white disabled:opacity-40">Transform circle</button></footer></section></div>, getScopedPortalTarget());
}

function requirementFor(mode: CircleTransformationMode) {
  if (mode === 'translation') return ['Vector from', 'Vector to'];
  if (mode === 'homothety' || mode === 'symmetry' || mode === 'rotation') return ['Center'];
  if (mode === 'reflection' || mode === 'projection') return ['Line point 1', 'Line point 2'];
  return ['Inversion center', 'Circle through'];
}
