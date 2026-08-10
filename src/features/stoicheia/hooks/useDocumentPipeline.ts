import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  AstNode,
  GeometryDiagnostic,
  ResolvedViewport,
  type LatexCompiler,
  type LatexEnginePaths,
  useEditorStore,
} from '../store';
import {
  isPerformanceLoggingEnabled,
  logPerformance,
  nowMs,
} from '../performanceMetrics';
import { startExactResponsivenessProbe } from '../bridge/exactResponsiveness';

interface ParseTimings {
  parseMs?: number;
  geometryMs?: number;
  viewportMs?: number;
  totalMs?: number;
  nodeCount?: number;
  resolvedPointCount?: number;
}

interface ParseResult {
  nodes?: AstNode[];
  resolved_points?: Record<string, { x: number; y: number }>;
  geometry_complete?: boolean;
  viewport?: ResolvedViewport | null;
  renderScene?: {
    points?: Record<string, { x: number; y: number }>;
    viewBox?: string | null;
    geometryComplete?: boolean;
    diagnostics?: GeometryDiagnostic[];
  };
  timings?: ParseTimings;
}

interface CompileResult {
  success: boolean;
  svg?: string | null;
  error_log?: string | null;
}

interface DocumentPipelineOverrides {
  latexCompiler?: LatexCompiler;
  latexEnginePaths?: LatexEnginePaths;
  dvisvgmPath?: string;
}

interface ActiveCompilation {
  requestId: number;
  compilationId: string;
  stopRequested: boolean;
}

let compilationIdSequence = 0;

function createCompilationId() {
  compilationIdSequence += 1;
  const entropy = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
  return `stoicheia-exact-preview-${entropy}-${compilationIdSequence}`;
}

