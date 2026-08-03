import { loadLocalMonaco } from "../../../services/monacoLoader";

let codeEditorPromise:
  | Promise<{
      default: typeof import("../components/Editor").CodeEditor;
    }>
  | null = null;

export const loadStoicheiaCodeEditor = () => {
  codeEditorPromise ??= Promise.all([
    import("../components/Editor"),
    loadLocalMonaco(),
  ])
    .then(([module]) => ({ default: module.CodeEditor }))
    .catch((error) => {
      codeEditorPromise = null;
      throw error;
    });
  return codeEditorPromise;
};
