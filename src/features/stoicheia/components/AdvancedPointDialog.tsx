import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Atom, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';

export type AdvancedPointTool = 'similitude' | 'harmonic' | 'equi' | 'midarc' | 'on-line' | 'on-circle';

export interface CircleChoice {
  center: string;
  radiusPoint: string;
}

export type AdvancedPointRequest =
  | { tool: 'similitude'; kind: 'ext' | 'int'; circle1: CircleChoice; circle2: CircleChoice }
  | { tool: 'harmonic'; mode: 'ext' | 'int'; p1: string; p2: string; known: string }
  | { tool: 'harmonic-pair'; p1: string; p2: string; ratio: number }
  | { tool: 'equi'; p1: string; p2: string; from: string; distance: number; show: boolean }
  | { tool: 'midarc'; center: string; start: string; end: string }
  | { tool: 'on-line'; p1: string; p2: string; position: number }
  | { tool: 'on-circle'; mode: 'through' | 'R'; center: string; angle: number; value: string | number };

interface AdvancedPointDialogProps {
  tool: AdvancedPointTool | null;
  pointNames: string[];
  circles: CircleChoice[];
  onCancel: () => void;
  onCreate: (request: AdvancedPointRequest) => void;
}

const titles: Record<AdvancedPointTool, string> = {
  similitude: 'Similitude center',
  harmonic: 'Harmonic division',
  equi: 'Equidistant points',
  midarc: 'Middle of an arc',
  'on-line': 'Point on a line',
  'on-circle': 'Point on a circle',
};

