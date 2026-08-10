import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gauge, RotateCcw, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';

export type AngleValueTool = 'angle' | 'slope' | 'get';

interface Props {
  tool: AngleValueTool | null;
  pointNames: string[];
  onCancel: () => void;
  onCalculate: (mode: 'angle' | 'slope', points: string[], macro?: string) => void;
  onGet: (macro: string) => void;
}

export function AngleValueDialog({ tool, pointNames, onCancel, onCalculate, onGet }: Props) {
  const [points, setPoints] = useState<string[]>([]);
  const [storeResult, setStoreResult] = useState(true);
  const [macro, setMacro] = useState('angle');

  useEffect(() => {
    if (!tool) return;
    const count = tool === 'angle' ? 3 : tool === 'slope' ? 2 : 0;
    setPoints(Array.from({ length: count }, (_, index) => pointNames[index] ?? ''));
    setStoreResult(true);
    setMacro(tool === 'slope' ? 'slopeAB' : tool === 'angle' ? 'angleABC' : 'angle');
  }, [tool, pointNames]);

  if (!tool) return null;
  const cleanMacro = macro.trim();
  const needed = tool === 'angle' ? 3 : tool === 'slope' ? 2 : 0;
  const validation = needed > 0 && pointNames.length < needed ? `Add at least ${needed} points.`
    : needed > 0 && (points.some(point => !point) || new Set(points).size !== needed) ? 'Choose distinct points.'
      : (tool === 'get' || storeResult) && !/^[A-Za-z]+$/.test(cleanMacro) ? 'The macro name must contain Latin letters only.' : '';
  const title = tool === 'angle' ? 'Find directed angle' : tool === 'slope' ? 'Find slope angle' : 'Retrieve angle result';
  const command = tool === 'angle' ? `\\tkzFindAngle(${points.join(',')})` : tool === 'slope' ? `\\tkzFindSlopeAngle(${points.join(',')})` : '\\tkzGetAngle';
  const labels = tool === 'angle' ? ['First ray point', 'Vertex', 'Second ray point'] : ['Line start', 'Line end'];

  const setPoint = (index: number, value: string) => setPoints(current => current.map((point, pointIndex) => pointIndex === index ? value : point));

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="angle-value-title" className="theme-dialog w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">{tool === 'slope' ? <Gauge size={18} /> : <RotateCcw size={18} />}</span><div><h2 id="angle-value-title" className="text-sm font-semibold">{title}</h2><p className="mt-0.5 font-mono text-[11px] text-slate-500">{command}</p></div></div><button onClick={onCancel} aria-label="Close angle value dialog" className="h-8 w-8 text-slate-500"><X size={16} className="mx-auto" /></button></header>
        <div className="space-y-4 p-5">
          {tool !== 'get' && <div className={`grid gap-3 ${tool === 'angle' ? 'grid-cols-3' : 'grid-cols-2'}`}>{labels.map((label, index) => <label key={label} className="property-field-label text-slate-400">{label}<select aria-label={label} value={points[index] ?? ''} onChange={event => setPoint(index, event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100">{pointNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>)}</div>}
          {tool !== 'get' && <label className="flex items-center gap-2 text-xs text-slate-400"><input aria-label="Store angle in macro" type="checkbox" checked={storeResult} onChange={event => setStoreResult(event.target.checked)} className="accent-amber-500" />Store the result immediately with <code>\tkzGetAngle</code></label>}
          {(tool === 'get' || storeResult) && <label className="property-field-label text-slate-400">Macro name<input aria-label="Angle macro name" value={macro} onChange={event => setMacro(event.target.value)} className="property-input mt-1.5 bg-slate-950 font-mono text-slate-100" /></label>}
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 text-xs text-slate-400">{tool === 'angle' ? 'Counterclockwise directed angle from the first ray to the second, in [0°, 360°).' : tool === 'slope' ? 'Counterclockwise line direction from the positive horizontal axis, normalized to [0°, 360°).' : 'Stores the current \tkzAngleResult in the selected macro.'}</div>
          {validation && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{validation}</div>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button onClick={onCancel} className="h-9 px-3 text-xs text-slate-400">Cancel</button><button disabled={Boolean(validation)} onClick={() => tool === 'get' ? onGet(cleanMacro) : onCalculate(tool, points, storeResult ? cleanMacro : undefined)} className="h-9 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white disabled:opacity-40">Insert command</button></footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
