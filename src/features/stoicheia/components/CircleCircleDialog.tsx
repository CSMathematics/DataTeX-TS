import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleDot, FlaskConical, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { CircleCircleIntersectionInput, CircleCircleMode } from '../store';

interface Props {
  open: boolean;
  kind: 'intersect' | 'test' | null;
  pointNames: string[];
  onCancel: () => void;
  onIntersect: (input: CircleCircleIntersectionInput) => void;
  onTest: (circles: [string[], string[]]) => void;
}

export function CircleCircleDialog({ open, kind, pointNames, onCancel, onIntersect, onTest }: Props) {
  const [mode, setMode] = useState<CircleCircleMode>('N');
  const [circles, setCircles] = useState<[string[], string[]]>([['', ''], ['', '']]);
  const [radii, setRadii] = useState<[string, string]>(['1', '1']);
  const [common, setCommon] = useState('');

  useEffect(() => {
    if (open) { setMode('N'); setCircles([['', ''], ['', '']]); setRadii(['1', '1']); setCommon(''); }
  }, [open, kind]);

  if (!open || !kind) return null;
  const activeMode: CircleCircleMode = kind === 'test' ? 'N' : mode;
  const count = activeMode === 'with_nodes' ? 3 : activeMode === 'N' ? 2 : 1;
  const labels = activeMode === 'with_nodes' ? ['Center', 'Radius node A', 'Radius node B'] : activeMode === 'N' ? ['Center', 'Point on circle'] : ['Center'];
  const values = circles.map(circle => circle.slice(0, count)) as [string[], string[]];
  const numericRadii = radii.map(Number) as [number, number];
  const validation = values.some(circle => circle.some(point => !point))
    ? 'Choose all required points.'
    : values[0][0] === values[1][0]
      ? 'The two circles need different centers.'
      : activeMode === 'R' && numericRadii.some(radius => !Number.isFinite(radius) || radius <= 0)
        ? 'Both radii must be positive.'
        : '';

  const setPoint = (circleIndex: number, pointIndex: number, value: string) => setCircles(current => {
    const next: [string[], string[]] = [[...current[0]], [...current[1]]];
    next[circleIndex][pointIndex] = value;
    return next;
  });

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="circle-circle-title" className="theme-dialog w-full max-w-3xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">{kind === 'test' ? <FlaskConical size={18} /> : <CircleDot size={18} />}</span><div><h2 id="circle-circle-title" className="text-sm font-semibold">{kind === 'test' ? 'Test circle–circle intersection' : 'Intersect two circles'}</h2><p className="mt-0.5 text-[11px] text-slate-500">{kind === 'test' ? '\\tkzTestInterCC sets \\iftkzFlagCC.' : '\\tkzInterCC creates up to two intersection points.'}</p></div></div>
          <button onClick={onCancel} aria-label="Close circle circle dialog" className="h-8 w-8 text-slate-500"><X size={16} className="mx-auto" /></button>
        </header>
        <div className="space-y-4 p-5">
          {kind === 'intersect' && <label className="property-field-label text-slate-400">Circle definitions<select aria-label="Circle-circle mode" value={mode} onChange={event => { const next = event.target.value as CircleCircleMode; setMode(next); setCircles(next === 'with_nodes' ? [['', '', ''], ['', '', '']] : next === 'N' ? [['', ''], ['', '']] : [[''], ['']]); }} className="property-input mt-1.5 bg-slate-950 text-slate-100"><option value="N">N — center and point</option><option value="R">R — centers and numeric radii</option><option value="with_nodes">with nodes — radii from two nodes</option></select></label>}
          <div className="grid gap-4 md:grid-cols-2">{([0, 1] as const).map(circleIndex => <fieldset key={circleIndex} className="rounded-xl border border-slate-700/50 p-3"><legend className="px-1 text-xs font-semibold text-slate-400">Circle {circleIndex + 1}</legend><div className="grid gap-3">{labels.map((label, pointIndex) => <label key={label} className="property-field-label text-slate-400">{label}<select aria-label={`Circle ${circleIndex + 1} ${label}`} value={values[circleIndex][pointIndex] ?? ''} onChange={event => setPoint(circleIndex, pointIndex, event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100"><option value="">Select point…</option>{pointNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>)}{activeMode === 'R' && <label className="property-field-label text-slate-400">Radius<input aria-label={`Circle ${circleIndex + 1} radius`} type="number" min="0.01" step="0.1" value={radii[circleIndex]} onChange={event => setRadii(current => circleIndex === 0 ? [event.target.value, current[1]] : [current[0], event.target.value])} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label>}</div></fieldset>)}</div>
          {kind === 'intersect' && <label className="property-field-label text-slate-400">Known common point (optional)<select aria-label="Circle-circle common point" value={common} onChange={event => setCommon(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100"><option value="">None</option>{pointNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>}
          {validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button onClick={onCancel} className="h-9 px-3 text-xs text-slate-400">Cancel</button><button disabled={Boolean(validation)} onClick={() => kind === 'test' ? onTest(values) : onIntersect({ mode, circles: values, radii: mode === 'R' ? numericRadii : undefined, common: common || undefined })} className="h-9 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white disabled:opacity-40">{kind === 'test' ? 'Insert test' : 'Create intersections'}</button></footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
