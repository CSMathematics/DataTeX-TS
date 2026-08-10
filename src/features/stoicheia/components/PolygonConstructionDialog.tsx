import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pentagon, RectangleHorizontal, Repeat2, Shapes, Sparkles, Square, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import { PolygonConstructionInput, PolygonConstructionMode } from '../store';

interface PolygonConstructionDialogProps {
  open: boolean;
  mode: PolygonConstructionMode | null;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (input: PolygonConstructionInput) => void;
}

const configurations = {
  permute: {
    title: 'Permute triangle', macro: 'tkzPermute', icon: Repeat2,
    description: 'Keep A and the angle at A, while exchanging the positions of B and C.',
    labels: ['Fixed vertex A', 'Vertex B', 'Vertex C'], action: 'Permute triangle',
  },
  square: {
    title: 'Define square', macro: 'tkzDefSquare', icon: Square,
    description: 'Use the ordered side AB to construct the other two vertices in the direct direction.',
    labels: ['First side point A', 'Second side point B'], action: 'Create square',
  },
  rectangle: {
    title: 'Define rectangle', macro: 'tkzDefRectangle', icon: RectangleHorizontal,
    description: 'Use two opposite corners of an axis-aligned rectangle.',
    labels: ['First diagonal point A', 'Opposite diagonal point C'], action: 'Create rectangle',
  },
  parallelogram: {
    title: 'Define parallelogram', macro: 'tkzDefParallelogram', icon: Shapes,
    description: 'Use three consecutive vertices A, B and C to construct the fourth vertex D.',
    labels: ['Vertex A', 'Vertex B', 'Vertex C'], action: 'Create parallelogram',
  },
  golden_rectangle: {
    title: 'Define golden rectangle', macro: 'tkzDefGoldenRectangle', icon: Sparkles,
    description: 'Construct a rectangle whose side ratio is the golden ratio φ.',
    labels: ['First side point A', 'Second side point B'], action: 'Create golden rectangle',
  },
  regular_polygon: {
    title: 'Define regular polygon', macro: 'tkzDefRegPolygon', icon: Pentagon,
    description: 'Construct a regular polygon from its center and a vertex, or from one side.',
    labels: ['Center O', 'First vertex A'], action: 'Create regular polygon',
  },
} as const;

export function PolygonConstructionDialog({ open, mode, pointNames, onCancel, onCreate }: PolygonConstructionDialogProps) {
  const [points, setPoints] = useState<string[]>([]);
  const [regularMode, setRegularMode] = useState<'center' | 'side'>('center');
  const [sides, setSides] = useState('5');
  const [namePrefix, setNamePrefix] = useState('P');

  useEffect(() => {
    if (!open || !mode) return;
    const count = configurations[mode].labels.length;
    setPoints(Array.from({ length: count }, (_, index) => pointNames[index] ?? pointNames[0] ?? ''));
    setRegularMode('center');
    setSides('5');
    setNamePrefix('P');
  }, [mode, open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  if (!open || !mode) return null;
  const configuration = configurations[mode];
  const Icon = configuration.icon;
  const labels = mode === 'regular_polygon' ? regularMode === 'center' ? ['Center O', 'First vertex A'] : ['Side vertex A', 'Side vertex B'] : configuration.labels;
  const required = labels.length;
  const sideCount = Number(sides);
  const cleanPrefix = namePrefix.trim();
  const validation = pointNames.length < required ? `Add at least ${required} points for this construction.`
    : points.length !== required || points.some(point => !point) || new Set(points).size !== required ? `Choose ${required} distinct points.`
      : mode === 'regular_polygon' && (!Number.isInteger(sideCount) || sideCount < 3 || sideCount > 100) ? 'The number of sides must be an integer from 3 to 100.'
        : mode === 'regular_polygon' && !/^[A-Za-z][A-Za-z0-9_]*$/.test(cleanPrefix) ? 'The name prefix must start with a Latin letter.' : null;
  const updatePoint = (index: number, value: string) => setPoints(current => current.map((point, pointIndex) => pointIndex === index ? value : point));

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="polygon-construction-title" className="theme-dialog w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"><Icon size={18} /></span><div><h2 id="polygon-construction-title" className="text-sm font-semibold">{configuration.title}</h2><p className="mt-0.5 text-[11px] text-slate-500">Insert <code>\{configuration.macro}</code>.</p></div></div>
          <button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close polygon construction dialog"><X size={16} className="mx-auto" /></button>
        </header>
        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5"><p className="text-xs text-slate-400">{configuration.description}</p></div>
          <div className={`grid ${required === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
            {labels.map((label, index) => <label key={label} className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}<select value={points[index] ?? ''} onChange={event => updatePoint(index, event.target.value)} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100 outline-none focus:border-emerald-400">{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>)}
          </div>
          {mode === 'rectangle' && <p className="text-[11px] text-slate-500">The sides follow the current coordinate axes, as defined by tkz-euclide.</p>}
          {mode === 'regular_polygon' && <div className="grid grid-cols-3 gap-3"><label className="property-field-label text-slate-400">Definition<select aria-label="Regular polygon definition" value={regularMode} onChange={event => setRegularMode(event.target.value as 'center' | 'side')} className="property-input mt-1.5 bg-slate-950 text-slate-100"><option value="center">Center + vertex</option><option value="side">One side</option></select></label><label className="property-field-label text-slate-400">Sides<input aria-label="Number of sides" type="number" min="3" max="100" step="1" value={sides} onChange={event => setSides(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label><label className="property-field-label text-slate-400">Name prefix<input aria-label="Vertex name prefix" value={namePrefix} onChange={event => setNamePrefix(event.target.value)} className="property-input mt-1.5 bg-slate-950 font-mono text-slate-100" /></label><p className="col-span-3 text-[11px] text-slate-500">Creates {cleanPrefix || 'P'}1 … {cleanPrefix || 'P'}{Number.isInteger(sideCount) && sideCount >= 3 ? sideCount : 'n'}.</p></div>}
          {validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button><button type="button" disabled={Boolean(validation)} onClick={() => onCreate({ mode, points, regularMode: mode === 'regular_polygon' ? regularMode : undefined, sides: mode === 'regular_polygon' ? sideCount : undefined, namePrefix: mode === 'regular_polygon' ? cleanPrefix : undefined })} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">{configuration.action}</button></footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
