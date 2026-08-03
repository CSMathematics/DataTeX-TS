import type { ToolType } from '../../store';
import { geometryIconToolIds, geometryToolIcons } from './registry';

interface GeometryIconPreviewProps {
  toolIds?: ToolType[];
}

export function GeometryIconPreview({ toolIds = geometryIconToolIds }: GeometryIconPreviewProps) {
  return (
    <section aria-label="Geometry icon preview" className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {toolIds.map(toolId => {
          const Icon = geometryToolIcons[toolId];
          if (!Icon) return null;

          return (
            <article key={toolId} className="rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
              <div className="mb-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">{toolId}</div>
              <div className="grid grid-cols-3 items-center gap-2">
                <div className="flex h-12 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                  <Icon size={18} title={`${toolId} light 18px`} />
                </div>
                <div className="flex h-12 items-center justify-center rounded-md border border-slate-700 bg-slate-950 text-slate-100">
                  <Icon size={18} title={`${toolId} dark 18px`} />
                </div>
                <div className="flex h-12 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300">
                  <Icon size={24} title={`${toolId} accent 24px`} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
