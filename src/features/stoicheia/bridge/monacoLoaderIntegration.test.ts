import { afterAll, describe, expect, it, vi } from "vitest";

const loaderState = vi.hoisted(() => ({
  config: vi.fn(),
  environmentReadyAtImport: false,
  workers: [] as string[],
  debugLog: vi.fn(),
}));

vi.mock("../../../utils/debugLogger", () => ({
  debugLog: loaderState.debugLog,
}));
vi.mock(
  "monaco-editor/esm/vs/editor/editor.worker.js?worker",
  () => ({
    default: class {
      constructor() {
        loaderState.workers.push("editor");
      }

      addEventListener() {}
    },
  }),
);
vi.mock(
  "monaco-editor/esm/vs/language/json/json.worker.js?worker",
  () => ({
    default: class {
      constructor() {
        loaderState.workers.push("json");
      }

      addEventListener() {}
    },
  }),
);
vi.mock(
  "monaco-editor/esm/vs/language/css/css.worker.js?worker",
  () => ({
    default: class {
      constructor() {
        loaderState.workers.push("css");
      }

      addEventListener() {}
    },
  }),
);
vi.mock(
  "monaco-editor/esm/vs/language/html/html.worker.js?worker",
  () => ({
    default: class {
      constructor() {
        loaderState.workers.push("html");
      }

      addEventListener() {}
    },
  }),
);
vi.mock(
  "monaco-editor/esm/vs/language/typescript/ts.worker.js?worker",
  () => ({
    default: class {
      constructor() {
        loaderState.workers.push("typescript");
      }

      addEventListener() {}
    },
  }),
);
vi.mock("monaco-editor", () => {
  loaderState.environmentReadyAtImport =
    typeof globalThis.MonacoEnvironment?.getWorker === "function";
  return { editor: {} };
});
vi.mock("@monaco-editor/react", () => ({
  default: () => null,
  loader: {
    config: loaderState.config,
  },
}));

import { loadLocalMonaco } from "../../../services/monacoLoader";

describe("local Monaco loader", () => {
  afterAll(() => {
    delete globalThis.MonacoEnvironment;
  });

  it("configures bundled workers before Monaco and caches the local runtime", async () => {
    const firstLoad = loadLocalMonaco();
    const secondLoad = loadLocalMonaco();
    expect(secondLoad).toBe(firstLoad);

    const result = await firstLoad;
    expect(loaderState.config).toHaveBeenCalledOnce();
    expect(loaderState.config).toHaveBeenCalledWith({
      monaco: result.monaco,
    });
    expect(loaderState.environmentReadyAtImport).toBe(true);

    const getWorker = globalThis.MonacoEnvironment?.getWorker;
    expect(getWorker).toBeTypeOf("function");

    const labels = [
      ["json", "json"],
      ["css", "css"],
      ["scss", "css"],
      ["less", "css"],
      ["html", "html"],
      ["handlebars", "html"],
      ["razor", "html"],
      ["typescript", "typescript"],
      ["javascript", "typescript"],
      ["editorWorkerService", "editor"],
      ["my-latex", "editor"],
      ["stoicheia-latex", "editor"],
      ["unknown-custom-language", "editor"],
    ] as const;

    for (const [label] of labels) {
      getWorker?.("worker-id", label);
    }

    expect(loaderState.workers).toEqual(labels.map(([, kind]) => kind));
    expect(loaderState.debugLog).toHaveBeenCalledWith(
      "info",
      "MONACO",
      "workers-configured",
      expect.objectContaining({ strategy: "vite-bundled" }),
    );
  });
});
