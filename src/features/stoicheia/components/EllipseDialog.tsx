import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleDashed, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';

interface EllipseDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (center: string, xRadius: number, yRadius: number, angle: number) => void;
}

export function EllipseDialog({ open, pointNames, onCancel, onCreate }: EllipseDialogProps) {
  const [center, setCenter] = useState(pointNames[0] ?? '');
  const [xRadius, setXRadius] = useState('4');
  const [yRadius, setYRadius] = useState('2');
  const [angle, setAngle] = useState('0');
  useEffect(() => { if (open) setCenter(pointNames[0] ?? ''); }, [open]);
  if (!open) return null;
  const x = Number(xRadius);
  const y = Number(yRadius);
  const rotation = Number(angle);
  const valid = Boolean(center) && Number.isFinite(x) && x > 0 && Number.isFinite(y) && y > 0 && Number.isFinite(rotation);
  return createPortal(<div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}><section role="dialog" aria-modal="true" aria-labelledby="ellipse-title" className="theme-dialog w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}><header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><CircleDashed size={18} /></span><div><h2 id="ellipse-title" className="text-sm font-semibold">Draw ellipse</h2><p className="mt-0.5 text-[11px] text-slate-500">Center, two radii and main-axis angle.</p></div></div><button type="button" onClick={onCancel} aria-label="Close ellipse dialog" className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10"><X size={16} className="mx-auto" /></button></header><div className="space-y-3 p-5"><label className="property-field-label">Center<select aria-label="Ellipse center" className="property-input" value={center} onChange={event => setCenter(event.target.value)}>{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label><div className="grid grid-cols-3 gap-2"><label className="property-field-label">X radius<input aria-label="New ellipse x radius" type="number" min="0.01" step="0.1" className="property-input" value={xRadius} onChange={event => setXRadius(event.target.value)} /></label><label className="property-field-label">Y radius<input aria-label="New ellipse y radius" type="number" min="0.01" step="0.1" className="property-input" value={yRadius} onChange={event => setYRadius(event.target.value)} /></label><label className="property-field-label">Angle<input aria-label="New ellipse angle" type="number" step="1" className="property-input" value={angle} onChange={event => setAngle(event.target.value)} /></label></div><div className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-3 py-2 font-mono text-[11px] text-violet-300">\tkzDrawEllipse({center || 'C'},{xRadius},{yRadius},{angle})</div>{!pointNames.length && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Create a center point first.</div>}</div><footer className="flex justify-end gap-2 border-t border-white/10 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 px-3 text-xs font-semibold text-slate-400">Cancel</button><button type="button" disabled={!valid} onClick={() => onCreate(center, x, y, rotation)} className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-40">Draw ellipse</button></footer></section></div>, getScopedPortalTarget());
}
