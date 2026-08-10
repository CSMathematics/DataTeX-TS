import { debugLog } from "./debugLogger";

export const STOICHEIA_RUNTIME_CAPTURE_FLAG =
  "datatex-stoicheia-perf-capture";
export const STOICHEIA_RUNTIME_REPORT_KEY =
  "datatex-stoicheia-runtime-performance-v1";

type FrameInteraction = "drag" | "pan" | "zoom";

interface RuntimeLongTask {
  startTimeMs: number;
  durationMs: number;
}

interface RuntimeMetrics {
  coldStartupToFirstPaintMs?: number;
  graphicsModuleLoadMs?: number;
  firstCanvasCommitMs?: number;
  parseRoundTripMs: number[];
  rendererMs: number[];
  dragFrameIntervalsMs: number[];
  panFrameIntervalsMs: number[];
  zoomFrameIntervalsMs: number[];
  exactCompileColdMs?: number;
  exactCompileWarmMs?: number;
  failedExactCompileMs: number[];
}

export interface StoicheiaRuntimePerformanceReport {
  schemaVersion: 1;
  suite: "datatex-stoicheia-production-tauri-performance";
  sessionId: string;
  startedAt: string;
  completedAt?: string;
  captureMode: "production-tauri-webview" | "development-tauri-webview";
  environment: {
    userAgent: string;
    platform: string;
    hardwareConcurrency: number | null;
    deviceMemoryGb: number | null;
    devicePixelRatio: number;
    screen: { width: number; height: number };
    performanceTimeOrigin: number;
    longTaskObserverSupported: boolean;
  };
  metrics: RuntimeMetrics;
  longTasks: RuntimeLongTask[];
}

interface ActiveFrameInteraction {
  startedAt: number;
  lastFrameAt: number | null;
  intervals: number[];
  autoEndTimer: number | null;
}

interface RuntimeCaptureApi {
  snapshot: () => StoicheiaRuntimePerformanceReport | null;
  missing: () => string[];
  finish: () => StoicheiaRuntimePerformanceReport | null;
  reset: () => void;
  copy: () => Promise<boolean>;
}

declare global {
  interface Window {
    __DATATEX_STOICHEIA_PERF__?: RuntimeCaptureApi;
  }

  interface Navigator {
    deviceMemory?: number;
  }
}

const activeInteractions = new Map<FrameInteraction, ActiveFrameInteraction>();
const successfulCompileSignatures = new Set<string>();
let report: StoicheiaRuntimePerformanceReport | null = null;
let initialized = false;
let graphicsLoadStartedAt: number | null = null;
let firstCanvasCommitRecorded = false;
let longTaskObserver: PerformanceObserver | null = null;

const requiredMetricKeys: Array<keyof RuntimeMetrics> = [
  "coldStartupToFirstPaintMs",
  "graphicsModuleLoadMs",
  "firstCanvasCommitMs",
  "parseRoundTripMs",
  "rendererMs",
  "dragFrameIntervalsMs",
  "panFrameIntervalsMs",
  "zoomFrameIntervalsMs",
  "exactCompileColdMs",
  "exactCompileWarmMs",
];

const now = () => performance.now();
const rounded = (value: number) => Math.round(value * 1_000) / 1_000;
const cloneReport = () => report
  ? JSON.parse(JSON.stringify(report)) as StoicheiaRuntimePerformanceReport
  : null;

export const getMissingStoicheiaRuntimePerformanceMetrics = () => {
  if (!report) return [...requiredMetricKeys];
  return requiredMetricKeys.filter((key) => {
    const value = report?.metrics[key];
    return Array.isArray(value)
      ? value.length === 0 || !value.every(Number.isFinite)
      : !Number.isFinite(value);
  });
};

const buildCaptureEnabled = () => {
  try {
    return import.meta.env.VITE_STOICHEIA_PERF_CAPTURE === "1";
  } catch {
    return false;
  }
};

export const isStoicheiaRuntimeCaptureEnabled = () => {
  if (typeof window === "undefined") return false;
  if (buildCaptureEnabled()) return true;
  try {
    return window.localStorage.getItem(STOICHEIA_RUNTIME_CAPTURE_FLAG) === "1";
  } catch {
    return false;
  }
};

const persist = () => {
  if (!report) return;
  try {
    window.localStorage.setItem(
      STOICHEIA_RUNTIME_REPORT_KEY,
      JSON.stringify(report),
    );
  } catch {
    // Terminal events still preserve the capture when storage is unavailable.
  }
};

