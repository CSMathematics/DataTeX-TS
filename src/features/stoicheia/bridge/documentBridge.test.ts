import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_APP_SETTINGS, useEditorStore } from "../store";
import {
  bindHostDocumentSession,
  commitHostDocumentApply,
  createHostDocumentApplyLifecycle,
  createHostDocumentApplyPayload,
  createHostSvgExportLifecycle,
  createHostSvgExportPayload,
  fingerprintDocumentSource,
  getHostDocumentSession,
  hostDocumentIdentity,
  resetHostDocumentBridgeForTests,
  validateHostDocumentApply,
  type StoicheiaHostDocument,
} from "./documentBridge";

const firstDocument: StoicheiaHostDocument = {
  sessionId: "workspace-1",
  id: "/project/first.tex",
  path: "/project/first.tex",
  source:
    "\\documentclass{article}\n\\begin{document}\nFirst\n\\end{document}",
};

describe("Stoicheia host document bridge", () => {
  beforeEach(() => {
    resetHostDocumentBridgeForTests();
    useEditorStore.setState({
      settings: { ...DEFAULT_APP_SETTINGS, defaultZoom: 1.6 },
      source: "stale source",
      sourceHistory: ["old history"],
      sourceRedoStack: ["old redo"],
      svgOutput: "<svg />",
      compiledSource: "compiled",
      isCompiling: true,
      errorLog: "old error",
      autosaveError: "old autosave error",
      parsedNodes: [{ type: "Point", name: "Z", x: 1, y: 2 }],
      parsedSource: "old parsed source",
      resolvedPoints: { Z: { x: 1, y: 2 } },
      resolvedViewport: { viewBox: "0 0 1 1" },
      geometryDiagnostics: [
        {
          severity: "error",
          message: "old diagnostic",
          nodeIndex: 0,
          nodeType: "Point",
        },
      ],
      performanceMetrics: { parseMs: 4 },
      activeTool: "add_point",
      selectedPoints: ["Z"],
      hoveredNode: "node-Z",
      selectedNode: "node-Z",
      zoomLevel: 4,
      pan: { x: 30, y: 40 },
      fitViewRequest: 9,
    });
  });

  it("seeds a clean document-scoped session from the active DataTeX tab", () => {
    const session = bindHostDocumentSession(firstDocument);
    const state = useEditorStore.getState();

    expect(session).toEqual({
      sessionId: firstDocument.sessionId,
      documentId: firstDocument.id,
      filePath: firstDocument.path,
      sourceRevision: fingerprintDocumentSource(firstDocument.source),
      baselineSource: firstDocument.source,
      target: { kind: "fullDocument" },
    });
    expect(state).toMatchObject({
      documentFilename: "first.tex",
      source: firstDocument.source,
      sourceHistory: [],
      sourceRedoStack: [],
      svgOutput: null,
      compiledSource: null,
      isCompiling: false,
      errorLog: null,
      autosaveError: null,
      parsedNodes: [],
      parsedSource: "",
      resolvedPoints: null,
      resolvedViewport: null,
      geometryDiagnostics: [],
      performanceMetrics: null,
      activeTool: "cursor",
      selectedPoints: [],
      hoveredNode: null,
      selectedNode: null,
      zoomLevel: 1.6,
      pan: { x: 0, y: 0 },
      fitViewRequest: 0,
    });
  });

  it("treats an empty active document as loaded content", () => {
    const emptyDocument: StoicheiaHostDocument = {
      sessionId: "workspace-1",
      id: "/project/empty.tex",
      path: "/project/empty.tex",
      source: "",
    };

    bindHostDocumentSession(emptyDocument);

    expect(useEditorStore.getState()).toMatchObject({
      documentFilename: "empty.tex",
      source: "",
      sourceHistory: [],
    });
    expect(getHostDocumentSession()?.baselineSource).toBe("");
  });

  it("preserves the local draft and immutable baseline on a same-file remount", () => {
    const originalSession = bindHostDocumentSession(firstDocument);
    useEditorStore.setState({
      source: `${firstDocument.source}\n% local Stoicheia edit`,
      sourceHistory: [firstDocument.source],
    });

    const reboundSession = bindHostDocumentSession({
      ...firstDocument,
      source: `${firstDocument.source}\n% newer host value`,
    });

    expect(reboundSession).toBe(originalSession);
    expect(getHostDocumentSession()?.baselineSource).toBe(firstDocument.source);
    expect(useEditorStore.getState().source).toContain(
      "% local Stoicheia edit",
    );
    expect(useEditorStore.getState().sourceHistory).toEqual([
      firstDocument.source,
    ]);
  });

  it("fully resets document-local state when the active file changes", () => {
    bindHostDocumentSession(firstDocument);
    useEditorStore.setState({
      source: `${firstDocument.source}\n% draft`,
      sourceHistory: [firstDocument.source],
      parsedNodes: [{ type: "Point", name: "A", x: 0, y: 0 }],
      selectedPoints: ["A"],
      errorLog: "stale compile error",
    });

    const secondDocument: StoicheiaHostDocument = {
      sessionId: firstDocument.sessionId,
      id: "C:\\project\\second.tex",
      path: "C:\\project\\second.tex",
      source:
        "\\documentclass{article}\n\\begin{document}\nSecond\n\\end{document}",
    };
    bindHostDocumentSession(secondDocument);

    expect(useEditorStore.getState()).toMatchObject({
      documentFilename: "second.tex",
      source: secondDocument.source,
      sourceHistory: [],
      parsedNodes: [],
      selectedPoints: [],
      errorLog: null,
    });
    expect(getHostDocumentSession()?.documentId).toBe(secondDocument.id);
  });

  it("reloads the latest host source when Package Studio is reopened", () => {
    bindHostDocumentSession(firstDocument);
    useEditorStore.setState({
      source: `${firstDocument.source}\n% abandoned local draft`,
    });

    const reopenedDocument: StoicheiaHostDocument = {
      ...firstDocument,
      sessionId: "workspace-2",
      source: `${firstDocument.source}\n% edited in DataTeX`,
    };
    bindHostDocumentSession(reopenedDocument);

    expect(useEditorStore.getState().source).toBe(reopenedDocument.source);
    expect(getHostDocumentSession()).toMatchObject({
      sessionId: "workspace-2",
      documentId: firstDocument.id,
      baselineSource: reopenedDocument.source,
    });
  });

  it("clears the previous document when no editor tab remains active", () => {
    bindHostDocumentSession(firstDocument);
    bindHostDocumentSession(null);

    expect(getHostDocumentSession()).toBeNull();
    expect(useEditorStore.getState()).toMatchObject({
      documentFilename: "source.tex",
      source: "",
      sourceHistory: [],
      parsedNodes: [],
      selectedPoints: [],
    });
  });

  it("creates a frozen Apply payload from the exact immutable baseline", () => {
    bindHostDocumentSession(firstDocument);
    const nextSource = `${firstDocument.source}\n% local Stoicheia edit`;
    useEditorStore.setState({ source: nextSource });

    const payload = createHostDocumentApplyPayload(nextSource);

    expect(payload).toEqual({
      sessionId: firstDocument.sessionId,
      documentId: firstDocument.id,
      filePath: firstDocument.path,
      baselineSource: firstDocument.source,
      sourceRevision: fingerprintDocumentSource(firstDocument.source),
      nextSource,
      target: { kind: "fullDocument" },
    });
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload?.target)).toBe(true);
    expect(Object.isFrozen(getHostDocumentSession())).toBe(true);
  });

  it("seeds a focused working source while retaining the full immutable baseline", () => {
    const firstPicture =
      "\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\end{tikzpicture}";
    const secondPicture =
      "\\begin{tikzpicture}\n\\tkzDefPoint(2,2){B}\n\\end{tikzpicture}";
    const fullSource = [
      "\\documentclass{article}",
      "\\begin{document}",
      firstPicture,
      secondPicture,
      "\\end{document}",
    ].join("\n");
    const focusedDocument: StoicheiaHostDocument = {
      ...firstDocument,
      source: fullSource,
      workingSource: secondPicture,
      target: { kind: "tikzpicture", ordinal: 1 },
    };

    const session = bindHostDocumentSession(focusedDocument);
    const payload = createHostDocumentApplyPayload(
      secondPicture.replace("(2,2)", "(3,3)"),
    );

    expect(useEditorStore.getState().source).toBe(secondPicture);
    expect(session).toMatchObject({
      baselineSource: fullSource,
      sourceRevision: fingerprintDocumentSource(fullSource),
      target: { kind: "tikzpicture", ordinal: 1 },
    });
    expect(payload).toMatchObject({
      baselineSource: fullSource,
      nextSource: secondPicture.replace("(2,2)", "(3,3)"),
      target: { kind: "tikzpicture", ordinal: 1 },
    });
    expect(Object.isFrozen(session?.target)).toBe(true);
    expect(Object.isFrozen(payload?.target)).toBe(true);
  });

  it("treats a target switch as a new isolated document session", () => {
    bindHostDocumentSession({
      ...firstDocument,
      workingSource: "first focused figure",
      target: { kind: "tikzpicture", ordinal: 0 },
    });
    useEditorStore.setState({
      source: "unapplied first-figure draft",
      selectedPoints: ["A"],
    });

    bindHostDocumentSession({
      ...firstDocument,
      workingSource: "second focused figure",
      target: { kind: "tikzpicture", ordinal: 1 },
    });

    expect(useEditorStore.getState()).toMatchObject({
      source: "second focused figure",
      selectedPoints: [],
      sourceHistory: [],
    });
    expect(getHostDocumentSession()?.target).toEqual({
      kind: "tikzpicture",
      ordinal: 1,
    });
  });

  it("keeps a new-drawing scratch separate from its frozen destination lifecycle", () => {
    const scratchSource =
      "\\documentclass{standalone}\n\\begin{document}\n\\begin{tikzpicture}\n\\end{tikzpicture}\n\\end{document}";
    const newDrawingDocument: StoicheiaHostDocument = {
      ...firstDocument,
      workingSource: scratchSource,
      target: { kind: "newDrawing" },
    };
    const editedScratch = scratchSource.replace(
      "\\end{tikzpicture}",
      "\\draw (0,0) -- (1,1);\n\\end{tikzpicture}",
    );
    const session = bindHostDocumentSession(newDrawingDocument);

    const payload = createHostDocumentApplyPayload(editedScratch);

    expect(useEditorStore.getState().source).toBe(scratchSource);
    expect(session).toEqual({
      sessionId: firstDocument.sessionId,
      documentId: firstDocument.id,
      filePath: firstDocument.path,
      baselineSource: firstDocument.source,
      sourceRevision: fingerprintDocumentSource(firstDocument.source),
      target: { kind: "newDrawing" },
    });
    expect(payload).toEqual({
      sessionId: firstDocument.sessionId,
      documentId: firstDocument.id,
      filePath: firstDocument.path,
      baselineSource: firstDocument.source,
      sourceRevision: fingerprintDocumentSource(firstDocument.source),
      nextSource: editedScratch,
      target: { kind: "newDrawing" },
    });
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session?.target)).toBe(true);
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload?.target)).toBe(true);
    expect(validateHostDocumentApply(payload!)).toBe(true);
    expect(
      validateHostDocumentApply({
        ...payload!,
        target: { kind: "fullDocument" },
      }),
    ).toBe(false);

    const appliedDestination = firstDocument.source.replace(
      "First",
      "\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}",
    );
    expect(commitHostDocumentApply(payload!, appliedDestination)).toBe(true);
    expect(getHostDocumentSession()).toMatchObject({
      baselineSource: appliedDestination,
      sourceRevision: fingerprintDocumentSource(appliedDestination),
      target: { kind: "newDrawing" },
    });
    expect(validateHostDocumentApply(payload!)).toBe(false);
  });

  it("uses a distinct target identity and resets when leaving a new drawing", () => {
    const scratchSource =
      "\\documentclass{standalone}\n\\begin{document}\n\\begin{tikzpicture}\n\\end{tikzpicture}\n\\end{document}";
    const newDrawingDocument: StoicheiaHostDocument = {
      ...firstDocument,
      workingSource: scratchSource,
      target: { kind: "newDrawing" },
    };
    const fullDocument: StoicheiaHostDocument = {
      ...firstDocument,
      target: { kind: "fullDocument" },
    };

    expect(hostDocumentIdentity(newDrawingDocument)).not.toBe(
      hostDocumentIdentity(fullDocument),
    );

    bindHostDocumentSession(newDrawingDocument);
    useEditorStore.setState({
      source: scratchSource.replace(
        "\\end{tikzpicture}",
        "\\draw (0,0) circle (1);\n\\end{tikzpicture}",
      ),
      sourceHistory: [scratchSource],
      selectedPoints: ["A"],
      errorLog: "scratch compile error",
    });

    bindHostDocumentSession(fullDocument);

    expect(useEditorStore.getState()).toMatchObject({
      source: firstDocument.source,
      sourceHistory: [],
      selectedPoints: [],
      errorLog: null,
    });
    expect(getHostDocumentSession()).toMatchObject({
      baselineSource: firstDocument.source,
      target: { kind: "fullDocument" },
    });
  });

  it("cannot create an Apply payload without an active host document", () => {
    bindHostDocumentSession(null);

    expect(createHostDocumentApplyPayload("unowned source")).toBeNull();
  });

  it("validates an Apply request without advancing or replacing its session", () => {
    const originalSession = bindHostDocumentSession(firstDocument);
    const payload = createHostDocumentApplyPayload(
      `${firstDocument.source}\n% pending`,
    );
    expect(payload).not.toBeNull();

    expect(validateHostDocumentApply(payload!)).toBe(true);
    expect(validateHostDocumentApply(payload!)).toBe(true);
    expect(getHostDocumentSession()).toBe(originalSession);
    expect(getHostDocumentSession()).toMatchObject({
      baselineSource: firstDocument.source,
      sourceRevision: fingerprintDocumentSource(firstDocument.source),
      target: { kind: "fullDocument" },
    });

    expect(
      validateHostDocumentApply({
        ...payload!,
        target: { kind: "tikzpicture", ordinal: 0 },
      }),
    ).toBe(false);
    expect(getHostDocumentSession()).toBe(originalSession);
  });

  it("invalidates a frozen Apply lifecycle when the local draft changes", () => {
    bindHostDocumentSession(firstDocument);
    const reviewedSource = `${firstDocument.source}\n% reviewed draft`;
    useEditorStore.setState({ source: reviewedSource });
    const payload = createHostDocumentApplyPayload(reviewedSource);
    expect(payload).not.toBeNull();

    const lifecycle = createHostDocumentApplyLifecycle(payload!);
    expect(Object.isFrozen(lifecycle)).toBe(true);
    expect(lifecycle.validate()).toBe(true);

    useEditorStore.setState({
      source: `${reviewedSource}\n% newer local edit`,
    });

    expect(lifecycle.validate()).toBe(false);
    expect(lifecycle.commit(reviewedSource)).toBe(false);
    expect(getHostDocumentSession()?.baselineSource).toBe(
      firstDocument.source,
    );
  });

  it("commits only the current Apply request and advances its baseline", () => {
    bindHostDocumentSession(firstDocument);
    const nextSource = `${firstDocument.source}\n% applied`;
    const payload = createHostDocumentApplyPayload(nextSource);
    expect(payload).not.toBeNull();

    expect(
      commitHostDocumentApply({
        ...payload!,
        sourceRevision: "fnv1a32:0:00000000",
      }),
    ).toBe(false);
    expect(getHostDocumentSession()?.baselineSource).toBe(
      firstDocument.source,
    );

    expect(commitHostDocumentApply(payload!)).toBe(true);
    expect(getHostDocumentSession()).toMatchObject({
      baselineSource: nextSource,
      sourceRevision: fingerprintDocumentSource(nextSource),
    });
    expect(commitHostDocumentApply(payload!)).toBe(false);
  });

  it("commits a target-local Apply with the actual full source returned by the host", () => {
    const originalPicture =
      "\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\end{tikzpicture}";
    const editedPicture =
      "\\begin{tikzpicture}\n\\tkzDefPoint(4,5){A}\n\\end{tikzpicture}";
    const fullSource = [
      "\\documentclass{article}",
      "\\begin{document}",
      originalPicture,
      "\\end{document}",
    ].join("\n");
    const appliedFullSource = fullSource.replace(
      originalPicture,
      editedPicture,
    );
    bindHostDocumentSession({
      ...firstDocument,
      source: fullSource,
      workingSource: originalPicture,
      target: { kind: "tikzpicture", ordinal: 0 },
    });
    const payload = createHostDocumentApplyPayload(editedPicture);
    expect(payload).not.toBeNull();

    expect(validateHostDocumentApply(payload!)).toBe(true);
    expect(getHostDocumentSession()?.baselineSource).toBe(fullSource);
    expect(commitHostDocumentApply(payload!, appliedFullSource)).toBe(true);
    expect(getHostDocumentSession()).toMatchObject({
      baselineSource: appliedFullSource,
      sourceRevision: fingerprintDocumentSource(appliedFullSource),
      target: { kind: "tikzpicture", ordinal: 0 },
    });
    expect(validateHostDocumentApply(payload!)).toBe(false);
  });

  it("revalidates a committed request without allowing a newer local draft to be retargeted", () => {
    bindHostDocumentSession(firstDocument);
    const nextSource = `${firstDocument.source}\n% reviewed`;
    useEditorStore.setState({ source: nextSource });
    const payload = createHostDocumentApplyPayload(nextSource);
    expect(payload).not.toBeNull();
    const lifecycle = createHostDocumentApplyLifecycle(payload!);

    expect(lifecycle.validate()).toBe(true);
    expect(lifecycle.validateCommitted(nextSource)).toBe(false);
    expect(lifecycle.commit(nextSource)).toBe(true);
    expect(lifecycle.validate()).toBe(false);
    expect(lifecycle.validateCommitted(nextSource)).toBe(true);
    expect(lifecycle.validateCommitted(`${nextSource}\n% wrong`)).toBe(false);

    bindHostDocumentSession({
      ...firstDocument,
      sessionId: "workspace-after-apply",
      source: nextSource,
      workingSource: "regenerated focused source",
      target: { kind: "tikzpicture", ordinal: 0 },
    });
    expect(lifecycle.validateCommitted(nextSource)).toBe(true);

    useEditorStore.setState({ source: `${nextSource}\n% newer local draft` });
    expect(lifecycle.validateCommitted(nextSource)).toBe(false);
  });

  it("creates a frozen, sanitized SVG export payload from the exact fresh render", () => {
    const rawSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)">
        <defs><path id="safe-glyph" d="M0 0L1 1" /></defs>
        <script>alert(1)</script>
        <image href="https://example.test/external.png" />
        <use href="#safe-glyph" />
      </svg>
    `;
    bindHostDocumentSession(firstDocument);
    useEditorStore.setState({
      source: firstDocument.source,
      compiledSource: firstDocument.source,
      svgOutput: rawSvg,
      isCompiling: false,
    });

    const payload = createHostSvgExportPayload(rawSvg, "first-figure.svg");

    expect(payload).toMatchObject({
      sessionId: firstDocument.sessionId,
      documentId: firstDocument.id,
      filePath: firstDocument.path,
      sourceRevision: fingerprintDocumentSource(firstDocument.source),
      source: firstDocument.source,
      svgRevision: fingerprintDocumentSource(rawSvg),
      suggestedFileName: "first-figure.svg",
      target: { kind: "fullDocument" },
    });
    expect(payload?.svgSource).toContain("<svg");
    expect(payload?.svgSource).toContain('href="#safe-glyph"');
    expect(payload?.svgSource).toMatch(/\n$/);
    expect(payload?.svgSource).not.toMatch(
      /<script|onload=|https:\/\/example\.test/i,
    );
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload?.target)).toBe(true);

    const lifecycle = createHostSvgExportLifecycle(payload!);
    expect(Object.isFrozen(lifecycle)).toBe(true);
    expect(lifecycle.validate()).toBe(true);
  });

  it("invalidates an SVG export lifecycle when any exact-render input changes", () => {
    const rawSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1" /></svg>';
    bindHostDocumentSession(firstDocument);
    useEditorStore.setState({
      source: firstDocument.source,
      compiledSource: firstDocument.source,
      svgOutput: rawSvg,
      isCompiling: false,
    });
    expect(
      createHostSvgExportPayload(`${rawSvg}\n<!-- stale argument -->`, "stale.svg"),
    ).toBeNull();

    const payload = createHostSvgExportPayload(rawSvg, "first.svg");
    expect(payload).not.toBeNull();
    const lifecycle = createHostSvgExportLifecycle(payload!);
    expect(lifecycle.validate()).toBe(true);

    useEditorStore.setState({ source: `${firstDocument.source}\n% draft` });
    expect(lifecycle.validate()).toBe(false);
    useEditorStore.setState({ source: firstDocument.source });
    expect(lifecycle.validate()).toBe(true);

    useEditorStore.setState({ compiledSource: "older source" });
    expect(lifecycle.validate()).toBe(false);
    useEditorStore.setState({ compiledSource: firstDocument.source });
    expect(lifecycle.validate()).toBe(true);

    useEditorStore.setState({
      svgOutput:
        '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1" /></svg>',
    });
    expect(lifecycle.validate()).toBe(false);
    useEditorStore.setState({ svgOutput: rawSvg });
    expect(lifecycle.validate()).toBe(true);

    useEditorStore.setState({ isCompiling: true });
    expect(lifecycle.validate()).toBe(false);
    useEditorStore.setState({ isCompiling: false });
    expect(lifecycle.validate()).toBe(true);

    bindHostDocumentSession({
      ...firstDocument,
      sessionId: "workspace-2",
    });
    expect(lifecycle.validate()).toBe(false);
  });
});
