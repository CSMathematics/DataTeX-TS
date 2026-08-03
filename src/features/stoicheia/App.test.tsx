import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DEFAULT_APP_SETTINGS, useEditorStore } from "./store";

const hookMocks = vi.hoisted(() => ({
  autosave: vi.fn(),
  codeEditor: vi.fn(() =>
    Promise.resolve({ default: () => null }),
  ),
  pipeline: vi.fn(),
}));

vi.mock("./hooks/useAutosaveDraft", () => ({
  useAutosaveDraft: hookMocks.autosave,
}));
vi.mock("./hooks/useDocumentPipeline", () => ({
  useDocumentPipeline: hookMocks.pipeline,
}));
vi.mock("./bridge/loadCodeEditor", () => ({
  loadStoicheiaCodeEditor: hookMocks.codeEditor,
}));
vi.mock("./components/AppHeader", () => ({
  AppHeader: () => <div data-testid="app-header" />,
}));
vi.mock("./components/Preview", () => ({
  Preview: () => <div data-testid="preview" />,
}));
vi.mock("./components/Toolbar", () => ({ Toolbar: () => null }));
vi.mock("./components/ObjectTree", () => ({ ObjectTree: () => null }));
vi.mock("./components/PropertiesPanel", () => ({ PropertiesPanel: () => null }));
vi.mock("./components/ConstructionHistory", () => ({ ConstructionHistory: () => null }));
vi.mock("./components/StyleManager", () => ({ StyleManager: () => null }));
vi.mock("./components/CanvasControls", () => ({ CanvasControls: () => null }));
vi.mock("./components/StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./components/Editor", () => ({ CodeEditor: () => null }));
vi.mock("./components/SettingsPage", () => ({
  SettingsPage: () => <div data-testid="settings-page" />,
}));
vi.mock("./components/CommandPalette", () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
}));

describe("Stoicheia embedded app shell", () => {
  beforeEach(() => {
    hookMocks.autosave.mockClear();
    hookMocks.pipeline.mockClear();
    document.documentElement.dataset.theme = "datatex-theme";
    document.documentElement.lang = "fr";
    document.body.style.cursor = "crosshair";
    document.body.style.userSelect = "text";
    useEditorStore.setState({
      theme: "dark",
      settings: {
        ...DEFAULT_APP_SETTINGS,
        theme: "dark",
        language: "fr",
        latexCompiler: "lualatex",
        latexEnginePaths: {
          lualatex: "previous-lualatex",
          pdflatex: "previous-pdflatex",
          xelatex: "previous-xelatex",
        },
      },
    });
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.lang = "";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  it("keeps host document state untouched and restores body resize styles", () => {
    const view = render(
      <div className="stoicheia-scope" data-theme="light">
        <App
          mode="embedded"
          theme="light"
          language="el"
          latexCompiler="xelatex"
          latexEnginePaths={{
            lualatex: "/host/lualatex",
            pdflatex: "/host/pdflatex",
            xelatex: "/host/xelatex",
          }}
          dvisvgmPath="/host/dvisvgm"
          onBack={vi.fn()}
          onRequestSave={vi.fn()}
        />
      </div>,
    );

    const root = view.container.querySelector(".app-shell");
    expect(root).not.toHaveClass("stoicheia-scope");
    expect(root).toHaveAttribute("data-theme", "light");
    expect(root).toHaveAttribute("lang", "el");
    expect(document.documentElement.dataset.theme).toBe("datatex-theme");
    expect(document.documentElement.lang).toBe("fr");
    expect(hookMocks.autosave).toHaveBeenCalledWith("autosave.tex", false);
    expect(hookMocks.pipeline).toHaveBeenCalledWith({
      latexCompiler: "xelatex",
      dvisvgmPath: "/host/dvisvgm",
      latexEnginePaths: {
        lualatex: "/host/lualatex",
        pdflatex: "/host/pdflatex",
        xelatex: "/host/xelatex",
      },
    });
    expect(useEditorStore.getState()).toMatchObject({
      theme: "light",
      settings: {
        theme: "light",
        language: "el",
        latexCompiler: "xelatex",
      },
    });

    const separators = screen.getAllByRole("separator");
    fireEvent.pointerDown(
      separators[0],
      { button: 0, clientX: 320 },
    );
    expect(document.body.style.cursor).toBe("col-resize");
    expect(document.body.style.userSelect).toBe("none");
    fireEvent.blur(window);
    expect(document.body.style.cursor).toBe("crosshair");
    expect(document.body.style.userSelect).toBe("text");

    fireEvent.pointerDown(
      separators[1],
      { button: 0, clientX: 640 },
    );
    expect(document.body.style.cursor).toBe("col-resize");
    fireEvent.blur(window);
    expect(document.body.style.cursor).toBe("crosshair");
    expect(document.body.style.userSelect).toBe("text");

    fireEvent.pointerDown(
      separators[0],
      { button: 0, clientX: 320 },
    );

    view.unmount();
    expect(document.body.style.cursor).toBe("crosshair");
    expect(document.body.style.userSelect).toBe("text");
    expect(document.documentElement.dataset.theme).toBe("datatex-theme");
    expect(document.documentElement.lang).toBe("fr");
    expect(useEditorStore.getState()).toMatchObject({
      theme: "dark",
      settings: {
        theme: "dark",
        language: "fr",
        latexCompiler: "lualatex",
        latexEnginePaths: {
          lualatex: "previous-lualatex",
          pdflatex: "previous-pdflatex",
          xelatex: "previous-xelatex",
        },
      },
    });
  });

  it("ignores app shortcuts outside the embedded interaction boundary", async () => {
    const view = render(
      <>
        <button type="button" data-testid="outside-target">
          Outside
        </button>
        <div className="stoicheia-scope" data-theme="light">
          <App
            mode="embedded"
            theme="light"
            language="el"
            latexCompiler="xelatex"
            latexEnginePaths={{
              lualatex: "/host/lualatex",
              pdflatex: "/host/pdflatex",
              xelatex: "/host/xelatex",
            }}
            onBack={vi.fn()}
          />
        </div>
      </>,
    );

    const outside = screen.getByTestId("outside-target");
    const appRoot = view.container.querySelector(".app-shell");
    expect(appRoot).not.toBeNull();

    fireEvent.keyDown(outside, { key: "k", ctrlKey: true });
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();

    fireEvent.keyDown(appRoot!, { key: "k", ctrlKey: true });
    expect(await screen.findByTestId("command-palette")).toBeInTheDocument();
    fireEvent.keyDown(appRoot!, { key: "k", ctrlKey: true });
    await waitFor(() => {
      expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
    });

    fireEvent.keyDown(outside, { key: ",", ctrlKey: true });
    expect(screen.queryByTestId("settings-page")).not.toBeInTheDocument();
    fireEvent.keyDown(appRoot!, { key: ",", ctrlKey: true });
    expect(await screen.findByTestId("settings-page")).toBeInTheDocument();
    view.unmount();
  });
});