const emitMetric = (metric: string, value: unknown) => {
  debugLog("info", "STOICHEIA_PERF", metric, {
    sessionId: report?.sessionId,
    value,
  });
};

const createReport = (
  longTaskObserverSupported: boolean,
): StoicheiaRuntimePerformanceReport => ({
  schemaVersion: 1,
  suite: "datatex-stoicheia-production-tauri-performance",
  sessionId: globalThis.crypto?.randomUUID?.()
    ?? `perf-${Date.now().toString(36)}`,
  startedAt: new Date().toISOString(),
  captureMode: import.meta.env.PROD
    ? "production-tauri-webview"
    : "development-tauri-webview",
  environment: {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemoryGb: navigator.deviceMemory ?? null,
    devicePixelRatio: window.devicePixelRatio,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
    },
    performanceTimeOrigin: performance.timeOrigin,
    longTaskObserverSupported,
  },
  metrics: {
    parseRoundTripMs: [],
    rendererMs: [],
    dragFrameIntervalsMs: [],
    panFrameIntervalsMs: [],
    zoomFrameIntervalsMs: [],
    failedExactCompileMs: [],
  },
  longTasks: [],
});

const installLongTaskObserver = () => {
  if (typeof PerformanceObserver === "undefined") return false;
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      if (!report) return;
      for (const entry of list.getEntries()) {
        report.longTasks.push({
          startTimeMs: rounded(entry.startTime),
          durationMs: rounded(entry.duration),
        });
      }
    });
    longTaskObserver.observe({ entryTypes: ["longtask"] });
    return true;
  } catch {
    longTaskObserver = null;
    return false;
  }
};

export const initializeStoicheiaRuntimePerformanceCapture = () => {
  if (initialized || !isStoicheiaRuntimeCaptureEnabled()) return;
  initialized = true;
  const supportsLongTasks = installLongTaskObserver();
  report = createReport(supportsLongTasks);

  window.__DATATEX_STOICHEIA_PERF__ = {
    snapshot: cloneReport,
    missing: getMissingStoicheiaRuntimePerformanceMetrics,
    finish: finishStoicheiaRuntimePerformanceCapture,
    reset: resetStoicheiaRuntimePerformanceCapture,
    copy: copyStoicheiaRuntimePerformanceReport,
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!report || report.metrics.coldStartupToFirstPaintMs !== undefined) {
        return;
      }
      const duration = rounded(now());
      report.metrics.coldStartupToFirstPaintMs = duration;
      persist();
      emitMetric("capture-started", {
        longTaskObserverSupported: supportsLongTasks,
      });
      emitMetric("cold-startup-first-paint", duration);
    });
  });
};

export const markStoicheiaGraphicsModuleLoadStart = () => {
  if (!isStoicheiaRuntimeCaptureEnabled() || graphicsLoadStartedAt !== null) return;
  graphicsLoadStartedAt = now();
};

export const markStoicheiaGraphicsModuleLoadEnd = () => {
  if (!report || graphicsLoadStartedAt === null) return;
  const duration = rounded(now() - graphicsLoadStartedAt);
  if (report.metrics.graphicsModuleLoadMs === undefined) {
    report.metrics.graphicsModuleLoadMs = duration;
    persist();
    emitMetric("graphics-module-load", duration);
  }
};

export const markStoicheiaFirstCanvasCommit = () => {
  if (
    !report
    || firstCanvasCommitRecorded
    || graphicsLoadStartedAt === null
  ) return;
  firstCanvasCommitRecorded = true;
  const duration = rounded(now() - graphicsLoadStartedAt);
  report.metrics.firstCanvasCommitMs = duration;
  persist();
  emitMetric("first-canvas-commit", duration);
};

const appendMetric = (
  key: "parseRoundTripMs" | "rendererMs",
  value: number,
) => {
  if (!report || !Number.isFinite(value)) return;
  report.metrics[key].push(rounded(value));
  persist();
  emitMetric(key, rounded(value));
};

export const recordStoicheiaParseRoundTrip = (durationMs: number) =>
  appendMetric("parseRoundTripMs", durationMs);

export const recordStoicheiaRenderer = (durationMs: number) => {
  if (!report || !Number.isFinite(durationMs)) return;
  // Rendering is the hot path. Keep capture to one in-memory append and defer
  // storage/terminal work until the interaction ends or capture is finished.
  report.metrics.rendererMs.push(rounded(durationMs));
};

