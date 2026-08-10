import { describe, expect, it, vi } from "vitest";

const editorState = vi.hoisted(() => ({ evaluations: 0 }));
const monacoState = vi.hoisted(() => {
  let resolve!: (value: {
    monaco: Record<string, never>;
    reactMonaco: Record<string, never>;
  }) => void;
  const promise = new Promise<{
    monaco: Record<string, never>;
    reactMonaco: Record<string, never>;
  }>((complete) => {
    resolve = complete;
  });
  return { loads: 0, promise, resolve };
});
vi.mock("../components/Editor", () => {
  editorState.evaluations += 1;
  return { CodeEditor: () => null };
});
vi.mock("../../../services/monacoLoader", () => ({
  loadLocalMonaco: () => {
    monacoState.loads += 1;
    return monacoState.promise;
  },
}));

import { loadStoicheiaCodeEditor } from "./loadCodeEditor";

describe("Stoicheia code editor lazy boundary", () => {
  it("waits for bundled Monaco before exposing and caches the editor", async () => {
    expect(editorState.evaluations).toBe(0);
    expect(monacoState.loads).toBe(0);

    const firstLoad = loadStoicheiaCodeEditor();
    const secondLoad = loadStoicheiaCodeEditor();
    expect(secondLoad).toBe(firstLoad);

    let settled = false;
    void firstLoad.then(() => {
      settled = true;
    });
    await vi.waitFor(() => expect(editorState.evaluations).toBe(1));
    expect(settled).toBe(false);

    monacoState.resolve({ monaco: {}, reactMonaco: {} });
    await firstLoad;
    expect(settled).toBe(true);
    expect(monacoState.loads).toBe(1);
  });
});