export function AdvancedPointDialog({ tool, pointNames, circles, onCancel, onCreate }: AdvancedPointDialogProps) {
  const [kind, setKind] = useState<'ext' | 'int'>('ext');
  const [harmonicMode, setHarmonicMode] = useState<'ext' | 'int' | 'both'>('ext');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');
  const [circle1, setCircle1] = useState(0);
  const [circle2, setCircle2] = useState(1);
  const [ratio, setRatio] = useState('0.5');
  const [distance, setDistance] = useState('2');
  const [showCompass, setShowCompass] = useState(false);
  const [position, setPosition] = useState('0.5');
  const [angle, setAngle] = useState('30');
  const [circleMode, setCircleMode] = useState<'through' | 'R'>('through');
  const [radius, setRadius] = useState('1');

  useEffect(() => {
    if (!tool) return;
    setKind('ext');
    setHarmonicMode('ext');
    setP1(pointNames[0] ?? '');
    setP2(pointNames[1] ?? pointNames[0] ?? '');
    setP3(pointNames[2] ?? pointNames[0] ?? '');
    setCircle1(0);
    setCircle2(Math.min(1, Math.max(circles.length - 1, 0)));
    setRatio('0.5');
    setDistance('2');
    setShowCompass(false);
    setPosition('0.5');
    setAngle('30');
    setCircleMode('through');
    setRadius('1');
  }, [circles.length, pointNames, tool]);

  useEffect(() => {
    if (!tool) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, tool]);

  const numericRatio = Number(ratio);
  const numericDistance = Number(distance);
  const numericPosition = Number(position);
  const numericAngle = Number(angle);
  const numericRadius = Number(radius);
  const validation = useMemo(() => {
    if (tool === 'similitude') {
      if (circles.length < 2) return 'Create at least two circles first';
      if (circle1 === circle2) return 'Choose two different circles';
      return null;
    }
    if (tool === 'harmonic') {
      if (pointNames.length < (harmonicMode === 'both' ? 2 : 3)) return `Create at least ${harmonicMode === 'both' ? 2 : 3} points first`;
      if (!p1 || !p2 || p1 === p2) return 'Choose two different base points';
      if (harmonicMode !== 'both' && (!p3 || p3 === p1 || p3 === p2)) return 'Choose a distinct known point';
      if (harmonicMode === 'both' && (!Number.isFinite(numericRatio) || Math.abs(Math.abs(numericRatio) - 1) < 1e-12)) return 'Ratio must be numeric and different from ±1';
      return null;
    }
    if (tool === 'equi') {
      if (pointNames.length < 3) return 'Create at least three points first';
      if (!p1 || !p2 || p1 === p2) return 'Choose two different line points';
      if (!p3) return 'Choose a reference point';
      if (!Number.isFinite(numericDistance) || numericDistance <= 0) return 'Distance must be positive';
      return null;
    }
    if (tool === 'midarc') {
      if (pointNames.length < 3) return 'Create at least three points first';
      if (!p1 || !p2 || !p3 || p1 === p2 || p1 === p3 || p2 === p3) return 'Choose distinct center, start and end points';
      return null;
    }
    if (tool === 'on-line') {
      if (pointNames.length < 2) return 'Create at least two points first';
      if (!p1 || !p2 || p1 === p2) return 'Choose two different line points';
      if (!Number.isFinite(numericPosition)) return 'Position must be numeric';
      return null;
    }
    if (tool === 'on-circle') {
      if (!p1 || !Number.isFinite(numericAngle)) return 'Choose a center and a numeric angle';
      if (circleMode === 'through' && (!p2 || p1 === p2)) return 'Choose a different radius point';
      if (circleMode === 'R' && (!Number.isFinite(numericRadius) || numericRadius <= 0)) return 'Radius must be positive';
      return null;
    }
    return 'No tool selected';
  }, [circle1, circle2, circleMode, circles.length, harmonicMode, numericAngle, numericDistance, numericPosition, numericRadius, numericRatio, p1, p2, p3, pointNames.length, tool]);

  if (!tool) return null;

  const pointSelect = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {label}
      <select value={value} onChange={event => onChange(event.target.value)} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100 outline-none focus:border-indigo-400">
        {pointNames.map(point => <option key={point} value={point}>{point}</option>)}
      </select>
    </label>
  );

  const submit = () => {
    if (validation) return;
    if (tool === 'similitude') onCreate({ tool, kind, circle1: circles[circle1], circle2: circles[circle2] });
    else if (tool === 'harmonic' && harmonicMode === 'both') onCreate({ tool: 'harmonic-pair', p1, p2, ratio: numericRatio });
    else if (tool === 'harmonic' && harmonicMode !== 'both') onCreate({ tool, mode: harmonicMode, p1, p2, known: p3 });
    else if (tool === 'equi') onCreate({ tool, p1, p2, from: p3, distance: numericDistance, show: showCompass });
    else if (tool === 'midarc') onCreate({ tool, center: p1, start: p2, end: p3 });
    else if (tool === 'on-line') onCreate({ tool, p1, p2, position: numericPosition });
    else if (tool === 'on-circle') onCreate({ tool, mode: circleMode, center: p1, angle: numericAngle, value: circleMode === 'through' ? p2 : numericRadius });
  };

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="advanced-point-title" className="theme-dialog w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300"><Atom size={18} /></span><div><h2 id="advanced-point-title" className="text-sm font-semibold">{titles[tool]}</h2><p className="mt-0.5 text-[11px] text-slate-500">Advanced tkz-euclide construction</p></div></div>
          <button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close advanced point dialog"><X size={16} className="mx-auto" /></button>
        </header>

        <div className="space-y-4 p-5">
          {tool === 'similitude' && (
            <>
              <label className="property-field-label text-slate-400">Center type<select value={kind} onChange={event => setKind(event.target.value as 'ext' | 'int')} className="property-input mt-1.5 bg-slate-950 text-slate-100"><option value="ext">External</option><option value="int">Internal</option></select></label>
              <div className="grid grid-cols-2 gap-3">
                {[circle1, circle2].map((value, index) => <label key={index} className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Circle {index + 1}<select value={value} onChange={event => (index === 0 ? setCircle1 : setCircle2)(Number(event.target.value))} className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs normal-case text-slate-100">{circles.map((circle, circleIndex) => <option key={`${circle.center}-${circle.radiusPoint}-${circleIndex}`} value={circleIndex}>{circle.center}, {circle.radiusPoint}</option>)}</select></label>)}
              </div>
            </>
          )}

          {tool === 'harmonic' && (
            <>
              <label className="property-field-label text-slate-400">Mode<select value={harmonicMode} onChange={event => setHarmonicMode(event.target.value as 'ext' | 'int' | 'both')} className="property-input mt-1.5 bg-slate-950 text-slate-100"><option value="ext">External conjugate</option><option value="int">Internal conjugate</option><option value="both">Both from ratio</option></select></label>
              <div className="grid grid-cols-2 gap-3">{pointSelect('First base point', p1, setP1)}{pointSelect('Second base point', p2, setP2)}</div>
              {harmonicMode === 'both' ? <label className="property-field-label text-slate-400">Ratio k<input type="number" step="0.1" value={ratio} onChange={event => setRatio(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label> : pointSelect(harmonicMode === 'ext' ? 'Known internal point' : 'Known external point', p3, setP3)}
            </>
          )}

          {tool === 'equi' && (
            <>
              <div className="grid grid-cols-2 gap-3">{pointSelect('Line point 1', p1, setP1)}{pointSelect('Line point 2', p2, setP2)}</div>
              {pointSelect('Reference point', p3, setP3)}
              <div className="grid grid-cols-2 gap-3"><label className="property-field-label text-slate-400">Distance<input type="number" min="0.01" step="0.25" value={distance} onChange={event => setDistance(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label><label className="flex items-end gap-2 pb-2 text-xs text-slate-400"><input type="checkbox" checked={showCompass} onChange={event => setShowCompass(event.target.checked)} className="h-4 w-4 accent-indigo-500" /> Show compass traces</label></div>
            </>
          )}

          {tool === 'midarc' && (
            <><div className="grid grid-cols-3 gap-3">{pointSelect('Center', p1, setP1)}{pointSelect('Arc start', p2, setP2)}{pointSelect('Arc end', p3, setP3)}</div><p className="text-[11px] leading-relaxed text-slate-500">The result lies halfway along the directed arc from start to end.</p></>
          )}

          {tool === 'on-line' && (
            <><div className="grid grid-cols-2 gap-3">{pointSelect('Line point 1', p1, setP1)}{pointSelect('Line point 2', p2, setP2)}</div><label className="property-field-label text-slate-400">Position t<input type="number" step="0.1" value={position} onChange={event => setPosition(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label><p className="text-[11px] text-slate-500">0 is the first point, 1 the second; values outside this range extend the line.</p></>
          )}

          {tool === 'on-circle' && (
            <><label className="property-field-label text-slate-400">Radius definition<select value={circleMode} onChange={event => setCircleMode(event.target.value as 'through' | 'R')} className="property-input mt-1.5 bg-slate-950 text-slate-100"><option value="through">Through a point</option><option value="R">Numeric radius</option></select></label><div className="grid grid-cols-2 gap-3">{pointSelect('Center', p1, setP1)}{circleMode === 'through' ? pointSelect('Radius point', p2, setP2) : <label className="property-field-label text-slate-400">Radius<input type="number" min="0.01" step="0.25" value={radius} onChange={event => setRadius(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label>}</div><label className="property-field-label text-slate-400">Angle (degrees)<input type="number" step="5" value={angle} onChange={event => setAngle(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100" /></label></>
          )}

          {validation && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{validation}</div>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4"><button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button><button type="button" disabled={Boolean(validation)} onClick={submit} className="h-9 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40">Create</button></footer>
      </section>
    </div>,
    getScopedPortalTarget(),
  );
}
