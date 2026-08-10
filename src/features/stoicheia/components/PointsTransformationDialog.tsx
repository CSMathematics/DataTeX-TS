import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CopyPlus, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { PointsTransformationInput, PointTransformationMode } from '../store';
import { pointTransformationModes } from './PointTransformationDialog';

interface PointsTransformationDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: PointsTransformationInput) => void;
}

export function PointsTransformationDialog({ open, pointNames, onCancel, onCreate }: PointsTransformationDialogProps) {
  const [mode, setMode] = useState<PointTransformationMode>('translation');
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [third, setThird] = useState('');
  const [value, setValue] = useState('0.5');
  const [primeNames, setPrimeNames] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('translation');
    setSources(new Set(pointNames.slice(0, 2)));
    setFirst(pointNames[0] ?? '');
    setSecond(pointNames[1] ?? pointNames[0] ?? '');
    setThird(pointNames[2] ?? pointNames[0] ?? '');
    setValue('0.5');
    setPrimeNames(false);
  }, [open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  const requirements = useMemo(() => {
    if (mode === 'homothety' || mode === 'symmetry' || mode === 'rotation' || mode === 'rotation_in_rad') return { count: 1, labels: ['Center'] };
    if (mode === 'translation') return { count: 2, labels: ['Vector from', 'Vector to'] };
    if (mode === 'reflection' || mode === 'projection') return { count: 2, labels: ['Line point 1', 'Line point 2'] };
    if (mode === 'rotation_with_nodes') return { count: 3, labels: ['Center', 'Angle from', 'Angle to'] };
    return { count: 2, labels: ['Circle center', 'Circle through'] };
  }, [mode]);

  const references = [first, second, third].slice(0, requirements.count);
  const selectedSources = pointNames.filter(point => sources.has(point));
  const needsValue = mode === 'homothety' || mode === 'rotation' || mode === 'rotation_in_rad';
  const numericValueInvalid = (mode === 'homothety' || mode === 'rotation') && !Number.isFinite(Number(value));
  const twoPointDegenerate = ['translation', 'reflection', 'projection', 'inversion', 'inversion_negative'].includes(mode) && first === second;
  const rotationDegenerate = mode === 'rotation_with_nodes' && (first === second || first === third);
  const validation = selectedSources.length === 0
    ? 'Select at least one point to transform.'
    : references.some(reference => !reference)
      ? 'Complete all defining point fields.'
      : numericValueInvalid || (mode === 'rotation_in_rad' && !value.trim())
        ? 'Enter a valid transformation value.'
        : twoPointDegenerate || rotationDegenerate
          ? 'The defining points must form a non-degenerate direction.'
          : null;

  const pointSelect = (label: string, selected: string, setSelected: (point: string) => void) => (
    <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}<select value={selected} onChange={event => setSelected(event.target.value)} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100 outline-none focus:border-fuchsia-400">{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>
  );

  if (!open) return null;

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="points-transformation-title" className="theme-dialog w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300"><CopyPlus size={18} /></span><div><h2 id="points-transformation-title" className="text-sm font-semibold">Transform multiple points</h2><p className="mt-0.5 text-[11px] text-slate-500">Create several images with \tkzDefPointsBy.</p></div></div><button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close multiple transformation dialog"><X size={16} className="mx-auto" /></button></header>
        <div className="grid grid-cols-[1fr_1.15fr] gap-4 p-5">
          <div><div className="mb-2 flex items-center justify-between"><span className="property-field-label">Points to transform</span><span className="text-[10px] text-slate-500">{selectedSources.length} selected</span></div><div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-700/70 p-2 inspector-scroll">{pointNames.map(point => <label key={point} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors ${sources.has(point) ? 'border-fuchsia-500/30 bg-fuchsia-500/10' : 'border-transparent bg-slate-900/20'}`}><input type="checkbox" checked={sources.has(point)} onChange={() => setSources(current => { const next = new Set(current); if (next.has(point)) next.delete(point); else next.add(point); return next; })} className="h-4 w-4 accent-fuchsia-500" aria-label={`Transform point ${point}`} /><span className="font-mono font-semibold">{point}</span></label>)}</div><label className="mt-3 flex items-start gap-2 rounded-xl border border-slate-700/70 p-3 text-xs text-slate-400"><input type="checkbox" checked={primeNames} onChange={event => setPrimeNames(event.target.checked)} className="mt-0.5 h-4 w-4 accent-fuchsia-500" /><span><strong className="block text-slate-300">Use tkz prime names</strong><span className="text-[10px]">Emit an empty image list and create A′, B′…</span></span></label></div>
          <div className="space-y-3"><label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Transformation<select value={mode} onChange={event => { const next = event.target.value as PointTransformationMode; setMode(next); setValue(next === 'rotation' ? '30' : next === 'rotation_in_rad' ? 'pi/3' : '0.5'); }} className="block h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs normal-case text-slate-100 outline-none focus:border-fuchsia-400">{pointTransformationModes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="grid grid-cols-2 gap-3">{requirements.labels.map((label, index) => pointSelect(label, [first, second, third][index], [setFirst, setSecond, setThird][index]))}</div>{needsValue && <label className="property-field-label text-slate-400">{mode === 'homothety' ? 'Ratio' : mode === 'rotation' ? 'Angle (degrees)' : 'Angle (radians)'}<input value={value} onChange={event => setValue(event.target.value)} type={mode === 'rotation_in_rad' ? 'text' : 'number'} step="0.1" className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label>}{validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}</div>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-slate-950/30 px-5 py-4"><span className="text-[11px] text-slate-500">{primeNames ? 'The image list will be empty: {}.' : 'One unique image name will be generated per point.'}</span><div className="flex gap-2"><button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button><button type="button" disabled={Boolean(validation)} onClick={() => onCreate({ mode, sources: selectedSources, references, value: needsValue ? value.trim() : undefined, primeNames })} className="h-9 rounded-lg bg-fuchsia-600 px-4 text-xs font-semibold text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40">Create images</button></div></footer>
      </section>
    </div>,
    getScopedPortalTarget(),
  );
}
