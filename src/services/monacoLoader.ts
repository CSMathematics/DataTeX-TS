import { debugLog } from "../utils/debugLogger";
import { configureMonacoWorkers } from "./monacoWorkers";

type MonacoModule = typeof import("monaco-editor");
type ReactMonacoModule = typeof import("@monaco-editor/react");

let localMonacoPromise: Promise<{
  monaco: MonacoModule;
  reactMonaco: ReactMonacoModule;
}> | null = null;

/**
 * Loads Monaco on demand and points @monaco-editor/react at the bundled
 * instance. This keeps the start page light without falling back to the
 * loader's CDN, which is important for an offline desktop application.
 */
export const loadLocalMonaco = () => {
  if (!localMonacoPromise) {
    configureMonacoWorkers();
    localMonacoPromise = Promise.all([
      import("monaco-editor"),
      import("@monaco-editor/react"),
    ])
      .then(([monaco, reactMonaco]) => {
        reactMonaco.loader.config({ monaco });
        return { monaco, reactMonaco };
      })
      .catch((error) => {
        localMonacoPromise = null;
        debugLog("error", "MONACO", "runtime-load-failed", { error });
        throw error;
      });
  }

  return localMonacoPromise;
};
