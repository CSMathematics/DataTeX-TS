import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Scale, X } from 'lucide-react';
import { getScopedPortalTarget } from '../bridge/scopedPortal';

interface BarycentricTerm {
  point: string;
  weight: number;
}

interface BarycentricPointDialogProps {
  open: boolean;
  pointNames: string[];
  onCancel: () => void;
  onCreate: (terms: BarycentricTerm[]) => void;
}

export function BarycentricPointDialog({ open, pointNames, onCancel, onCreate }: BarycentricPointDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [weights, setWeights] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(pointNames.slice(0, 2)));
    setWeights(Object.fromEntries(pointNames.map(name => [name, '1'])));
  }, [open, pointNames]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  const terms = useMemo(() => pointNames
    .filter(point => selected.has(point))
    .map(point => ({ point, weight: Number(weights[point]) })), [pointNames, selected, weights]);
  const validTerms = terms.filter(term => Number.isFinite(term.weight));
  const totalWeight = validTerms.reduce((sum, term) => sum + term.weight, 0);
  const canCreate = validTerms.length >= 2 && validTerms.length === terms.length && Math.abs(totalWeight) > 1e-12;

  if (!open) return null;

  return createPortal(
    <div className="theme-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" role="presentation" onMouseDown={onCancel}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="barycentric-title"
        className="theme-dialog w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl shadow-black/30"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
              <Scale size={18} />
            </span>
            <div>
              <h2 id="barycentric-title" className="text-sm font-semibold">Barycentric point</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Choose at least two points and assign their weights.</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Close barycentric dialog">
            <X size={16} className="mx-auto" />
          </button>
        </header>

        <div className="max-h-80 space-y-2 overflow-y-auto p-4 inspector-scroll">
          {pointNames.length < 2 ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200">
              Add at least two points before creating a barycentric point.
            </div>
          ) : pointNames.map(point => {
            const isSelected = selected.has(point);
            return (
              <div key={point} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${isSelected ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-white/5 bg-slate-900/30'}`}>
                <input
                  type="checkbox"
                  aria-label={`Use point ${point}`}
                  checked={isSelected}
                  onChange={() => setSelected(current => {
                    const next = new Set(current);
                    if (next.has(point)) next.delete(point);
                    else next.add(point);
                    return next;
                  })}
                  className="h-4 w-4 accent-indigo-500"
                />
                <span className="flex-1 font-mono text-sm font-semibold text-slate-200">{point}</span>
                <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                  Weight
                  <input
                    type="number"
                    step="0.25"
                    value={weights[point] ?? '1'}
                    disabled={!isSelected}
                    onChange={event => setWeights(current => ({ ...current, [point]: event.target.value }))}
                    className="h-8 w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 font-mono text-xs text-slate-100 outline-none focus:border-indigo-400 disabled:opacity-40"
                    aria-label={`Weight for ${point}`}
                  />
                </label>
              </div>
            );
          })}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-slate-950/30 px-5 py-4">
          <span className={`text-[11px] ${canCreate ? 'text-slate-500' : 'text-amber-400'}`}>
            {validTerms.length < 2 ? 'Select at least two points' : Math.abs(totalWeight) < 1e-12 ? 'Weights must not sum to zero' : `${validTerms.length} points · total weight ${totalWeight}`}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">Cancel</button>
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => onCreate(validTerms)}
              className="h-9 rounded-lg bg-indigo-500 px-4 text-xs font-semibold text-white shadow-lg shadow-indigo-950/30 hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create point
            </button>
          </div>
        </footer>
      </section>
    </div>,
    getScopedPortalTarget(),
  );
}
