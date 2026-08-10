import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Braces, Ruler, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';
import type { UnitConversionMode } from '../store';

export type MeasurementTool = 'length' | 'pt_to_cm' | 'cm_to_pt' | 'point_coordinates' | 'swap_points' | 'dot_product' | 'power_circle' | 'is_linear' | 'is_ortho';

interface MeasurementDialogProps {
  tool: MeasurementTool | null;
  pointNames: string[];
  onCancel: () => void;
  onLength: (p1: string, p2: string, macro: string, options?: string) => void;
  onConvert: (mode: UnitConversionMode, value: string, macro: string) => void;
  onPointCoordinates: (point: string, macro: string) => void;
  onSwapPoints: (p1: string, p2: string) => void;
  onDotProduct: (p1: string, p2: string, p3: string, macro: string) => void;
  onPowerCircle: (point: string, center: string, radiusPoint: string, macro: string) => void;
  onLinearityTest: (points: [string, string, string]) => void;
  onOrthogonalityTest: (points: [string, string, string]) => void;
}

export function MeasurementDialog({ tool, pointNames, onCancel, onLength, onConvert, onPointCoordinates, onSwapPoints, onDotProduct, onPowerCircle, onLinearityTest, onOrthogonalityTest }: MeasurementDialogProps) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');
  const [macro, setMacro] = useState('lengthAB');
  const [options, setOptions] = useState('');
  const [value, setValue] = useState('10');

  useEffect(() => {
    if (!tool) return;
    setP1(pointNames[0] ?? '');
    setP2(pointNames[1] ?? pointNames[0] ?? '');
    setP3(pointNames[2] ?? pointNames[1] ?? pointNames[0] ?? '');
    setOptions('');
    setValue(tool === 'pt_to_cm' ? '28.45274' : '1');
    setMacro(tool === 'length' ? 'lengthAB'
      : tool === 'pt_to_cm' ? 'lengthCm'
        : tool === 'cm_to_pt' ? 'lengthPt'
          : tool === 'point_coordinates' ? 'coordA'
            : tool === 'dot_product' ? 'dotABC'
              : tool === 'power_circle' ? 'powerA' : '');
  }, [tool, pointNames]);

  const cleanMacro = macro.trim();
  const cleanValue = value.trim();
  const validation = useMemo(() => {
    if (tool === 'length') {
      if (pointNames.length < 2) return 'Add at least two points.';
      if (!p1 || !p2 || p1 === p2) return 'Choose two distinct points.';
    } else if (tool === 'point_coordinates') {
      if (!p1) return 'Choose a point.';
    } else if (tool === 'swap_points') {
      if (pointNames.length < 2) return 'Add at least two points.';
      if (!p1 || !p2 || p1 === p2) return 'Choose two distinct points.';
    } else if (tool === 'dot_product') {
      if (pointNames.length < 2) return 'Add enough points.';
      if (!p1 || !p2 || !p3 || p1 === p2 || p1 === p3) return 'Choose a base point and nonzero vectors.';
    } else if (tool === 'power_circle') {
      if (pointNames.length < 2) return 'Add enough points.';
      if (!p1 || !p2 || !p3 || p2 === p3) return 'Choose a point and a valid circle.';
    } else if (tool === 'is_linear') {
      if (pointNames.length < 3) return 'Add at least three points.';
      if (!p1 || !p2 || !p3 || new Set([p1, p2, p3]).size !== 3) return 'Choose three distinct points.';
    } else if (tool === 'is_ortho') {
      if (pointNames.length < 2) return 'Add enough points.';
      if (!p1 || !p2 || !p3 || p1 === p2 || p1 === p3) return 'Choose a vertex and two nonzero directions.';
    } else if (!cleanValue) return 'Enter a numeric value or macro.';
    if (tool !== 'swap_points' && tool !== 'is_linear' && tool !== 'is_ortho' && !/^[A-Za-z]+$/.test(cleanMacro)) return 'The macro name must contain Latin letters only.';
    return '';
  }, [cleanMacro, cleanValue, p1, p2, p3, pointNames.length, tool]);

  if (!tool) return null;

  const title = tool === 'length' ? 'Calculate length'
    : tool === 'pt_to_cm' ? 'Convert pt to cm'
      : tool === 'cm_to_pt' ? 'Convert cm to pt'
        : tool === 'point_coordinates' ? 'Get point coordinates'
          : tool === 'swap_points' ? 'Swap points'
            : tool === 'dot_product' ? 'Dot product'
              : tool === 'power_circle' ? 'Power of point'
                : tool === 'is_linear' ? 'Test linearity' : 'Test orthogonality';
  const command = tool === 'length' ? `\\tkzCalcLength(${p1},${p2})`
    : tool === 'pt_to_cm' ? '\\tkzpttocm'
      : tool === 'cm_to_pt' ? '\\tkzcmtopt'
        : tool === 'point_coordinates' ? '\\tkzGetPointCoord'
          : tool === 'swap_points' ? '\\tkzSwapPoints'
            : tool === 'dot_product' ? '\\tkzDotProduct'
              : tool === 'power_circle' ? '\\tkzPowerCircle'
                : tool === 'is_linear' ? '\\tkzIsLinear' : '\\tkzIsOrtho';
  const submit = () => {
    if (tool === 'length') onLength(p1, p2, cleanMacro, options);
    else if (tool === 'pt_to_cm' || tool === 'cm_to_pt') onConvert(tool, cleanValue, cleanMacro);
    else if (tool === 'point_coordinates') onPointCoordinates(p1, cleanMacro);
    else if (tool === 'swap_points') onSwapPoints(p1, p2);
    else if (tool === 'dot_product') onDotProduct(p1, p2, p3, cleanMacro);
    else if (tool === 'power_circle') onPowerCircle(p1, p2, p3, cleanMacro);
    else if (tool === 'is_linear') onLinearityTest([p1, p2, p3]);
    else onOrthogonalityTest([p1, p2, p3]);
  };

  const selectPoint = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="property-field-label text-slate-400">
      {label}
      <select aria-label={label} value={value} onChange={event => onChange(event.target.value)} className="property-input mt-1.5 bg-slate-950 text-slate-100">
        {pointNames.map(point => <option key={point} value={point}>{point}</option>)}
      </select>
    </label>
  );

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="measurement-title" className="theme-dialog w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl shadow-black/30" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">{tool === 'length' ? <Ruler size={18} /> : <Braces size={18} />}</span>
            <div>
              <h2 id="measurement-title" className="text-sm font-semibold">{title}</h2>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">{command}</p>
            </div>
          </div>
          <button onClick={onCancel} aria-label="Close measurement dialog" className="h-8 w-8 text-slate-500"><X size={16} className="mx-auto" /></button>
        </header>
        <div className="space-y-4 p-5">
          {tool === 'length' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {selectPoint('Length first point', p1, setP1)}
                {selectPoint('Length second point', p2, setP2)}
              </div>
              <label className="property-field-label text-slate-400">Options<input aria-label="Length options" value={options} onChange={event => setOptions(event.target.value)} className="property-input mt-1.5 bg-slate-950 font-mono text-slate-100" placeholder="optional" /></label>
            </>
          ) : tool === 'point_coordinates' ? (
            selectPoint('Coordinate point', p1, setP1)
          ) : tool === 'swap_points' ? (
            <div className="grid grid-cols-2 gap-3">
              {selectPoint('Swap first point', p1, setP1)}
              {selectPoint('Swap second point', p2, setP2)}
            </div>
          ) : tool === 'dot_product' ? (
            <div className="grid grid-cols-3 gap-3">
              {selectPoint('Dot base point', p1, setP1)}
              {selectPoint('Dot second point', p2, setP2)}
              {selectPoint('Dot third point', p3, setP3)}
            </div>
          ) : tool === 'power_circle' ? (
            <div className="grid grid-cols-3 gap-3">
              {selectPoint('Power point', p1, setP1)}
              {selectPoint('Power circle center', p2, setP2)}
              {selectPoint('Power radius point', p3, setP3)}
            </div>
          ) : tool === 'is_linear' ? (
            <div className="grid grid-cols-3 gap-3">
              {selectPoint('Linear first point', p1, setP1)}
              {selectPoint('Linear second point', p2, setP2)}
              {selectPoint('Linear third point', p3, setP3)}
            </div>
          ) : tool === 'is_ortho' ? (
            <div className="grid grid-cols-3 gap-3">
              {selectPoint('Ortho vertex', p1, setP1)}
              {selectPoint('Ortho first direction', p2, setP2)}
              {selectPoint('Ortho second direction', p3, setP3)}
            </div>
          ) : (
            <label className="property-field-label text-slate-400">Value<input aria-label="Conversion value" value={value} onChange={event => setValue(event.target.value)} className="property-input mt-1.5 bg-slate-950 font-mono text-slate-100" /></label>
          )}
          {tool !== 'swap_points' && tool !== 'is_linear' && tool !== 'is_ortho' && <label className="property-field-label text-slate-400">Macro name<input aria-label="Measurement macro name" value={macro} onChange={event => setMacro(event.target.value)} className="property-input mt-1.5 bg-slate-950 font-mono text-slate-100" /></label>}
          {validation && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{validation}</div>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/30 px-5 py-4">
          <button onClick={onCancel} className="h-9 px-3 text-xs text-slate-400">Cancel</button>
          <button disabled={Boolean(validation)} onClick={submit} className="h-9 rounded-lg bg-teal-600 px-4 text-xs font-semibold text-white disabled:opacity-40">Insert command</button>
        </footer>
      </section>
    </div>, getScopedPortalTarget(),
  );
}
