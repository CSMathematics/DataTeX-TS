import { nowMs } from '../performanceMetrics';

export const EXACT_RESPONSIVENESS_PROBE_INTERVAL_MS = 250;

/**
 * Samples browser event-loop drift while native exact preview is active.
 * The probe is host integration code so copied Stoicheia metrics/store files
 * remain byte-identical. It performs no React state update on its own.
 */
export const startExactResponsivenessProbe = (
  onSample: (mainThreadLagMs: number) => void,
  intervalMs = EXACT_RESPONSIVENESS_PROBE_INTERVAL_MS,
) => {
  let cancelled = false;
  let expectedAt = nowMs() + intervalMs;
  let timer = window.setTimeout(function sample() {
    if (cancelled) return;
    const sampledAt = nowMs();
    onSample(Math.max(0, sampledAt - expectedAt));
    if (cancelled) return;
    expectedAt = sampledAt + intervalMs;
    timer = window.setTimeout(sample, intervalMs);
  }, intervalMs);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
};
