import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ruler, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { DefinedLineInput, LineDefinitionMode } from '../store';

interface DefinedLineDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: DefinedLineInput) => void;
}

const modes: { value: LineDefinitionMode; label: string; description: string }[] = [
  { value: 'mediator', label: 'Perpendicular bisector', description: 'Mediator of a segment' },
  { value: 'perpendicular', label: 'Perpendicular through point', description: 'Perpendicular to a line through another point' },
  { value: 'orthogonal', label: 'Orthogonal through point', description: 'Alias of perpendicular=through' },
  { value: 'parallel', label: 'Parallel through point', description: 'Parallel to a line through another point' },
  { value: 'bisector', label: 'Angle bisector', description: 'Internal bisector of an angle' },
  { value: 'bisector_out', label: 'Exterior angle bisector', description: 'Bisector of the exterior angle' },
  { value: 'symmedian', label: 'Symmedian', description: 'Symmedian from the selected vertex' },
  { value: 'altitude', label: 'Triangle altitude', description: 'Altitude from the selected vertex' },
  { value: 'euler', label: 'Euler line', description: 'Line through triangle centers' },
  { value: 'tangent_at', label: 'Tangent at point', description: 'Tangent at a point on a circle' },
  { value: 'tangent_from', label: 'Tangents from point', description: 'Two tangents from an exterior point' },
];

export function DefinedLineDialog({ open, pointNames, onCancel, onCreate }: DefinedLineDialogProps) {
  const [mode, setMode] = useState<LineDefinitionMode>('mediator');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');
  const [through, setThrough] = useState('');
  const [factor, setFactor] = useState('1');
  const [normed, setNormed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('mediator');
    setP1(pointNames[0] ?? '');
    setP2(pointNames[1] ?? pointNames[0] ?? '');
    setP3(pointNames[2] ?? pointNames[0] ?? '');
    setThrough(pointNames[2] ?? pointNames[0] ?? '');
    setFactor('1');
    setNormed(false);
  }, [open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  const config = useMemo(() => {
    if (mode === 'tangent_at') return { points: 1, labels: ['Circle center'], through: 'Point on circle' };
    if (mode === 'tangent_from') return { points: 2, labels: ['Circle center', 'Radius point'], through: 'Exterior point' };
    if (mode === 'mediator') return { points: 2, labels: ['Segment point 1', 'Segment point 2'], through: null };
    if (mode === 'perpendicular' || mode === 'orthogonal' || mode === 'parallel') return { points: 2, labels: ['Base line point 1', 'Base line point 2'], through: 'Pass through' };
    return { points: 3, labels: mode === 'euler' ? ['Triangle A', 'Triangle B', 'Triangle C'] : ['First side point', 'Vertex', 'Second side point'], through: null };
  }, [mode]);
  const selectedMode = modes.find(item => item.value === mode)!;
  const points = [p1, p2, p3].slice(0, config.points);
  const numericFactor = Number(factor);
  const showModifiers = ['mediator', 'perpendicular', 'orthogonal', 'parallel', 'bisector', 'bisector_out'].includes(mode);
  const validation = pointNames.length < config.points ? `Add at least ${config.points} points for this construction.`
    : points.some(point => !point) || new Set(points).size !== points.length ? 'Choose distinct defining points.'
      : config.through && (!through || (mode !== 'parallel' && points.includes(through))) ? 'Choose a valid additional point.'
        : !Number.isFinite(numericFactor) ? 'K must be a valid number.' : null;
  const pointSelect = (label: string, value: string, setValue: (value: string) => void) => <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}<select value={value} onChange={event => setValue(event.target.value)} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100 outline-none focus:border-blue-400">{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>;

  if (!open) return null;
  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="defined-line-title" className="theme-dialog w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><Ruler size={18} /></span><div><h2 id="defined-line-title" className="text-sm font-semibold">Define straight line</h2><p className="mt-0.5 text-[11px] text-slate-500">Construct a particular line with \tkzDefLine.</p></div></div><button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close defined line dialog"><X size={16} className="mx-auto" /></button></header>
        <div className="space-y-4 p-5"><label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Line type<select value={mode} onChange={event => { setMode(event.target.value as LineDefinitionMode); setFactor('1'); setNormed(false); }} className="block h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs normal-case text-slate-100 outline-none focus:border-blue-400">{modes.map(item => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}</select></label><div className="grid grid-cols-2 gap-3">{config.labels.map((label, index) => pointSelect(label, [p1, p2, p3][index], [setP1, setP2, setP3][index]))}{config.through && pointSelect(config.through, through, setThrough)}</div>{showModifiers && <div className="grid grid-cols-2 gap-3"><label className="property-field-label text-slate-400">Coefficient K<input type="number" step="0.1" value={factor} onChange={event => setFactor(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label><label className="flex items-end gap-2 pb-2 text-xs text-slate-400"><input type="checkbox" checked={normed} onChange={event => setNormed(event.target.checked)} className="h-4 w-4 accent-blue-500" /> Normalize created segment</label></div>}<div className="rounded-xl border border-blue-500/15 bg-blue-500/5 px-3 py-2.5"><span className="text-xs font-semibold text-blue-300">{selectedMode.label}</span><p className="mt-1 text-[11px] text-slate-500">{selectedMode.description}</p></div>{validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}</div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button><button type="button" disabled={Boolean(validation)} onClick={() => onCreate({ mode, points, through: config.through ? through : undefined, factor: showModifiers ? numericFactor : 1, normed: showModifiers && normed })} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">Create line</button></footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