export function useDocumentPipeline(overrides: DocumentPipelineOverrides = {}) {
  const source = useEditorStore(state => state.source);
  const previewMode = useEditorStore(state => state.previewMode);
  const storedLatexCompiler = useEditorStore(state => state.settings.latexCompiler);
  const storedLatexEnginePaths = useEditorStore(state => state.settings.latexEnginePaths);
  const latexCompiler = overrides.latexCompiler ?? storedLatexCompiler;
  const latexEnginePaths = overrides.latexEnginePaths ?? storedLatexEnginePaths;
  const dvisvgmPath = overrides.dvisvgmPath ?? '';
  const latexEnginePathsKey = `${latexEnginePaths.lualatex}\n${latexEnginePaths.pdflatex}\n${latexEnginePaths.xelatex}\n${dvisvgmPath}`;
  const parseTimerRef = useRef<number | null>(null);
  const compileTimerRef = useRef<number | null>(null);
  const parseRequestRef = useRef(0);
  const compileRequestRef = useRef(0);
  const activeCompilationRef = useRef<ActiveCompilation | null>(null);
  const stopResponsivenessProbeRef = useRef<(() => void) | null>(null);

  const stopResponsivenessProbe = () => {
    stopResponsivenessProbeRef.current?.();
    stopResponsivenessProbeRef.current = null;
  };

  const stopActiveCompilation = (expectedRequestId?: number) => {
    const activeCompilation = activeCompilationRef.current;
    if (
      !activeCompilation
      || activeCompilation.stopRequested
      || (expectedRequestId !== undefined && activeCompilation.requestId !== expectedRequestId)
    ) {
      return;
    }

    activeCompilation.stopRequested = true;
    activeCompilationRef.current = null;
    stopResponsivenessProbe();
    useEditorStore.getState().setIsCompiling(false);
    void invoke<void>('stop_compile', { compilationId: activeCompilation.compilationId }).catch(() => {
      // A superseded preview remains stale even if the native process has already exited.
      // Do not replace the current document diagnostics with a best-effort stop failure.
    });
  };

  useEffect(() => () => {
    parseRequestRef.current += 1;
    compileRequestRef.current += 1;
    if (parseTimerRef.current) window.clearTimeout(parseTimerRef.current);
    if (compileTimerRef.current) window.clearTimeout(compileTimerRef.current);
    stopActiveCompilation();
    stopResponsivenessProbe();
    useEditorStore.getState().setIsCompiling(false);
  }, []);

  useEffect(() => {
    const requestId = ++parseRequestRef.current;
    if (parseTimerRef.current) window.clearTimeout(parseTimerRef.current);

    parseTimerRef.current = window.setTimeout(async () => {
      try {
        const startedAt = nowMs();
        const result = await invoke<ParseResult>('parse_tikz', { source });
        const parseRoundTripMs = nowMs() - startedAt;
        if (requestId === parseRequestRef.current) {
          const store = useEditorStore.getState();
          const scene = result.renderScene;
          const geometryComplete = scene?.geometryComplete ?? Boolean(result.geometry_complete);
          const scenePoints = scene?.points ?? result.resolved_points;
          const resolvedPoints = scenePoints ?? (geometryComplete ? {} : null);
          const resolvedViewport = geometryComplete
            ? scene?.viewBox ? { viewBox: scene.viewBox } : result.viewport ?? null
            : null;
          const geometryDiagnostics = scene?.diagnostics ?? [];
          store.setParsedDocument(
            result.nodes || [],
            resolvedPoints,
            resolvedViewport,
            source,
            geometryDiagnostics,
          );
          const metrics = {
            parseMs: result.timings?.parseMs,
            geometryMs: result.timings?.geometryMs,
            viewportMs: result.timings?.viewportMs,
            rustTotalMs: result.timings?.totalMs,
            parseRoundTripMs,
            nodeCount: result.timings?.nodeCount ?? result.nodes?.length ?? 0,
            resolvedPointCount: result.timings?.resolvedPointCount ?? (resolvedPoints ? Object.keys(resolvedPoints).length : 0),
            geometryComplete,
          };
          store.setPerformanceMetrics(metrics);
          logPerformance('parse', metrics);
        }
      } catch (error) {
        if (requestId === parseRequestRef.current) {
          console.error('Parse error:', error);
        }
      }
    }, 50);

    return () => {
      if (parseTimerRef.current) window.clearTimeout(parseTimerRef.current);
      if (parseRequestRef.current === requestId) {
        parseRequestRef.current += 1;
      }
    };
  }, [source]);

  useEffect(() => {
    const requestId = ++compileRequestRef.current;
    if (compileTimerRef.current) {
      window.clearTimeout(compileTimerRef.current);
      compileTimerRef.current = null;
    }

    if (previewMode !== 'latex') {
      useEditorStore.getState().setIsCompiling(false);
      return () => {
        if (compileTimerRef.current) {
          window.clearTimeout(compileTimerRef.current);
          compileTimerRef.current = null;
        }
        if (compileRequestRef.current === requestId) {
          compileRequestRef.current += 1;
        }
      };
    }

    compileTimerRef.current = window.setTimeout(async () => {
      compileTimerRef.current = null;
      if (requestId !== compileRequestRef.current) return;

      // The effect cleanup normally stops the previous job. Keep this guard so a
      // future scheduling change can never leave two exact-preview jobs active.
      stopActiveCompilation();
      const activeCompilation: ActiveCompilation = {
        requestId,
        compilationId: createCompilationId(),
        stopRequested: false,
      };
      activeCompilationRef.current = activeCompilation;
      const store = useEditorStore.getState();
      store.setIsCompiling(true);
      let responsivenessSamples = 0;
      let maximumMainThreadLagMs = 0;
      stopResponsivenessProbe();
      if (isPerformanceLoggingEnabled()) {
        stopResponsivenessProbeRef.current = startExactResponsivenessProbe(mainThreadLagMs => {
          if (
            activeCompilation.stopRequested
            || activeCompilationRef.current !== activeCompilation
          ) return;
          responsivenessSamples += 1;
          maximumMainThreadLagMs = Math.max(maximumMainThreadLagMs, mainThreadLagMs);
          logPerformance('exact-responsiveness', {
            mainThreadLagMs,
            maximumMainThreadLagMs,
            responsivenessSamples,
          });
        });
      }
      try {
        const startedAt = nowMs();
        const result = await invoke<CompileResult>('compile_latex', {
          source,
          compiler: latexCompiler,
          enginePaths: { ...latexEnginePaths, dvisvgm: dvisvgmPath },
          compilationId: activeCompilation.compilationId,
        });
        const compileRoundTripMs = nowMs() - startedAt;
        if (
          requestId !== compileRequestRef.current
          || activeCompilation.stopRequested
          || activeCompilationRef.current !== activeCompilation
        ) return;
        store.setPerformanceMetrics({ compileRoundTripMs });
        logPerformance('compile', { compileRoundTripMs });

        if (result.success && result.svg) {
          store.setSvgOutput(result.svg);
          store.setCompiledSource(source);
          store.setErrorLog(null);
        } else {
          store.setErrorLog(result.error_log || 'Unknown LaTeX compilation error');
        }
      } catch (error) {
        if (
          requestId === compileRequestRef.current
          && !activeCompilation.stopRequested
          && activeCompilationRef.current === activeCompilation
        ) {
          store.setErrorLog(String(error));
        }
      } finally {
        if (
          requestId === compileRequestRef.current
          && activeCompilationRef.current === activeCompilation
        ) {
          stopResponsivenessProbe();
          logPerformance('exact-responsiveness-summary', {
            maximumMainThreadLagMs,
            responsivenessSamples,
          });
          activeCompilationRef.current = null;
          useEditorStore.getState().setIsCompiling(false);
        }
      }
    }, 1500);

    return () => {
      if (compileTimerRef.current) {
        window.clearTimeout(compileTimerRef.current);
        compileTimerRef.current = null;
      }
      if (compileRequestRef.current === requestId) {
        compileRequestRef.current += 1;
      }
      stopActiveCompilation(requestId);
    };
  }, [source, previewMode, latexCompiler, latexEnginePathsKey]);
}