const sourceSignature = (source: string, compiler: string) => {
  let hash = 0x811c9dc5;
  const value = `${compiler}\0${source}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${compiler}:${source.length}:${(hash >>> 0).toString(16)}`;
};

export const recordStoicheiaExactCompile = (
  durationMs: number,
  source: string,
  compiler: string,
  success: boolean,
) => {
  if (!report || !Number.isFinite(durationMs)) return;
  const duration = rounded(durationMs);
  if (!success) {
    report.metrics.failedExactCompileMs.push(duration);
    persist();
    emitMetric("exact-compile-failed", duration);
    return;
  }

  const signature = sourceSignature(source, compiler);
  if (!successfulCompileSignatures.has(signature)) {
    successfulCompileSignatures.add(signature);
    report.metrics.exactCompileColdMs ??= duration;
    emitMetric("exact-compile-cold", duration);
  } else {
    report.metrics.exactCompileWarmMs = duration;
    emitMetric("exact-compile-warm", duration);
  }
  persist();
};

export const beginStoicheiaFrameInteraction = (kind: FrameInteraction) => {
  if (!report) return;
  const existing = activeInteractions.get(kind);
  if (existing?.autoEndTimer != null) {
    window.clearTimeout(existing.autoEndTimer);
  }
  activeInteractions.set(kind, {
    startedAt: now(),
    lastFrameAt: null,
    intervals: [],
    autoEndTimer: null,
  });
};

export const recordStoicheiaInteractionFrame = (
  kind: FrameInteraction,
  autoEndMs?: number,
) => {
  if (!report) return;
  if (!activeInteractions.has(kind)) beginStoicheiaFrameInteraction(kind);
  const interaction = activeInteractions.get(kind);
  if (!interaction) return;
  const frameAt = now();
  if (interaction.lastFrameAt !== null) {
    interaction.intervals.push(rounded(frameAt - interaction.lastFrameAt));
  }
  interaction.lastFrameAt = frameAt;
  if (interaction.autoEndTimer !== null) {
    window.clearTimeout(interaction.autoEndTimer);
    interaction.autoEndTimer = null;
  }
  if (autoEndMs !== undefined) {
    interaction.autoEndTimer = window.setTimeout(
      () => endStoicheiaFrameInteraction(kind),
      autoEndMs,
    );
  }
};

export const endStoicheiaFrameInteraction = (kind: FrameInteraction) => {
  const interaction = activeInteractions.get(kind);
  if (!report || !interaction) return;
  if (interaction.autoEndTimer !== null) {
    window.clearTimeout(interaction.autoEndTimer);
  }
  activeInteractions.delete(kind);
  const metricKey = `${kind}FrameIntervalsMs` as const;
  report.metrics[metricKey].push(...interaction.intervals);
  persist();
  emitMetric(`${kind}-interaction`, {
    durationMs: rounded(now() - interaction.startedAt),
    frameIntervalsMs: interaction.intervals,
  });
};

export const finishStoicheiaRuntimePerformanceCapture = () => {
  if (!report) return null;
  for (const kind of [...activeInteractions.keys()]) {
    endStoicheiaFrameInteraction(kind);
  }
  report.completedAt = new Date().toISOString();
  longTaskObserver?.disconnect();
  longTaskObserver = null;
  persist();
  debugLog("info", "STOICHEIA_PERF", "capture-complete", cloneReport());
  return cloneReport();
};

export const copyStoicheiaRuntimePerformanceReport = async () => {
  const missing = getMissingStoicheiaRuntimePerformanceMetrics();
  if (missing.length > 0) {
    debugLog("warn", "STOICHEIA_PERF", "capture-incomplete", { missing });
    return false;
  }
  const snapshot = finishStoicheiaRuntimePerformanceCapture();
  if (!snapshot || !navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
  return true;
};

export const resetStoicheiaRuntimePerformanceCapture = () => {
  for (const interaction of activeInteractions.values()) {
    if (interaction.autoEndTimer !== null) {
      window.clearTimeout(interaction.autoEndTimer);
    }
  }
  activeInteractions.clear();
  successfulCompileSignatures.clear();
  longTaskObserver?.disconnect();
  longTaskObserver = null;
  report = null;
  initialized = false;
  graphicsLoadStartedAt = null;
  firstCanvasCommitRecorded = false;
  try {
    window.localStorage.removeItem(STOICHEIA_RUNTIME_REPORT_KEY);
  } catch {
    // No persisted report to clear.
  }
  delete window.__DATATEX_STOICHEIA_PERF__;
};
