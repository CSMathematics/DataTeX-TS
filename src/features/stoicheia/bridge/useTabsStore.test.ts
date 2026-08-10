import { beforeEach, describe, expect, it } from "vitest";
import {
  useTabsStore,
  type AppTab,
} from "../../../stores/useTabsStore";

const sourcePath = "/project/source.tex";
const targetPath = "/project/copy.tex";
const source = "\\documentclass{article}\n\\begin{document}\nDraft\n\\end{document}";

const createEditorTab = (
  overrides: Partial<AppTab> = {},
): AppTab => ({
  id: sourcePath,
  title: "source.tex",
  type: "editor",
  content: source,
  isDirty: true,
  language: "latex",
  ...overrides,
});

describe("useTabsStore.retargetEditorTab", () => {
  beforeEach(() => {
    useTabsStore.setState({
      tabs: [
        { id: "start-page", title: "Start Page", type: "start-page" },
        createEditorTab(),
      ],
      activeTabId: sourcePath,
    });
  });

  it("atomically retargets the matching editor and marks it clean", () => {
    const result = useTabsStore
      .getState()
      .retargetEditorTab(sourcePath, targetPath, "copy.tex", source);

    expect(result).toBe(true);
    expect(useTabsStore.getState()).toMatchObject({
      activeTabId: targetPath,
      tabs: [
        { id: "start-page", title: "Start Page", type: "start-page" },
        {
          id: targetPath,
          title: "copy.tex",
          type: "editor",
          content: source,
          isDirty: false,
          language: "latex",
        },
      ],
    });
    expect(useTabsStore.getState().tabs.some((tab) => tab.id === sourcePath))
      .toBe(false);
  });

  it("rejects a stale expected source without mutating the state", () => {
    const before = useTabsStore.getState();

    const result = before.retargetEditorTab(
      sourcePath,
      targetPath,
      "copy.tex",
      `${source}\n% stale`,
    );

    const after = useTabsStore.getState();
    expect(result).toBe(false);
    expect(after).toBe(before);
    expect(after.tabs).toBe(before.tabs);
    expect(after.activeTabId).toBe(sourcePath);
  });

  it("rejects an existing destination tab without mutating the state", () => {
    useTabsStore.setState((state) => ({
      tabs: [
        ...state.tabs,
        createEditorTab({
          id: targetPath,
          title: "copy.tex",
          content: "existing target",
          isDirty: false,
        }),
      ],
    }));
    const before = useTabsStore.getState();

    const result = before.retargetEditorTab(
      sourcePath,
      targetPath,
      "copy.tex",
      source,
    );

    const after = useTabsStore.getState();
    expect(result).toBe(false);
    expect(after).toBe(before);
    expect(after.tabs).toBe(before.tabs);
    expect(after.tabs.find((tab) => tab.id === targetPath)?.content).toBe(
      "existing target",
    );
  });

  it("preserves activeTabId when retargeting an inactive editor", () => {
    useTabsStore.setState({ activeTabId: "start-page" });

    const result = useTabsStore
      .getState()
      .retargetEditorTab(sourcePath, targetPath, "copy.tex", source);

    expect(result).toBe(true);
    expect(useTabsStore.getState().activeTabId).toBe("start-page");
    expect(useTabsStore.getState().tabs).toContainEqual(
      expect.objectContaining({ id: targetPath, title: "copy.tex" }),
    );
  });
});
