import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_SETTINGS, useEditorStore } from "../store";
import {
  fingerprintDocumentSource,
  getHostDocumentSession,
  resetHostDocumentBridgeForTests,
  type StoicheiaHostDocument,
} from "./documentBridge";
import { getScopedPortalTarget } from "./scopedPortal";
import { StoicheiaPackageStudioAdapter } from "./StoicheiaPackageStudioAdapter";

vi.mock("../App", () => ({
  default: ({
    mode,
    theme,
    language,
    onRequestApply,
    onRequestSave,
    onRequestSaveAs,
    onRequestExportSvg,
  }: {
    mode: string;
    theme: string;
    language: string;
    onRequestApply?: (source: string) => void;
    onRequestSave?: (source: string) => void;
    onRequestSaveAs?: (source: string) => void;
    onRequestExportSvg?: (svgSource: string, suggestedFileName: string) => void;
  }) => (
    <>
      <div
        data-testid="embedded-app"
        data-mode={mode}
        data-theme={theme}
        lang={language}
      />
      <button
        type="button"
        data-testid="embedded-apply"
        disabled={!onRequestApply}
        onClick={() => {
          useEditorStore.setState({ source: "next source" });
          onRequestApply?.("next source");
        }}
      >
        Apply
      </button>
      <button
        type="button"
        data-testid="embedded-save"
        disabled={!onRequestSave}
        onClick={() => {
          useEditorStore.setState({ source: "next source" });
          onRequestSave?.("next source");
        }}
      >
        Save
      </button>
      <button
        type="button"
        data-testid="embedded-save-as"
        disabled={!onRequestSaveAs}
        onClick={() => {
          useEditorStore.setState({ source: "save as source" });
          onRequestSaveAs?.("save as source");
        }}
      >
        Save As
      </button>
      <button
        type="button"
        data-testid="embedded-export-svg"
        disabled={!onRequestExportSvg}
        onClick={() => {
          const state = useEditorStore.getState();
          onRequestExportSvg?.(
            state.svgOutput ?? "",
            "embedded-drawing.svg",
          );
        }}
      >
        Export SVG
      </button>
    </>
  ),
}));

const baseProps = {
  theme: "dark" as const,
  language: "en" as const,
  latexCompiler: "lualatex" as const,
  latexEnginePaths: {
    lualatex: "lualatex",
    pdflatex: "pdflatex",
    xelatex: "xelatex",
  },
  onBack: vi.fn(),
  onRequestSave: vi.fn(),
};

