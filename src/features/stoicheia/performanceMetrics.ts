export const nowMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

export const isPerformanceLoggingEnabled = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('stoicheia-perf') === '1';
  } catch {
    return false;
  }
};

export const logPerformance = (label: string, metrics: Record<string, unknown>) => {
  if (!isPerformanceLoggingEnabled()) return;
  console.debug(`[Stoicheia perf] ${label}`, metrics);
};
