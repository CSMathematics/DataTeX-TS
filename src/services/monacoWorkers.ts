import CssWorker from "monaco-editor/esm/vs/language/css/css.worker.js?worker";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker.js?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker.js?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker.js?worker";
import { debugLog } from "../utils/debugLogger";

export type MonacoWorkerKind =
  | "editor"
  | "json"
  | "css"
  | "html"
  | "typescript";

type MonacoWorkerEnvironment = {
  getWorker?: (workerId: string, label: string) => Promise<Worker> | Worker;
  getWorkerUrl?: (workerId: string, label: string) => string;
};

const workerGlobal = globalThis as typeof globalThis & {
  MonacoEnvironment?: MonacoWorkerEnvironment;
};

const reportedWorkerKinds = new Set<MonacoWorkerKind>();
let workersConfigured = false;

export const getMonacoWorkerKind = (label: string): MonacoWorkerKind => {
  if (label === "json") return "json";
  if (label === "css" || label === "scss" || label === "less") return "css";
  if (label === "html" || label === "handlebars" || label === "razor") {
    return "html";
  }
  if (label === "typescript" || label === "javascript") return "typescript";
  return "editor";
};

const createWorker = (kind: MonacoWorkerKind): Worker => {
  switch (kind) {
    case "json":
      return new JsonWorker({ name: "datatex-monaco-json" });
    case "css":
      return new CssWorker({ name: "datatex-monaco-css" });
    case "html":
      return new HtmlWorker({ name: "datatex-monaco-html" });
    case "typescript":
      return new TypeScriptWorker({ name: "datatex-monaco-typescript" });
    default:
      return new EditorWorker({ name: "datatex-monaco-editor" });
  }
};

/**
 * Installs Monaco's Vite worker factory before the editor module is loaded.
 * The `?worker` imports keep language services off the UI thread in both
 * development and packaged Tauri builds.
 */
export const configureMonacoWorkers = () => {
  if (
    workersConfigured &&
    typeof workerGlobal.MonacoEnvironment?.getWorker === "function"
  ) {
    return;
  }

  workerGlobal.MonacoEnvironment = {
    ...(workerGlobal.MonacoEnvironment ?? {}),
    getWorker: (_workerId, label) => {
      const kind = getMonacoWorkerKind(label);

      try {
        const worker = createWorker(kind);

        if (!reportedWorkerKinds.has(kind)) {
          reportedWorkerKinds.add(kind);
          debugLog("debug", "MONACO", "worker-created", { label, kind });
        }

        worker.addEventListener(
          "error",
          (event) => {
            debugLog("error", "MONACO", "worker-runtime-error", {
              label,
              kind,
              message: event.message,
              filename: event.filename,
              line: event.lineno,
              column: event.colno,
            });
          },
          { once: true },
        );

        worker.addEventListener(
          "messageerror",
          () => {
            debugLog("error", "MONACO", "worker-message-error", {
              label,
              kind,
            });
          },
          { once: true },
        );

        return worker;
      } catch (error) {
        debugLog("error", "MONACO", "worker-create-failed", {
          label,
          kind,
          error,
        });
        throw error;
      }
    },
  };
  workersConfigured = true;

  debugLog("info", "MONACO", "workers-configured", {
    strategy: "vite-bundled",
    workers: ["editor", "json", "css", "html", "typescript"],
  });
};