describe("Stoicheia Package Studio adapter", () => {
  beforeEach(() => {
    resetHostDocumentBridgeForTests();
    baseProps.onRequestSave.mockClear();
    useEditorStore.setState({
      settings: { ...DEFAULT_APP_SETTINGS },
      source: "stale source",
      sourceHistory: ["stale history"],
      parsedNodes: [],
      selectedPoints: [],
    });
  });

  it("owns a themed scoped portal for exactly the mounted lifetime", () => {
    const view = render(<StoicheiaPackageStudioAdapter {...baseProps} />);
    const embeddedRoot = view.container.querySelector<HTMLElement>(
      ".stoicheia-embed-root",
    );
    const portal = document.querySelector<HTMLElement>(
      ".stoicheia-portal-root",
    );

    expect(embeddedRoot).not.toBeNull();
    expect(embeddedRoot).toHaveClass("stoicheia-scope");
    expect(embeddedRoot).toHaveStyle({
      display: "flex",
      width: "100%",
      height: "100%",
      minWidth: "0",
      minHeight: "0",
      overflow: "hidden",
    });
    expect(screen.getByTestId("embedded-app")).toHaveAttribute(
      "data-mode",
      "embedded",
    );
    expect(portal).not.toBeNull();
    expect(portal).toHaveAttribute("data-theme", "dark");
    expect(portal).toHaveAttribute("lang", "en");
    expect(getComputedStyle(portal!).position).toBe("fixed");
    expect(getComputedStyle(portal!).zIndex).toBe("2000");
    expect(getComputedStyle(portal!).pointerEvents).toBe("none");
    expect(portal!.style.background).toBe("transparent");
    expect(getComputedStyle(portal!).backgroundColor).toBe(
      "rgba(0, 0, 0, 0)",
    );
    expect(getScopedPortalTarget()).toBe(portal);

    view.rerender(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        theme="light"
        language="ar"
      />,
    );
    expect(embeddedRoot).toHaveAttribute("data-theme", "light");
    expect(embeddedRoot).toHaveAttribute("lang", "ar");
    expect(embeddedRoot).toHaveAttribute("dir", "rtl");
    expect(portal).toHaveAttribute("data-theme", "light");
    expect(portal).toHaveAttribute("lang", "ar");
    expect(portal).toHaveAttribute("dir", "rtl");

    view.unmount();
    expect(document.querySelector(".stoicheia-portal-root")).toBeNull();
    expect(getScopedPortalTarget()).toBe(document.body);
  });

  it("hydrates the active document and isolates state when the file changes", () => {
    const firstDocument: StoicheiaHostDocument = {
      sessionId: "workspace-1",
      id: "/project/first.tex",
      path: "/project/first.tex",
      source: "\\begin{document}\nFirst\n\\end{document}",
    };
    let view = render(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        hostDocument={firstDocument}
      />,
    );

    expect(screen.getByTestId("embedded-app")).toBeInTheDocument();
    expect(useEditorStore.getState()).toMatchObject({
      documentFilename: "first.tex",
      source: firstDocument.source,
      sourceHistory: [],
    });

    useEditorStore.setState({
      source: `${firstDocument.source}\n% local draft`,
      sourceHistory: [firstDocument.source],
      selectedPoints: ["A"],
    });
    view.rerender(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        hostDocument={{
          ...firstDocument,
          source: `${firstDocument.source}\n% newer host snapshot`,
        }}
      />,
    );
    expect(useEditorStore.getState().source).toContain("% local draft");

    view.unmount();
    view = render(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        hostDocument={firstDocument}
      />,
    );
    expect(useEditorStore.getState().source).toContain("% local draft");

    const secondDocument: StoicheiaHostDocument = {
      sessionId: "workspace-1",
      id: "/project/second.tex",
      path: "/project/second.tex",
      source: "\\begin{document}\nSecond\n\\end{document}",
    };
    view.rerender(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        hostDocument={secondDocument}
      />,
    );

    expect(screen.getByTestId("embedded-app")).toBeInTheDocument();
    expect(useEditorStore.getState()).toMatchObject({
      documentFilename: "second.tex",
      source: secondDocument.source,
      sourceHistory: [],
      selectedPoints: [],
    });
  });

  it("delivers a frozen document-scoped Apply payload to the host", () => {
    const onRequestApply = vi.fn();
    const workingSource =
      "\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\end{tikzpicture}";
    const hostDocument: StoicheiaHostDocument = {
      sessionId: "workspace-apply",
      id: "/project/apply.tex",
      path: "/project/apply.tex",
      source: `before\n${workingSource}\nafter`,
      workingSource,
      target: { kind: "tikzpicture", ordinal: 0 },
    };
    render(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        hostDocument={hostDocument}
        onRequestApply={onRequestApply}
      />,
    );

    fireEvent.click(screen.getByTestId("embedded-apply"));

    expect(onRequestApply).toHaveBeenCalledOnce();
    const payload = onRequestApply.mock.calls[0][0];
    const lifecycle = onRequestApply.mock.calls[0][1];
    expect(payload).toEqual({
      sessionId: hostDocument.sessionId,
      documentId: hostDocument.id,
      filePath: hostDocument.path,
      baselineSource: hostDocument.source,
      sourceRevision: expect.stringMatching(/^fnv1a32:/),
      nextSource: "next source",
      target: { kind: "tikzpicture", ordinal: 0 },
    });
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.target)).toBe(true);
    expect(lifecycle).toEqual({
      validate: expect.any(Function),
      commit: expect.any(Function),
      validateCommitted: expect.any(Function),
    });
    expect(Object.isFrozen(lifecycle)).toBe(true);

    const sessionBeforeValidation = getHostDocumentSession();
    expect(lifecycle.validate()).toBe(true);
    expect(lifecycle.validate()).toBe(true);
    expect(getHostDocumentSession()).toBe(sessionBeforeValidation);

    const appliedFullSource = `before\nnext source\nafter`;
    expect(lifecycle.commit(appliedFullSource)).toBe(true);
    expect(getHostDocumentSession()).toMatchObject({
      baselineSource: appliedFullSource,
      sourceRevision: fingerprintDocumentSource(appliedFullSource),
      target: { kind: "tikzpicture", ordinal: 0 },
    });
    expect(lifecycle.validate()).toBe(false);
    expect(lifecycle.commit(appliedFullSource)).toBe(false);
  });

  it("enables Apply for a destination-backed new-drawing scratch session", () => {
    const onRequestApply = vi.fn();
    const destinationSource =
      "\\documentclass{article}\n\\begin{document}\nDestination\n\\end{document}";
    const scratchSource =
      "\\documentclass{standalone}\n\\usepackage{tikz}\n\\begin{document}\n\\begin{tikzpicture}\n\\end{tikzpicture}\n\\end{document}";
    const hostDocument: StoicheiaHostDocument = {
      sessionId: "workspace-new-drawing",
      id: "/project/destination.tex",
      path: "/project/destination.tex",
      source: destinationSource,
      workingSource: scratchSource,
      target: { kind: "newDrawing" },
    };

    render(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        hostDocument={hostDocument}
        onRequestApply={onRequestApply}
      />,
    );

    const applyButton = screen.getByTestId("embedded-apply");
    expect(applyButton).toBeEnabled();
    expect(useEditorStore.getState().source).toBe(scratchSource);
    expect(getHostDocumentSession()).toMatchObject({
      baselineSource: destinationSource,
      sourceRevision: fingerprintDocumentSource(destinationSource),
      target: { kind: "newDrawing" },
    });

    fireEvent.click(applyButton);

    expect(onRequestApply).toHaveBeenCalledOnce();
    const payload = onRequestApply.mock.calls[0][0];
    const lifecycle = onRequestApply.mock.calls[0][1];
    expect(payload).toEqual({
      sessionId: hostDocument.sessionId,
      documentId: hostDocument.id,
      filePath: hostDocument.path,
      baselineSource: destinationSource,
      sourceRevision: fingerprintDocumentSource(destinationSource),
      nextSource: "next source",
      target: { kind: "newDrawing" },
    });
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.target)).toBe(true);
    expect(lifecycle.validate()).toBe(true);

    const appliedDestination = destinationSource.replace(
      "Destination",
      "\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}",
    );
    expect(lifecycle.commit(appliedDestination)).toBe(true);
    expect(getHostDocumentSession()).toMatchObject({
      baselineSource: appliedDestination,
      sourceRevision: fingerprintDocumentSource(appliedDestination),
      target: { kind: "newDrawing" },
    });
    expect(lifecycle.validate()).toBe(false);
  });

  it("delivers a frozen destination-backed Save lifecycle for a scratch drawing", () => {
    const onRequestSave = vi.fn();
    const destinationSource =
      "\\documentclass{article}\n\\begin{document}\nDestination\n\\end{document}";
    const scratchSource =
      "\\documentclass{standalone}\n\\usepackage{tikz}\n\\begin{document}\n\\begin{tikzpicture}\n\\end{tikzpicture}\n\\end{document}";
    const hostDocument: StoicheiaHostDocument = {
      sessionId: "workspace-save-drawing",
      id: "/project/destination.tex",
      path: "/project/destination.tex",
      source: destinationSource,
      workingSource: scratchSource,
      target: { kind: "newDrawing" },
    };

    render(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        hostDocument={hostDocument}
        onRequestSave={onRequestSave}
      />,
    );

    expect(screen.getByTestId("embedded-save")).toBeEnabled();
    expect(useEditorStore.getState().source).toBe(scratchSource);
    fireEvent.click(screen.getByTestId("embedded-save"));

    expect(onRequestSave).toHaveBeenCalledOnce();
    const payload = onRequestSave.mock.calls[0][0];
    const lifecycle = onRequestSave.mock.calls[0][1];
    expect(payload).toEqual({
      sessionId: hostDocument.sessionId,
      documentId: hostDocument.id,
      filePath: hostDocument.path,
      baselineSource: destinationSource,
      sourceRevision: fingerprintDocumentSource(destinationSource),
      nextSource: "next source",
      target: { kind: "newDrawing" },
    });
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.target)).toBe(true);
    expect(lifecycle).toEqual({
      validate: expect.any(Function),
      commit: expect.any(Function),
      validateCommitted: expect.any(Function),
    });
    expect(Object.isFrozen(lifecycle)).toBe(true);
    expect(lifecycle.validate()).toBe(true);

    const appliedDestination = destinationSource.replace(
      "Destination",
      "\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}",
    );
    expect(lifecycle.commit(appliedDestination)).toBe(true);
    expect(getHostDocumentSession()).toMatchObject({
      baselineSource: appliedDestination,
      sourceRevision: fingerprintDocumentSource(appliedDestination),
      target: { kind: "newDrawing" },
    });
    expect(lifecycle.validate()).toBe(false);
    expect(lifecycle.commit(appliedDestination)).toBe(false);
  });

  it("delivers Save As through the same frozen document lifecycle", () => {
    const onRequestSaveAs = vi.fn();
    const hostDocument: StoicheiaHostDocument = {
      sessionId: "workspace-save-as",
      id: "/project/save-as.tex",
      path: "/project/save-as.tex",
      source: "original source",
    };
    render(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        hostDocument={hostDocument}
        onRequestSaveAs={onRequestSaveAs}
      />,
    );

    fireEvent.click(screen.getByTestId("embedded-save-as"));

    expect(onRequestSaveAs).toHaveBeenCalledOnce();
    const payload = onRequestSaveAs.mock.calls[0][0];
    const lifecycle = onRequestSaveAs.mock.calls[0][1];
    expect(payload).toEqual({
      sessionId: hostDocument.sessionId,
      documentId: hostDocument.id,
      filePath: hostDocument.path,
      baselineSource: hostDocument.source,
      sourceRevision: fingerprintDocumentSource(hostDocument.source),
      nextSource: "save as source",
      target: { kind: "fullDocument" },
    });
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.target)).toBe(true);
    expect(Object.isFrozen(lifecycle)).toBe(true);
    expect(lifecycle.validate()).toBe(true);
  });

  it("registers a host Save As request that reads the latest editor source", () => {
    const onRequestSaveAs = vi.fn();
    const onRegisterHostSaveAsRequest = vi.fn();
    const hostDocument: StoicheiaHostDocument = {
      sessionId: "workspace-registered-save-as",
      id: "/project/registered-save-as.tex",
      path: "/project/registered-save-as.tex",
      source: "initial source",
    };
    const view = render(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        hostDocument={hostDocument}
        onRequestSaveAs={onRequestSaveAs}
        onRegisterHostSaveAsRequest={onRegisterHostSaveAsRequest}
      />,
    );
    const registeredRequest = onRegisterHostSaveAsRequest.mock.calls.find(
      ([request]) => typeof request === "function",
    )?.[0];
    expect(registeredRequest).toEqual(expect.any(Function));

    useEditorStore.setState({ source: "latest source from registered action" });
    registeredRequest();

    expect(onRequestSaveAs).toHaveBeenCalledOnce();
    expect(onRequestSaveAs.mock.calls[0][0]).toMatchObject({
      baselineSource: hostDocument.source,
      nextSource: "latest source from registered action",
    });
    expect(onRequestSaveAs.mock.calls[0][1].validate()).toBe(true);

    view.unmount();
    expect(onRegisterHostSaveAsRequest).toHaveBeenLastCalledWith(null);
  });

  it("exports only the exact fresh SVG render through a frozen lifecycle", () => {
    const onRequestExportSvg = vi.fn();
    const hostDocument: StoicheiaHostDocument = {
      sessionId: "workspace-svg-export",
      id: "/project/svg-export.tex",
      path: "/project/svg-export.tex",
      source: "exact source",
    };
    render(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        hostDocument={hostDocument}
        onRequestExportSvg={onRequestExportSvg}
      />,
    );
    const rawSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><path id="p" d="M0 0L1 1" /></svg>';

    useEditorStore.setState({
      svgOutput: rawSvg,
      compiledSource: "stale compiled source",
      isCompiling: false,
    });
    fireEvent.click(screen.getByTestId("embedded-export-svg"));
    expect(onRequestExportSvg).not.toHaveBeenCalled();

    useEditorStore.setState({
      svgOutput: rawSvg,
      compiledSource: hostDocument.source,
      isCompiling: false,
    });
    fireEvent.click(screen.getByTestId("embedded-export-svg"));

    expect(onRequestExportSvg).toHaveBeenCalledOnce();
    const payload = onRequestExportSvg.mock.calls[0][0];
    const lifecycle = onRequestExportSvg.mock.calls[0][1];
    expect(payload).toMatchObject({
      sessionId: hostDocument.sessionId,
      documentId: hostDocument.id,
      filePath: hostDocument.path,
      sourceRevision: fingerprintDocumentSource(hostDocument.source),
      source: hostDocument.source,
      svgRevision: fingerprintDocumentSource(rawSvg),
      suggestedFileName: "embedded-drawing.svg",
      target: { kind: "fullDocument" },
    });
    expect(payload.svgSource).toContain("<svg");
    expect(payload.svgSource).toMatch(/\n$/);
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.target)).toBe(true);
    expect(Object.isFrozen(lifecycle)).toBe(true);
    expect(lifecycle.validate()).toBe(true);

    useEditorStore.setState({ isCompiling: true });
    expect(lifecycle.validate()).toBe(false);
  });

  it("keeps all host document actions disabled without an active document", () => {
    const onRequestApply = vi.fn();
    const onRequestSave = vi.fn();
    const onRequestSaveAs = vi.fn();
    const onRequestExportSvg = vi.fn();
    const onRegisterHostSaveAsRequest = vi.fn();
    render(
      <StoicheiaPackageStudioAdapter
        {...baseProps}
        hostDocument={null}
        onRequestApply={onRequestApply}
        onRequestSave={onRequestSave}
        onRequestSaveAs={onRequestSaveAs}
        onRequestExportSvg={onRequestExportSvg}
        onRegisterHostSaveAsRequest={onRegisterHostSaveAsRequest}
      />,
    );

    const applyButton = screen.getByTestId("embedded-apply");
    const saveButton = screen.getByTestId("embedded-save");
    const saveAsButton = screen.getByTestId("embedded-save-as");
    const exportSvgButton = screen.getByTestId("embedded-export-svg");
    expect(applyButton).toBeDisabled();
    expect(saveButton).toBeDisabled();
    expect(saveAsButton).toBeDisabled();
    expect(exportSvgButton).toBeDisabled();
    fireEvent.click(applyButton);
    fireEvent.click(saveButton);
    fireEvent.click(saveAsButton);
    fireEvent.click(exportSvgButton);
    expect(onRequestApply).not.toHaveBeenCalled();
    expect(onRequestSave).not.toHaveBeenCalled();
    expect(onRequestSaveAs).not.toHaveBeenCalled();
    expect(onRequestExportSvg).not.toHaveBeenCalled();
    expect(onRegisterHostSaveAsRequest).toHaveBeenLastCalledWith(null);
  });
});
