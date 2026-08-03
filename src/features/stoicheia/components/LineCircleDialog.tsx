import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crosshair, FlaskConical, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { LineCircleIntersectionInput, LineCircleMode } from '../store';

interface Props {
  open: boolean;
  kind: 'intersect' | 'test' | null;
  pointNames: string[];
  onCancel: () => void;
  onIntersect: (input: LineCircleIntersectionInput) => void;
  onTest: (line: string[], circle: string[]) => void;
}

export function LineCircleDialog({ open, kind, pointNames, onCancel, onIntersect, onTest }: Props) {
  const [mode, setMode] = useState<LineCircleMode>('N');
  const [line, setLine] = useState<string[]>([]);
  const [circle, setCircle] = useState<string[]>([]);
  const [radius, setRadius] = useState('2');
  const [ordering, setOrdering] = useState<'default' | 'near' | 'common'>('default');
  const [common, setCommon] = useState('');
  const circleCount = kind === 'test' || mode === 'N' ? 2 : mode === 'with_nodes' ? 3 : 1;
  const resetCircle = (nextMode: LineCircleMode, nextKind = kind) => {
    const count = nextKind === 'test' || nextMode === 'N' ? 2 : nextMode === 'with_nodes' ? 3 : 1;
    setCircle(Array.from({ length: count }, (_, index) => pointNames[index + 2] ?? pointNames[index] ?? ''));
  };
  useEffect(() => { if (open) { setMode('N'); setLine([pointNames[0] ?? '', pointNames[1] ?? '']); resetCircle('N', kind); setRadius('2'); setOrdering('default'); setCommon(pointNames[0] ?? ''); } }, [open, kind, pointNames]);
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onCancel, open]);
  if (!open || !kind) return null;
  const required = 2 + circleCount;
  const numericRadius = Number(radius);
  const circleDegenerate = (kind === 'test' || mode === 'N') ? circle[0] === circle[1] : mode === 'with_nodes' ? circle[1] === circle[2] : false;
  const validation = pointNames.length < required ? 'Add more points for this construction.' : new Set(line).size !== 2 ? 'Choose two distinct points for the line.' : circle.some(point => !point) || circleDegenerate ? 'Complete a non-degenerate circle definition.' : mode === 'R' && (!Number.isFinite(numericRadius) || numericRadius <= 0) ? 'Radius must be positive.' : ordering === 'common' && !common ? 'Choose the known common point.' : null;
  const select = (label: string, values: string[], setter: (values: string[]) => void, index: number) => <label key={label} className="property-field-label text-slate-400">{label}<select value={values[index] ?? ''} onChange={event => setter(values.map((point, i) => i === index ? event.target.value : point))} className="property-input mt-1.5 bg-slate-950 font-mono text-slate-100">{pointNames.map(point => <option key={point}>{point}</option>)}</select></label>;
  const labels = kind === 'test' || mode === 'N' ? ['Circle center O', 'Point on circle C'] : mode === 'R' ? ['Circle center O'] : ['Circle center O', 'Radius node C', 'Radius node D'];
  const Icon = kind === 'test' ? FlaskConical : Crosshair;
  return createPortal(<div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}><section role="dialog" aria-modal="true" aria-labelledby="line-circle-title" className="theme-dialog w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}><header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><Icon size={18} /></span><div><h2 id="line-circle-title" className="text-sm font-semibold">{kind === 'test' ? 'Test line–circle intersection' : 'Intersect line and circle'}</h2><p className="mt-0.5 text-[11px] text-slate-500">{kind === 'test' ? '\tkzTestInterLC sets \iftkzFlagLC.' : '\tkzInterLC creates up to two intersection points.'}</p></div></div><button onClick={onCancel} aria-label="Close line circle dialog" className="h-8 w-8 text-slate-500"><X size={16} className="mx-auto" /></button></header><div className="space-y-4 p-5">{kind === 'intersect' && <label className="property-field-label text-slate-400">Circle definition<select aria-label="Line-circle mode" value={mode} onChange={event => { const next = event.target.value as LineCircleMode; setMode(next); resetCircle(next); }} className="property-input mt-1.5 bg-slate-950 text-slate-100"><option value="N">N — center and point</option><option value="R">R — center and numeric radius</option><option value="with_nodes">with nodes — radius from two nodes</option></select></label>}<div className="grid grid-cols-3 gap-3">{select('Line point A', line, setLine, 0)}{select('Line point B', line, setLine, 1)}{labels.map((label, index) => select(label, circle, setCircle, index))}</div>{kind === 'intersect' && mode === 'R' && <label className="property-field-label text-slate-400">Radius<input aria-label="Intersection circle radius" type="number" min="0.01" step="0.1" value={radius} onChange={event => setRadius(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label>}{kind === 'intersect' && <div className="grid grid-cols-3 gap-3"><label className="property-field-label text-slate-400">Result ordering<select aria-label="Intersection ordering" value={ordering} onChange={event => setOrdering(event.target.value as typeof ordering)} className="property-input mt-1.5 bg-slate-950 text-slate-100"><option value="default">Default</option><option value="near">Near line point A</option><option value="common">Known common point</option></select></label>{ordering === 'common' && select('Common point', [common], values => setCommon(values[0]), 0)}</div>}{validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}</div><footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button onClick={onCancel} className="h-9 px-3 text-xs text-slate-400">Cancel</button><button disabled={Boolean(validation)} onClick={() => kind === 'test' ? onTest(line, circle) : onIntersect({ mode, line, circle, radius: mode === 'R' ? numericRadius : undefined, near: ordering === 'near', common: ordering === 'common' ? common : undefined })} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white disabled:opacity-40">{kind === 'test' ? 'Insert test' : 'Create intersections'}</button></footer></section></div>, getScopedPortalTarget());
}
