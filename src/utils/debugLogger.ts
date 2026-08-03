import { invoke } from "@tauri-apps/api/core";

export type DebugLevel = "debug" | "info" | "warn" | "error";

let bridgeWarningShown = false;
let globalHandlersInstalled = false;

const serializeDetails = (details: unknown): string | undefined => {
  if (details === undefined) return undefined;

  try {
    return JSON.stringify(details, (_key, value) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }
      return value;
    });
  } catch {
    return String(details);
  }
};

export const debugLog = (
  level: DebugLevel,
  scope: string,
  message: string,
  details?: unknown,
) => {
  const prefix = `[DataTeX][${scope}] ${message}`;
  const consoleMethod =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "debug"
          ? console.debug
          : console.info;

  if (details === undefined) {
    consoleMethod.call(console, prefix);
  } else {
    consoleMethod.call(console, prefix, details);
  }

  void invoke("frontend_debug_log_cmd", {
    level,
    scope,
    message,
    details: serializeDetails(details),
  }).catch((bridgeError) => {
    if (bridgeWarningShown) return;
    bridgeWarningShown = true;
    console.warn("[DataTeX][DIAGNOSTICS] Terminal log bridge unavailable", bridgeError);
  });
};

export const installGlobalDebugHandlers = () => {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  window.addEventListener("error", (event) => {
    debugLog("error", "APP", "window-error", {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    debugLog("error", "APP", "unhandled-promise-rejection", {
      reason: event.reason,
    });
  });
};
