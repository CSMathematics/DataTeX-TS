import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { PointTransformationInput, PointTransformationMode } from '../store';

interface PointTransformationDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: PointTransformationInput) => void;
}

export const pointTransformationModes: { value: PointTransformationMode; label: string; description: string }[] = [
  { value: 'translation', label: 'Translation', description: 'Move by the vector from one point to another' },
  { value: 'homothety', label: 'Homothety', description: 'Scale around a center using a ratio' },
  { value: 'reflection', label: 'Reflection', description: 'Reflect over a line defined by two points' },
  { value: 'symmetry', label: 'Central symmetry', description: 'Reflect through a center point' },
  { value: 'projection', label: 'Projection', description: 'Project orthogonally onto a line' },
  { value: 'rotation', label: 'Rotation (degrees)', description: 'Rotate around a center by an angle' },
  { value: 'rotation_in_rad', label: 'Rotation (radians)', description: 'Angle may be numeric or an expression such as pi/3' },
  { value: 'rotation_with_nodes', label: 'Rotation with nodes', description: 'Use two nodes to define the rotation angle' },
  { value: 'inversion', label: 'Positive inversion', description: 'Invert through a circle defined by center and point' },
  { value: 'inversion_negative', label: 'Negative inversion', description: 'Invert through the opposite ray of the circle' },
];

export function PointTransformationDialog({ open, pointNames, onCancel, onCreate }: PointTransformationDialogProps) {
  const [mode, setMode] = useState<PointTransformationMode>('translation');
  const [source, setSource] = useState('');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [third, setThird] = useState('');
  const [value, setValue] = useState('0.5');

  useEffect(() => {
    if (!open) return;
    setMode('translation');
    setSource(pointNames[0] ?? '');
    setFirst(pointNames[1] ?? pointNames[0] ?? '');
    setSecond(pointNames[2] ?? pointNames[0] ?? '');
    setThird(pointNames[3] ?? pointNames[0] ?? '');
    setValue('0.5');
  }, [open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  const requirements = useMemo(() => {
    if (mode === 'homothety' || mode === 'symmetry' || mode === 'rotation' || mode === 'rotation_in_rad') return { references: 1, labels: ['Center'] };
    if (mode === 'translation') return { references: 2, labels: ['Vector from', 'Vector to'] };
    if (mode === 'reflection') return { references: 2, labels: ['Line point 1', 'Line point 2'] };
    if (mode === 'projection') return { references: 2, labels: ['Line point 1', 'Line point 2'] };
    if (mode === 'rotation_with_nodes') return { references: 3, labels: ['Center', 'Angle from', 'Angle to'] };
    return { references: 2, labels: ['Circle center', 'Circle through'] };
  }, [mode]);

  const references = [first, second, third].slice(0, requirements.references);
  const needsValue = mode === 'homothety' || mode === 'rotation' || mode === 'rotation_in_rad';
  const numericValueInvalid = (mode === 'homothety' || mode === 'rotation') && !Number.isFinite(Number(value));
  const lineDegenerate = ['reflection', 'projection', 'translation', 'inversion', 'inversion_negative'].includes(mode) && first === second;
  const rotationDegenerate = mode === 'rotation_with_nodes' && (first === second || first === third);
  const validation = pointNames.length < 2
    ? 'Add at least two points before applying a transformation.'
    : !source || references.some(reference => !reference)
      ? 'Complete all point fields.'
      : numericValueInvalid || (mode === 'rotation_in_rad' && !value.trim())
        ? 'Enter a valid transformation value.'
        : lineDegenerate || rotationDegenerate
          ? 'The defining points must form a non-degenerate direction.'
          : null;

  const selectedMode = pointTransformationModes.find(item => item.value === mode)!;
  const pointSelect = (label: string, selected: string, setSelected: (value: string) => void) => (
    <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {label}
      <select value={selected} onChange={event => setSelected(event.target.value)} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100 outline-none focus:border-indigo-400">
        {pointNames.map(point => <option key={point} value={point}>{point}</option>)}
      </select>
    </label>
  );

  if (!open) return null;

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="point-transformation-title" className="theme-dialog w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><RefreshCw size={18} /></span>
            <div><h2 id="point-transformation-title" className="text-sm font-semibold">Transform point</h2><p className="mt-0.5 text-[11px] text-slate-500">Define an image with \tkzDefPointBy.</p></div>
          </div>
          <button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close transformation dialog"><X size={16} className="mx-auto" /></button>
        </header>

        <div className="space-y-4 p-5">
          <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Transformation<select value={mode} onChange={event => { const next = event.target.value as PointTransformationMode; setMode(next); setValue(next === 'rotation' ? '30' : next === 'rotation_in_rad' ? 'pi/3' : '0.5'); }} className="block h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs normal-case text-slate-100 outline-none focus:border-violet-400">{pointTransformationModes.map(item => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}</select></label>
          <div className={`grid gap-3 ${requirements.references >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {pointSelect('Point to transform', source, setSource)}
            {requirements.labels.map((label, index) => pointSelect(label, [first, second, third][index], [setFirst, setSecond, setThird][index]))}
          </div>
          {needsValue && <label className="property-field-label text-slate-400">{mode === 'homothety' ? 'Ratio' : mode === 'rotation' ? 'Angle (degrees)' : 'Angle (radians)'}<input value={value} onChange={event => setValue(event.target.value)} type={mode === 'rotation_in_rad' ? 'text' : 'number'} step="0.1" className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label>}
          <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-3 py-2.5"><span className="text-xs font-semibold text-violet-300">{selectedMode.label}</span><p className="mt-1 text-[11px] text-slate-500">{selectedMode.description}</p></div>
          {validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button><button type="button" disabled={Boolean(validation)} onClick={() => onCreate({ mode, source, references, value: needsValue ? value.trim() : undefined })} className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40">Create image</button></footer>
      </section>
    </div>,
    getScopedPortalTarget(),
  );
}
