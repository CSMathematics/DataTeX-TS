import { useSyncExternalStore } from "react";

export interface StoicheiaHostPerformanceMetrics {
  parseRoundTripMs?: number;
  parseMs?: number;
  geometryMs?: number;
  viewportMs?: number;
  viewportBuildMs?: number;
  rendererMs?: number;
  compileRoundTripMs?: number;
}

export interface StoicheiaHostStatusSnapshot {
  activeTool: string;
  zoomLevel: number;
  parsedNodeCount: number;
  snapToGrid: boolean;
  performanceMetrics: StoicheiaHostPerformanceMetrics | null;
  isCompiling: boolean;
  hasCompileError: boolean;
  previewMode: "instant" | "latex";
}

const EMPTY_STATUS: Readonly<StoicheiaHostStatusSnapshot> = Object.freeze({
  activeTool: "cursor",
  zoomLevel: 1,
  parsedNodeCount: 0,
  snapToGrid: true,
  performanceMetrics: null,
  isCompiling: false,
  hasCompileError: false,
  previewMode: "instant",
});

let snapshot = EMPTY_STATUS;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const publishStoicheiaHostStatus = (
  nextStatus: StoicheiaHostStatusSnapshot,
) => {
  snapshot = Object.freeze({
    ...nextStatus,
    performanceMetrics: nextStatus.performanceMetrics
      ? Object.freeze({ ...nextStatus.performanceMetrics })
      : null,
  });
  emit();
};

export const clearStoicheiaHostStatus = () => {
  if (snapshot === EMPTY_STATUS) return;
  snapshot = EMPTY_STATUS;
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => snapshot;

export const useStoicheiaHostStatus = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
