import {
  lazy,
  Suspense,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  AppShell,
  Box,
  Group,
  Stack,
  MantineProvider,
  Text,
  CSSVariablesResolver,
  Modal,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { invoke } from "@tauri-apps/api/core";
import { debounce, throttle } from "lodash";
import { ScrollArea, Code, Button } from "@mantine/core";
import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBook,
  faBookOpen,
  faChalkboardUser,
  faFile,
  faGraduationCap,
  faImage,
  faListCheck,
  faNewspaper,
  faPenToSquare,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

// --- Custom Theme ---
import { getTheme } from "./themes/ui-themes";

// --- Layout Components ---
import { HeaderContent } from "./components/layout/Header";
import {
  Sidebar,
  SidebarSection,
  ViewType,
  FileSystemNode,
} from "./components/layout/Sidebar";
import { EditorArea } from "./components/layout/EditorArea";
import { StatusBar } from "./components/layout/StatusBar";

// --- UI Components ---
import { ResizerHandle } from "./components/ui/ResizerHandle";

// --- Wizards ---
import { WizardWrapper } from "./components/wizards/WizardWrapper";
import { templates, getTemplateById } from "./services/templateService";
import type { DtexFile, DtexDatabaseInfo } from "./types/dtex";
import { useDtexAutoSave } from "./hooks/useDtexAutoSave";
import { DtexService } from "./services/dtexService";
import {
  applyPackageTextEdits,
  planApplyBuilderConfiguration,
  planMovePackage,
  planRemovePackage,
  stringIndexToUtf8ByteOffset,
  type BuilderConfigurationDraft,
  type PackageDiagnostic,
  type PackageEditPlan,
  type PackageStudioHostFileActionResult,
  type PackageStudioHostSaveAsPickRequest,
  type PackageStudioHostSaveAsPickResult,
  type PackageStudioHostSaveAsRequest,
  type PackageStudioHostSaveRequest,
  type PackageStudioHostSvgExportRequest,
  type PackageStudioEditReview,
  type PackageStudioSourceFocus,
} from "./services/packageStudioService";

import {
  applyLatexSyntaxThemeOverrides,
  configureLatexMonaco,
} from "./services/latexMonaco";
import { useSettings } from "./hooks/useSettings";

import { TexlabLspClient } from "./services/lspClient";
import {
  useTabsStore,
  useActiveTab,
  useIsTexFile,
} from "./stores/useTabsStore";

import { useProjectStore } from "./stores/projectStore";
import { useDatabaseStore } from "./stores/databaseStore";
import { useTypedMetadataStore } from "./stores/typedMetadataStore";
import { useAppPanelResize } from "./hooks/useAppPanelResize";
import { useProjectFiles } from "./hooks/useProjectFiles";
import { useCompilation } from "./hooks/useCompilation";
import { usePdfState } from "./hooks/usePdfState";
import { useCursorStore } from "./stores/cursorStore";
import { usePendingWriteListener } from "./hooks/usePendingWriteListener";
import { loadLocalMonaco } from "./services/monacoLoader";

const PreambleWizard = lazy(() =>
  import("./components/wizards/PreambleWizard").then((module) => ({
    default: module.PreambleWizard,
  })),
);
const UnifiedTableWizard = lazy(() =>
  import("./components/wizards/UnifiedTableWizard").then((module) => ({
    default: module.UnifiedTableWizard,
  })),
);
const TikzPgfPlotsWizard = lazy(() =>
  Promise.all([
    import("./components/wizards/TikzPgfPlotsWizard"),
    loadLocalMonaco(),
  ]).then(([module]) => ({
    default: module.TikzPgfPlotsWizard,
  })),
);
const FancyhdrWizard = lazy(() =>
  import("./components/wizards/FancyhdrWizard").then((module) => ({
    default: module.FancyhdrWizard,
  })),
);
const PstricksWizard = lazy(() =>
  import("./components/wizards/PstricksWizard").then((module) => ({
    default: module.PstricksWizard,
  })),
);
const MathWizard = lazy(() =>
  import("./components/wizards/MathWizard").then((module) => ({
    default: module.MathWizard,
  })),
);
const GraphicxWizard = lazy(() =>
  import("./components/wizards/GraphicxWizard").then((module) => ({
    default: module.GraphicxWizard,
  })),
);
const PackageGallery = lazy(() =>
  Promise.all([
    import("./components/wizards/PackageGallery"),
    loadLocalMonaco(),
  ]).then(([module]) => ({
    default: module.PackageGallery,
  })),
);
const SettingsPanel = lazy(() =>
  import("./components/settings/SettingsPanel").then((module) => ({
    default: module.SettingsPanel,
  })),
);
const DatabaseView = lazy(() =>
  import("./components/database/DatabaseView").then((module) => ({
    default: module.DatabaseView,
  })),
);
const BibliographyWorkspace = lazy(() =>
  import("./components/bibliography/BibliographyWorkspace").then((module) => ({
    default: module.BibliographyWorkspace,
  })),
);
const PackageStudioWorkspace = lazy(() =>
  import("./components/packages/PackageStudioWorkspace").then((module) => ({
    default: module.PackageStudioWorkspace,
  })),
);
const ResourceInspector = lazy(() =>
  import("./components/database/ResourceInspector").then((module) => ({
    default: module.ResourceInspector,
  })),
);
const PackageBrowser = lazy(() =>
  import("./components/tools/PackageBrowser").then((module) => ({
    default: module.PackageBrowser,
  })),
);
const AISidebar = lazy(() =>
  import("./components/ai/AISidebar").then((module) => ({
    default: module.AISidebar,
  })),
);
const UnsavedChangesModal = lazy(() =>
  import("./components/modals/UnsavedChangesModal").then((module) => ({
    default: module.UnsavedChangesModal,
  })),
);
const DtexImportModal = lazy(() => import("./components/modals/DtexImportModal"));
const BatchExportModal = lazy(() =>
  import("./components/modals/BatchExportModal").then((module) => ({
    default: module.BatchExportModal,
  })),
);

const templateIcons: Record<string, IconDefinition> = {
  "file-pen": faPenToSquare,
  "list-check": faListCheck,
  "book-open": faBookOpen,
  "person-chalkboard": faChalkboardUser,
  newspaper: faNewspaper,
  "graduation-cap": faGraduationCap,
  book: faBook,
  image: faImage,
};

const ViewLoadingFallback = () => (
  <Box h="100%" p="md">
    <Text size="sm" c="dimmed">
      Loading…
    </Text>
  </Box>
);

type PendingPackageStudioEditReview = PackageStudioEditReview & {
  tabId: string;
  noEditColor: "blue" | "yellow";
};

const viewKeepsEditorMounted = (view: ViewType) =>
  view !== "settings" &&
  view !== "bibliography-workspace" &&
  view !== "package-studio";

const WINDOWS_RESERVED_FILE_NAME =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

const normalizeSuggestedFileName = (
  value: string,
  fallback: string,
  extension: string,
) => {
  const baseName = value.split(/[/\\]/).pop()?.trim() || fallback;
  let safeName = baseName
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[:*?"<>|]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  if (!safeName || safeName === "." || safeName === "..") {
    safeName = fallback;
  }
  if (WINDOWS_RESERVED_FILE_NAME.test(safeName)) {
    safeName = `_${safeName}`;
  }
  const suffix = `.${extension.toLowerCase()}`;
  if (!safeName.toLowerCase().endsWith(suffix)) {
    safeName += suffix;
  }
  if (safeName.length > 120) {
    safeName = `${safeName.slice(0, Math.max(1, 120 - suffix.length))}${suffix}`;
  }
  return safeName;
};

const normalizeHostPath = async (filePath: string) => {
  const { normalize, sep } = await import("@tauri-apps/api/path");
  const normalizedPath = await normalize(filePath);
  return {
    path: normalizedPath,
    key: sep() === "\\" ? normalizedPath.toLowerCase() : normalizedPath,
  };
};

const suggestedPathBesideSource = async (
  sourceFilePath: string,
  suggestedFileName: string,
) => {
  try {
    const { dirname, join } = await import("@tauri-apps/api/path");
    return await join(await dirname(sourceFilePath), suggestedFileName);
  } catch {
    return suggestedFileName;
  }
};

// --- CSS Variables Resolver ---
const resolver: CSSVariablesResolver = (theme) => ({
  variables: {
    "--app-bg": theme.other?.appBg || "var(--mantine-color-body)",
    "--app-sidebar-bg":
      theme.other?.sidebarBg || "var(--mantine-color-default)",
    "--app-header-bg": theme.other?.headerBg || "var(--mantine-color-default)",
    "--app-status-bar-bg":
      theme.other?.statusBarBg || "var(--mantine-primary-color-filled)",
    "--app-panel-bg": theme.other?.panelBg || "var(--mantine-color-default)",
    "--app-accent-color":
      theme.other?.accentColor || "var(--mantine-primary-color-filled)",
    "--app-accent-color-dimmed":
      "color-mix(in srgb, var(--app-accent-color), transparent 90%)",
    "--app-border-color":
      theme.other?.borderColor || "var(--mantine-color-default-border)",
  },
  light: {},
  dark: {},
});

export default function App() {
  usePendingWriteListener();

  const {
    settings,
    updateEditorSetting,
    updateEditorBehaviorSetting,
    updatePdfViewerSetting,
    updateCompilationSetting,
    updateTexEngineSetting,
    updateDatabaseSetting,
    updateAccessibilitySetting,
    updateGeneralSetting,
    setUiTheme,
    updateCustomThemeOverride,
    addCustomTheme,
    removeCustomTheme,
    setLatexSyntaxColor,
    resetLatexSyntaxColor,
    setLatexSyntaxFontStyle,
    resetLatexSyntaxFontStyles,
    resetLatexSyntaxColorGroup,
    resetLatexSyntaxTheme,
    resetAllLatexSyntaxColors,
  } = useSettings();

  useEffect(() => {
    applyLatexSyntaxThemeOverrides(settings.latexSyntaxHighlighting.themes);
  }, [settings.latexSyntaxHighlighting.themes]);

  const activeTheme = getTheme(
    settings.uiTheme,
    settings.customThemes,
    settings.customThemeOverrides,
  );

  // Memoize settings to prevent unnecessary EditorArea re-renders.
  const editorSettingsMemo = useMemo(() => settings.editor, [settings.editor]);

  // --- Layout State ---
  const [activeActivity, setActiveActivity] =
    useState<SidebarSection>("database");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const latestEditorSourceRef = useRef<{
    documentId: string;
    source: string;
  } | null>(null);
  const fileSaveQueueRef = useRef(new Map<string, Promise<boolean>>());
  const editorRef = useRef<any>(null);
  const [activeView, setActiveView] = useState<ViewType>("editor");
  const activeViewRef = useRef<ViewType>(activeView);
  const editorSurfaceActiveRef = useRef(viewKeepsEditorMounted(activeView));
  activeViewRef.current = activeView;
  editorSurfaceActiveRef.current = viewKeepsEditorMounted(activeView);
  if (!editorSurfaceActiveRef.current) {
    latestEditorSourceRef.current = null;
    editorRef.current = null;
  }
  const [activePackageId, setActivePackageId] = useState<string>("amsmath");
  const [activePackageStudioBuilderId, setActivePackageStudioBuilderId] =
    useState<string | null>(null);
  const [pendingPackageStudioEditReview, setPendingPackageStudioEditReview] =
    useState<PendingPackageStudioEditReview | null>(null);
  const [packageStudioSourceFocus, setPackageStudioSourceFocus] =
    useState<PackageStudioSourceFocus | null>(null);
  const graphicsStudioSaveRequestRef = useRef<(() => void) | null>(null);
  const graphicsStudioSaveAsRequestRef = useRef<(() => void) | null>(null);
  const packageStudioSaveAsInFlightRef = useRef(false);
  const packageStudioSvgExportInFlightRef = useRef(false);

  // --- Resizing State (from custom hook) ---
  const {
    startResizeSidebar,
    startResizeRightPanel,
    startResizeDatabase,
    startResizeDatabaseHeight,
  } = useAppPanelResize();

  // --- Editor State (from Zustand) ---
  const tabs = useTabsStore((state) => state.tabs);
  const activeTabId = useTabsStore((state) => state.activeTabId);
  const setActiveTab = useTabsStore((state) => state.setActiveTab);
  const openTab = useTabsStore((state) => state.openTab);
  const closeTabStore = useTabsStore((state) => state.closeTab);
  const closeTabsById = useTabsStore((state) => state.closeTabsById);
  const markDirty = useTabsStore((state) => state.markDirty);
  const updateTabContent = useTabsStore((state) => state.updateTabContent);
  const renameTab = useTabsStore((state) => state.renameTab);
  const retargetEditorTab = useTabsStore(
    (state) => state.retargetEditorTab,
  );
  const [outlineSource, setOutlineSource] = useState<string>("");
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(false);

  // --- LSP State ---
  const lspClientRef = useRef<TexlabLspClient | null>(null);

  // --- Compilation State ---

  // --- Word Count State ---
  const [showWordCount, setShowWordCount] = useState(false);
  const [wordCountResult, setWordCountResult] = useState<string>("");

  // --- File System & DB State ---

  // --- Recent Projects State ---
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const addToRecent = useCallback((path: string) => {
    setRecentProjects((prev) => {
      const newRecent = [path, ...prev.filter((p) => p !== path)].slice(0, 10);
      localStorage.setItem("recentProjects", JSON.stringify(newRecent));
      return newRecent;
    });
  }, []);

  // --- Project Files Hook ---
  const {
    projectData,
    rootPath,

    setRootPath,
    reloadProjectFiles,
    handleOpenFolder,
    handleAddFolder,
    handleRemoveFolder,
    handleOpenRecent,
    handleCreateItem,
    handleRenameItem,
    handleDeleteItem,
    handleMoveItem,
  } = useProjectFiles({
    onSetCompileError: (err) => console.error("Project Error:", err),
    onSetActiveActivity: (act) => setActiveActivity(act as SidebarSection),
    onAddToRecent: addToRecent,
    openTab,
    renameTab,
    closeTab: closeTabStore,
  });

  // --- Database Panel State ---
  const [showDatabasePanel, setShowDatabasePanel] = useState(false);
  const [databasePanelPosition, setDatabasePanelPosition] = useState<
    "bottom" | "left"
  >("bottom");

  // --- Right Sidebar (ResourceInspector) State ---
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  // --- Database Logic: Auto-open table when collection checked ---
  const loadedCollections = useDatabaseStore(
    (state) => state.loadedCollections,
  );
  const prevLoadedCountRef = useRef(loadedCollections.length);

  useEffect(() => {
    // Auto-open panel when collection count increases (user checked one).
    if (loadedCollections.length > prevLoadedCountRef.current) {
      setShowDatabasePanel(true);
    }
    prevLoadedCountRef.current = loadedCollections.length;
  }, [loadedCollections]);

  // Auto-close resource inspector if no editor/table tabs are open.
  useEffect(() => {
    // Only keep right sidebar open if there are editor or table tabs
    // "start-page" and "settings" do not need the resource inspector
    const hasContentTabs = tabs.some(
      (t) => t.type === "editor" || t.type === "table",
    );

    if (!hasContentTabs) {
      setShowRightSidebar(false);
    }
  }, [tabs]);

  // --- Template Modal State ---
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  // --- Unsaved Changes Modal State ---
  const [unsavedChangesModalOpen, setUnsavedChangesModalOpen] = useState(false);
  const [tabToCloseId, setTabToCloseId] = useState<string | null>(null);

  // --- DTEX Import Modal State ---
  const [dtexImportModal, setDtexImportModal] = useState<{
    opened: boolean;
    dtexFile: DtexFile | null;
    filePath: string;
  }>({ opened: false, dtexFile: null, filePath: "" });

  // --- Batch Export State ---
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    success: number;
    failed: number;
    currentFile?: string;
  }>({ current: 0, total: 0, success: 0, failed: 0 });
  const [batchResults, setBatchResults] = useState<{
    success: number;
    failed: number;
    errors: { file: string; error: string }[];
  } | null>(null);

  // --- Auto-Save Hook ---
  useDtexAutoSave();

  // --- Derived State (UI) ---from Zustand selectors) ---
  const activeTab = useActiveTab();
  const isTexFile = useIsTexFile();

  const runQueuedFileSave = useCallback(
    async (
      filePath: string,
      operation: () => Promise<boolean>,
    ): Promise<boolean> => {
      const previousSave = fileSaveQueueRef.current.get(filePath);
      const queuedSave = (previousSave ?? Promise.resolve(true))
        .catch(() => false)
        .then(operation);

      fileSaveQueueRef.current.set(filePath, queuedSave);
      try {
        return await queuedSave;
      } finally {
        if (fileSaveQueueRef.current.get(filePath) === queuedSave) {
          fileSaveQueueRef.current.delete(filePath);
        }
      }
    },
    [],
  );

  const persistTabSource = useCallback(
    async (
      targetId: string,
      contentToSave: string,
      readCurrentSource: () => string | null,
    ): Promise<boolean> => {
      const tab = useTabsStore
        .getState()
        .tabs.find((candidate) => candidate.id === targetId);
      if (!tab || tab.type !== "editor") return false;

      return runQueuedFileSave(tab.id, async () => {
          try {
            if (tab.isDtexFile && tab.dtexData) {
              const { DtexService } = await import("./services/dtexService");
              await DtexService.saveContent(tab.id, contentToSave);
            } else {
              const { writeTextFile } = await import("@tauri-apps/plugin-fs");
              await writeTextFile(tab.id, contentToSave);
            }

            const currentSource = readCurrentSource();
            const targetStillExists = useTabsStore
              .getState()
              .tabs.some(
                (candidate) =>
                  candidate.id === targetId && candidate.type === "editor",
              );
            if (targetStillExists && currentSource === contentToSave) {
              updateTabContent(targetId, contentToSave);
              markDirty(targetId, false);
            } else if (targetStillExists) {
              if (currentSource !== null) {
                updateTabContent(targetId, currentSource);
              }
              markDirty(targetId, true);
            }

            invoke("save_history_snapshot_cmd", {
              filePath: tab.id,
              content: contentToSave,
              summary: null,
              isManual: false,
            }).catch((err) =>
              console.warn("Failed to save history snapshot:", err),
            );
            return targetStillExists;
          } catch (e) {
            console.error("Failed to save file:", e);
            notifications.show({
              title: "Save failed",
              message: String(e),
              color: "red",
            });
            return false;
          }
        });
    },
    [markDirty, runQueuedFileSave, updateTabContent],
  );

  // --- Helper: Save File ---
  const handleSave = useCallback(
    async (tabId?: string): Promise<boolean> => {
      const tabsState = useTabsStore.getState();
      const targetId = tabId || tabsState.activeTabId;
      const tab = tabsState.tabs.find((candidate) => candidate.id === targetId);
      if (!tab || tab.type !== "editor") return false;

      const editorSnapshot = latestEditorSourceRef.current;
      const mountedEditor =
        tab.id === tabsState.activeTabId &&
        editorSurfaceActiveRef.current &&
        editorSnapshot?.documentId === tab.id &&
        editorRef.current
          ? editorRef.current
          : null;
      const contentToSave =
        editorSnapshot?.documentId === tab.id
          ? editorSnapshot.source
          : tab.content ?? "";
      if (mountedEditor) {
        updateTabContent(targetId, contentToSave);
      }

      return persistTabSource(targetId, contentToSave, () => {
        const currentState = useTabsStore.getState();
        const currentTab = currentState.tabs.find(
          (candidate) => candidate.id === targetId,
        );
        if (!currentTab || currentTab.type !== "editor") return null;
        if (
          latestEditorSourceRef.current?.documentId === targetId &&
          currentState.activeTabId === targetId &&
          editorSurfaceActiveRef.current
        ) {
          return latestEditorSourceRef.current.source;
        }
        return currentTab.content ?? "";
      });
    },
    [persistTabSource, updateTabContent],
  );

  const handleSavePackageStudioDocument = useCallback(
    async (request: Readonly<PackageStudioHostSaveRequest>) => {
      const tabsState = useTabsStore.getState();
      const targetTab = tabsState.tabs.find(
        (tab) =>
          tab.type === "editor" &&
          tab.id === request.documentId &&
          tab.id === request.targetFilePath,
      );
      if (!targetTab || (targetTab.content ?? "") !== request.source) {
        notifications.show({
          title: "Graphics Studio",
          message:
            "The target document changed before Save. Review and apply the drawing again.",
          color: "yellow",
        });
        return false;
      }

      const saved = await persistTabSource(
        targetTab.id,
        request.source,
        () => {
          const currentState = useTabsStore.getState();
          const currentTab = currentState.tabs.find(
            (candidate) =>
              candidate.type === "editor" &&
              candidate.id === request.documentId,
          );
          const latestEditorSource = latestEditorSourceRef.current;
          if (
            currentTab &&
            currentState.activeTabId === request.documentId &&
            editorSurfaceActiveRef.current &&
            latestEditorSource?.documentId === request.documentId
          ) {
            return latestEditorSource.source;
          }
          return currentTab?.content ?? null;
        },
      );
      if (saved) {
        const currentTab = useTabsStore
          .getState()
          .tabs.find((candidate) => candidate.id === request.documentId);
        notifications.show({
          title: "Graphics Studio",
          message:
            (currentTab?.content ?? null) === request.source
              ? "The reviewed document was saved by DataTeX."
              : "The reviewed document was saved. Newer changes remain unsaved.",
          color: "green",
        });
      }
      return saved;
    },
    [persistTabSource],
  );

  const handleChoosePackageStudioSaveAsTarget = useCallback(
    async (
      request: Readonly<PackageStudioHostSaveAsPickRequest>,
    ): Promise<PackageStudioHostSaveAsPickResult> => {
      if (packageStudioSaveAsInFlightRef.current) {
        return {
          status: "failed",
          message: "A Save As dialog is already open.",
        };
      }

      const initialTab = useTabsStore.getState().tabs.find(
        (tab) =>
          tab.type === "editor" &&
          tab.id === request.documentId &&
          tab.id === request.sourceFilePath,
      );
      if (!initialTab || (initialTab.content ?? "") !== request.source) {
        return {
          status: "failed",
          message: "The source document changed before Save As.",
        };
      }
      if (initialTab.isDtexFile) {
        const message =
          "Save As supports plain LaTeX files. Use Export to TeX for a .dtex document.";
        notifications.show({
          title: "Graphics Studio",
          message,
          color: "yellow",
        });
        return { status: "failed", message };
      }

      packageStudioSaveAsInFlightRef.current = true;
      try {
        const sourceExtension = request.sourceFilePath
          .match(/\.(tex|sty|cls)$/i)?.[1]
          ?.toLowerCase() ?? "tex";
        const suggestedName = normalizeSuggestedFileName(
          request.suggestedFileName,
          `document.${sourceExtension}`,
          sourceExtension,
        );
        const defaultPath = await suggestedPathBesideSource(
          request.sourceFilePath,
          suggestedName,
        );
        const { save } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await save({
          title: "Save LaTeX document as",
          defaultPath,
          filters: [
            { name: "LaTeX Document", extensions: ["tex", "sty", "cls"] },
          ],
        });
        if (!selectedPath) return { status: "cancelled" };

        const selectedExtension = selectedPath
          .match(/\.([^.\\/]+)$/)?.[1]
          ?.toLowerCase();
        if (!selectedExtension || !["tex", "sty", "cls"].includes(selectedExtension)) {
          const message = "Choose a .tex, .sty, or .cls destination.";
          notifications.show({
            title: "Save As cancelled",
            message,
            color: "yellow",
          });
          return { status: "failed", message };
        }

        const currentTab = useTabsStore.getState().tabs.find(
          (tab) =>
            tab.type === "editor" &&
            tab.id === request.documentId &&
            tab.id === request.sourceFilePath,
        );
        if (!currentTab || (currentTab.content ?? "") !== request.source) {
          return {
            status: "failed",
            message: "The source document changed while Save As was open.",
          };
        }

        const normalizedTarget = await normalizeHostPath(selectedPath);
        const normalizedSource = await normalizeHostPath(
          request.sourceFilePath,
        );
        const otherTabPaths = await Promise.all(
          useTabsStore
            .getState()
            .tabs.filter(
              (tab) =>
                tab.type === "editor" &&
                tab.id !== request.sourceFilePath,
            )
            .map(async (tab) => (await normalizeHostPath(tab.id)).key),
        );
        if (
          normalizedTarget.key !== normalizedSource.key &&
          otherTabPaths.includes(normalizedTarget.key)
        ) {
          const message =
            "The selected destination is already open in DataTeX. Close that tab or choose another file.";
          notifications.show({
            title: "Save As blocked",
            message,
            color: "yellow",
          });
          return { status: "failed", message };
        }

        return {
          status: "selected",
          targetFilePath: normalizedTarget.path,
        };
      } catch (caught) {
        console.error("Failed to choose Save As destination:", caught);
        const message = String(caught);
        notifications.show({
          title: "Save As failed",
          message,
          color: "red",
        });
        return { status: "failed", message };
      } finally {
        packageStudioSaveAsInFlightRef.current = false;
      }
    },
    [],
  );

  const handleSaveAsPackageStudioDocument = useCallback(
    async (
      request: Readonly<PackageStudioHostSaveAsRequest>,
    ): Promise<PackageStudioHostFileActionResult> => {
      if (packageStudioSaveAsInFlightRef.current) {
        return {
          status: "failed",
          message: "Another Save As operation is still running.",
        };
      }
      packageStudioSaveAsInFlightRef.current = true;

      try {
        if (!request.validate()) {
          return {
            status: "failed",
            message: "The document changed before Save As.",
          };
        }
        const normalizedSource = await normalizeHostPath(
          request.sourceFilePath,
        );
        const normalizedTarget = await normalizeHostPath(
          request.targetFilePath,
        );
        const readExactSourceTab = () =>
          useTabsStore.getState().tabs.find(
            (tab) =>
              tab.type === "editor" &&
              tab.id === request.documentId &&
              tab.id === request.sourceFilePath &&
              !tab.isDtexFile &&
              (tab.content ?? "") === request.source,
          );
        if (!readExactSourceTab() || !request.validate()) {
          return {
            status: "failed",
            message: "The reviewed source document changed before Save As.",
          };
        }

        if (normalizedSource.key === normalizedTarget.key) {
          const saved = await persistTabSource(
            request.sourceFilePath,
            request.source,
            () => {
              const tab = readExactSourceTab();
              return tab?.content ?? null;
            },
          );
          return saved
            ? { status: "saved", filePath: request.sourceFilePath }
            : {
                status: "failed",
                message: "DataTeX could not save the reviewed document.",
              };
        }

        const written = await runQueuedFileSave(
          normalizedTarget.path,
          async () => {
            if (!readExactSourceTab() || !request.validate()) return false;
            const openPathKeys = await Promise.all(
              useTabsStore
                .getState()
                .tabs.filter(
                  (tab) =>
                    tab.type === "editor" &&
                    tab.id !== request.sourceFilePath,
                )
                .map(async (tab) => (await normalizeHostPath(tab.id)).key),
            );
            if (openPathKeys.includes(normalizedTarget.key)) return false;

            try {
              const { writeTextFile } = await import("@tauri-apps/plugin-fs");
              await writeTextFile(normalizedTarget.path, request.source);
              return true;
            } catch (caught) {
              console.error("Save As write failed:", caught);
              notifications.show({
                title: "Save As failed",
                message: String(caught),
                color: "red",
              });
              return false;
            }
          },
        );
        if (!written) {
          return {
            status: "failed",
            message:
              "The source or destination changed before Save As completed.",
          };
        }

        invoke("save_history_snapshot_cmd", {
          filePath: normalizedTarget.path,
          content: request.source,
          summary: "Saved As from DataTeX",
          isManual: false,
        }).catch((error) =>
          console.warn("Failed to save Save As history snapshot:", error),
        );

        if (!readExactSourceTab() || !request.validate()) {
          notifications.show({
            title: "Saved copy",
            message:
              "The file was written, but newer changes appeared during Save As. The original tab was left open and unchanged.",
            color: "yellow",
          });
          return {
            status: "savedDetached",
            filePath: normalizedTarget.path,
          };
        }

        const newTitle =
          normalizedTarget.path.split(/[/\\]/).pop() ?? normalizedTarget.path;
        const retargeted = retargetEditorTab(
          request.sourceFilePath,
          normalizedTarget.path,
          newTitle,
          request.source,
        );
        if (!retargeted) {
          notifications.show({
            title: "Saved copy",
            message:
              "The file was written, but the original tab changed during Save As and was not retargeted.",
            color: "yellow",
          });
          return {
            status: "savedDetached",
            filePath: normalizedTarget.path,
          };
        }

        notifications.show({
          title: "Saved As",
          message: `The reviewed document is now ${newTitle}.`,
          color: "green",
        });
        return { status: "saved", filePath: normalizedTarget.path };
      } catch (caught) {
        console.error("Save As failed:", caught);
        const message = String(caught);
        notifications.show({
          title: "Save As failed",
          message,
          color: "red",
        });
        return { status: "failed", message };
      } finally {
        packageStudioSaveAsInFlightRef.current = false;
      }
    },
    [persistTabSource, retargetEditorTab, runQueuedFileSave],
  );

  const handleExportPackageStudioSvg = useCallback(
    async (
      request: Readonly<PackageStudioHostSvgExportRequest>,
    ): Promise<PackageStudioHostFileActionResult> => {
      if (packageStudioSvgExportInFlightRef.current) {
        return {
          status: "failed",
          message: "An SVG export is already running.",
        };
      }
      const svgSource = request.svgSource;
      const sourceDocumentExists = () =>
        useTabsStore.getState().tabs.some(
          (tab) =>
            tab.type === "editor" &&
            tab.id === request.documentId &&
            tab.id === request.sourceFilePath,
        );
      if (
        !sourceDocumentExists() ||
        !request.validate() ||
        !svgSource.trim() ||
        new TextEncoder().encode(svgSource).byteLength > 25 * 1024 * 1024 ||
        svgSource.includes("\0") ||
        !/<svg(?:\s|>)/i.test(svgSource)
      ) {
        return {
          status: "failed",
          message: "The exact SVG export payload is invalid or too large.",
        };
      }

      packageStudioSvgExportInFlightRef.current = true;
      try {
        const suggestedName = normalizeSuggestedFileName(
          request.suggestedFileName,
          "drawing.svg",
          "svg",
        );
        const defaultPath = await suggestedPathBesideSource(
          request.sourceFilePath,
          suggestedName,
        );
        const { save } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await save({
          title: "Export exact SVG",
          defaultPath,
          filters: [{ name: "SVG image", extensions: ["svg"] }],
        });
        if (!selectedPath) return { status: "cancelled" };
        if (!sourceDocumentExists() || !request.validate()) {
          return {
            status: "failed",
            message:
              "The drawing or its compiled preview changed while the export dialog was open.",
          };
        }

        const normalizedTarget = await normalizeHostPath(selectedPath);
        const openPathKeys = await Promise.all(
          useTabsStore
            .getState()
            .tabs.filter((tab) => tab.type === "editor")
            .map(async (tab) => (await normalizeHostPath(tab.id)).key),
        );
        if (openPathKeys.includes(normalizedTarget.key)) {
          const message =
            "The SVG destination is already open in DataTeX. Close that tab or choose another file.";
          notifications.show({
            title: "SVG export blocked",
            message,
            color: "yellow",
          });
          return { status: "failed", message };
        }

        const written = await runQueuedFileSave(
          normalizedTarget.path,
          async () => {
            if (!sourceDocumentExists() || !request.validate()) return false;
            try {
              const { writeTextFile } = await import("@tauri-apps/plugin-fs");
              await writeTextFile(
                normalizedTarget.path,
                svgSource.endsWith("\n") ? svgSource : `${svgSource}\n`,
              );
              return true;
            } catch (caught) {
              console.error("SVG export failed:", caught);
              return false;
            }
          },
        );
        if (!written) {
          const message = "DataTeX could not write the SVG file.";
          notifications.show({
            title: "SVG export failed",
            message,
            color: "red",
          });
          return { status: "failed", message };
        }

        notifications.show({
          title: "SVG exported",
          message: normalizedTarget.path,
          color: "green",
        });
        return { status: "saved", filePath: normalizedTarget.path };
      } catch (caught) {
        console.error("SVG export failed:", caught);
        const message = String(caught);
        notifications.show({
          title: "SVG export failed",
          message,
          color: "red",
        });
        return { status: "failed", message };
      } finally {
        packageStudioSvgExportInFlightRef.current = false;
      }
    },
    [runQueuedFileSave],
  );

  const handleRegisterGraphicsStudioSaveRequest = useCallback(
    (requestSave: (() => void) | null) => {
      graphicsStudioSaveRequestRef.current = requestSave;
    },
    [],
  );

  const handleRegisterGraphicsStudioSaveAsRequest = useCallback(
    (requestSaveAs: (() => void) | null) => {
      graphicsStudioSaveAsRequestRef.current = requestSaveAs;
    },
    [],
  );

  const handleSaveFromActiveSurface = useCallback(() => {
    if (
      activeViewRef.current === "package-studio" &&
      activePackageStudioBuilderId === "graphics-studio"
    ) {
      const requestSave = graphicsStudioSaveRequestRef.current;
      if (requestSave) {
        requestSave();
      } else {
        notifications.show({
          title: "Graphics Studio",
          message:
            "Choose or create a drawing before saving from Graphics Studio.",
          color: "yellow",
        });
      }
      return;
    }
    void handleSave();
  }, [activePackageStudioBuilderId, handleSave]);

  const handleSaveAsFromActiveSurface = useCallback(() => {
    if (
      activeViewRef.current === "package-studio" &&
      activePackageStudioBuilderId === "graphics-studio"
    ) {
      const requestSaveAs = graphicsStudioSaveAsRequestRef.current;
      if (requestSaveAs) {
        requestSaveAs();
      } else {
        notifications.show({
          title: "Graphics Studio",
          message:
            "Choose or create a drawing before using Save As from Graphics Studio.",
          color: "yellow",
        });
      }
      return;
    }

    const tabsState = useTabsStore.getState();
    const targetTab = tabsState.tabs.find(
      (tab) => tab.type === "editor" && tab.id === tabsState.activeTabId,
    );
    if (!targetTab) return;
    const editorSnapshot = latestEditorSourceRef.current;
    const source =
      editorSurfaceActiveRef.current &&
      editorSnapshot?.documentId === targetTab.id
        ? editorSnapshot.source
        : targetTab.content ?? "";
    if ((targetTab.content ?? "") !== source) {
      updateTabContent(targetTab.id, source);
    }

    void (async () => {
      const picked = await handleChoosePackageStudioSaveAsTarget({
        documentId: targetTab.id,
        sourceFilePath: targetTab.id,
        source,
        suggestedFileName: targetTab.title,
      });
      if (picked.status !== "selected") return;
      await handleSaveAsPackageStudioDocument({
        documentId: targetTab.id,
        sourceFilePath: targetTab.id,
        targetFilePath: picked.targetFilePath,
        source,
        validate: () => {
          const currentState = useTabsStore.getState();
          const currentTab = currentState.tabs.find(
            (tab) => tab.type === "editor" && tab.id === targetTab.id,
          );
          if (!currentTab || (currentTab.content ?? "") !== source) return false;
          const latestSource = latestEditorSourceRef.current;
          return !(
            editorSurfaceActiveRef.current &&
            currentState.activeTabId === targetTab.id &&
            latestSource?.documentId === targetTab.id &&
            latestSource.source !== source
          );
        },
      });
    })();
  }, [
    activePackageStudioBuilderId,
    handleChoosePackageStudioSaveAsTarget,
    handleSaveAsPackageStudioDocument,
    updateTabContent,
  ]);

  // --- Compilation Hook ---
  const {
    isCompiling,
    logEntries,
    showLogPanel,
    pdfRefreshTrigger,
    handleCompile,
    handleStopCompile,
    handleCloseLogPanel,
  } = useCompilation({
    activeTab,
    isTexFile,
    onSave: handleSave,
    setCompileError: (msg) => console.error("Compile Error:", msg),
  });

  // --- PDF Hook ---
  const handleTogglePdf = useCallback(() => {
    setShowRightSidebar((prev) => !prev);
  }, []);

  const {
    pdfPath,
    pdfUrl,
    pdfLoading,
    syncTexCoords,
    handleSyncTexForward,
    handleSyncTexInverse,
  } = usePdfState({
      activeTab,
      isTexFile,
      pdfRefreshTrigger,
      setCompileError: (msg) => console.error("PDF Error:", msg),
      onRequirePanelOpen: () => setShowRightSidebar(true),
    });

  const onSyncTexInverse = useCallback(
    async (page: number, x: number, y: number) => {
      const result = await handleSyncTexInverse(page, x, y);
      if (result) {
        // Check if file is already open
        const { file, line } = result;

        // Normalize path separators to forward slash for comparison
        const normalizedPath = file.replace(/\\/g, "/");
        const tabsState = useTabsStore.getState();

        // Logic to open file if not the active one
        if (
          tabsState.activeTabId !== normalizedPath &&
          tabsState.activeTabId.replace(/\\/g, "/") !== normalizedPath
        ) {
          // Check if tab exists
          const existingTab = tabsState.tabs.find(
            (t) =>
              t.id === normalizedPath ||
              t.id.replace(/\\/g, "/") === normalizedPath,
          );

          if (existingTab) {
            tabsState.setActiveTab(existingTab.id);
          } else {
            // Open new tab
            try {
              const { readTextFile } = await import("@tauri-apps/plugin-fs");
              const content = await readTextFile(result.file); // Use original path from OS
              tabsState.openTab({
                id: result.file,
                title: result.file.split(/[/\\]/).pop() || "Untitled",
                type: "editor",
                content,
                language: "latex",
                isDirty: false,
              });
            } catch (e) {
              console.error("Failed to open file from SyncTeX:", e);
            }
          }
        }

        // Jump to line
        // We need a small delay to allow editor to mount/focus if we just switched tabs
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.revealLineInCenter(line);
            editorRef.current.setPosition({ lineNumber: line, column: 1 });
            editorRef.current.focus();
          }
        }, 100);
      }
    },
    [handleSyncTexInverse],
  );

  const isWizardActive = useMemo(
    () =>
      activeView.startsWith("wizard-") ||
      activeView === "gallery" ||
      activeView === "package-browser" ||
      activeView === "ai-assistant",
    [activeView],
  );
  const showRightPanel = useMemo(
    () =>
      (showRightSidebar || isWizardActive) &&
      (isWizardActive || activeView === "editor" || activeView === "database"),
    [showRightSidebar, isWizardActive, activeView],
  );

  // --- Sync projectData to projectStore for DatabaseSidebar ---
  const setProjectDataToStore = useProjectStore(
    (state) => state.setProjectData,
  );
  useEffect(() => {
    setProjectDataToStore(projectData);
  }, [projectData, setProjectDataToStore]);

  // --- Handlers ---
  // --- Load Recent Projects on Mount ---
  useEffect(() => {
    const saved = localStorage.getItem("recentProjects");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRecentProjects(parsed);
      } catch (e) {
        console.error("Failed to parse recent projects", e);
      }
    }
  }, []);

  // --- Initialize lookup data and LSP for the active workspace ---
  const collections = useDatabaseStore((state) => state.collections);
  const createResource = useDatabaseStore((state) => state.createResource);
  const fetchResourcesForLoadedCollections = useDatabaseStore(
    (state) => state.fetchResourcesForLoadedCollections,
  );
  const createCollection = useDatabaseStore((state) => state.createCollection);
  const activeCollection = useDatabaseStore((state) => state.activeCollection);
  const lookupRootRef = useRef(rootPath);

  useEffect(() => {
    const { clearAllLookupData, loadAllLookupData } =
      useTypedMetadataStore.getState();
    if (lookupRootRef.current !== rootPath) {
      clearAllLookupData();
      lookupRootRef.current = rootPath;
    }
    void loadAllLookupData(activeCollection || undefined).catch(console.error);
  }, [rootPath, activeCollection]);

  const workspaceRoot = useMemo(
    () => rootPath || collections.find((collection) => collection.path)?.path,
    [rootPath, collections],
  );

  useEffect(() => {
    const initLsp = async () => {
      if (workspaceRoot && !lspClientRef.current) {
        try {
          const client = new TexlabLspClient();
          await client.initialize(`file://${workspaceRoot}`);
          lspClientRef.current = client;
        } catch (error) {
          console.error("Failed to initialize LSP:", error);
        }
      }
    };
    void initLsp();

    return () => {
      if (lspClientRef.current) {
        void lspClientRef.current.shutdown();
        lspClientRef.current = null;
      }
    };
  }, [workspaceRoot]);

  const syncActiveEditorContent = useCallback(() => {
    if (
      !viewKeepsEditorMounted(activeView) ||
      !activeTabId ||
      !editorRef.current
    ) {
      return;
    }
    try {
      const editor = editorRef.current;
      const source = editor.getValue();
      latestEditorSourceRef.current = {
        documentId: activeTabId,
        source,
      };
      updateTabContent(activeTabId, source);

      const model = editor.getModel?.();
      const position = editor.getPosition?.();
      const selection = editor.getSelection?.();
      if (!model || !position) {
        setPackageStudioSourceFocus(null);
        return;
      }

      const toUtf8Byte = (editorPosition: unknown) => {
        const utf16Offset = model.getOffsetAt(editorPosition);
        return stringIndexToUtf8ByteOffset(source, utf16Offset);
      };
      const selectionStart =
        selection?.getStartPosition?.() ?? position;
      const selectionEnd = selection?.getEndPosition?.() ?? position;
      setPackageStudioSourceFocus({
        documentId: activeTabId,
        source,
        cursorByte: toUtf8Byte(position),
        selectionStartByte: toUtf8Byte(selectionStart),
        selectionEndByte: toUtf8Byte(selectionEnd),
      });
    } catch (e) {
      setPackageStudioSourceFocus(null);
    }
  }, [activeTabId, activeView, updateTabContent]);

  const handleToggleSidebar = useCallback(
    (section: SidebarSection) => {
      if (section === "settings") {
        setActiveActivity("settings");
        setActiveView("settings");
        setIsSidebarOpen(false);
      } else {
        if (section === "database") {
          setActiveView("database");
          setShowDatabasePanel(true);
        } else if (section === "bibliography") {
          setActiveView("bibliography-workspace");
        } else if (section === "packages") {
          syncActiveEditorContent();
          setActiveView("package-studio");
        } else {
          setActiveView((currentView) =>
            currentView === "settings" ||
            currentView === "database" ||
            currentView === "bibliography-workspace" ||
            currentView === "package-studio"
              ? "editor"
              : currentView,
          );
        }

        // Toggle sidebar if clicking same section; otherwise open new section.
        if (activeActivity === section) {
          setIsSidebarOpen((prev) => !prev);
        } else {
          setActiveActivity(section);
          setIsSidebarOpen(true);
        }
      }
    },
    [activeActivity, syncActiveEditorContent],
  );

  const handleNavigateView = useCallback(
    (view: ViewType) => {
      if (view === "package-studio") {
        syncActiveEditorContent();
      }

      setActiveView(view);

      if (view === "database") {
        setActiveActivity("database");
        setShowDatabasePanel(true);
        return;
      }

      if (view === "bibliography-workspace") {
        setActiveActivity("bibliography");
        setIsSidebarOpen(true);
        return;
      }

      if (view === "package-studio") {
        setActiveActivity("packages");
        setIsSidebarOpen(true);
      }
    },
    [syncActiveEditorContent],
  );

  const handleExitBibliographyWorkspace = useCallback(() => {
    handleNavigateView("database");
  }, [handleNavigateView]);

  // --- HELPER: Load Project Files ---
  // --- HELPER: Load Project Files (Moved to useProjectFiles) ---

  // --- CORE: Create Tab Logic ---
  const debouncedOutlineUpdate = useCallback(
    debounce((content: string) => {
      setOutlineSource(content);
    }, 1000),
    [],
  );

  const handleTabChange = useCallback(
    (newId: string) => {
      // Sync content from Monaco before switching
      const currentId = activeTabId;
      if (currentId && editorRef.current) {
        try {
          const currentContent = editorRef.current.getValue();
          latestEditorSourceRef.current = {
            documentId: currentId,
            source: currentContent,
          };
          updateTabContent(currentId, currentContent);
        } catch (e) {
          /* ignore */
        }
      }

      setActiveTab(newId);
      latestEditorSourceRef.current = null;

      // Update outline source for new tab
      const newTab = tabs.find((t) => t.id === newId);
      if (newTab && newTab.content) {
        setOutlineSource(newTab.content);
      }
    },
    [activeTabId, tabs, updateTabContent, setActiveTab],
  );

  const createTabWithContent = useCallback(
    async (code: string, defaultTitle: string = "Untitled.tex") => {
      try {
        let filePath: string | null = null;
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          filePath = await save({
            defaultPath: defaultTitle,
            filters: [{ name: "LaTeX Document", extensions: ["tex"] }],
          });
        } catch (e) {
          console.warn("Tauri dialog failed, using fallback:", e);
          filePath = "/mock/" + defaultTitle;
        }

        if (!filePath) return;

        try {
          const { writeTextFile } = await import("@tauri-apps/plugin-fs");
          await writeTextFile(filePath, code);
        } catch (e) {
          console.warn("Tauri write failed, continuing in memory:", e);
        }

        const normalizedPath = filePath.replace(/\\/g, "/");
        const lastSlashIndex = normalizedPath.lastIndexOf("/");
        const parentDir = normalizedPath.substring(0, lastSlashIndex);
        const fileName = normalizedPath.substring(lastSlashIndex + 1);

        if (parentDir && parentDir !== "/mock") {
          setRootPath(parentDir);
          try {
            // We use reloadProjectFiles directly here or wrap it if needed.
            // loadProjectFiles is async, so we just call it.
            reloadProjectFiles([parentDir]);
          } catch (e) {}
          setActiveActivity("database");
          setIsSidebarOpen(true);
          addToRecent(parentDir);
        }

        // Open the new tab
        openTab({
          id: filePath!,
          title: fileName,
          type: "editor",
          content: code,
          language: "latex",
          isDirty: false,
        });
        setActiveView("editor");
      } catch (e) {
        console.error("Failed to create file:", e);
        console.error("Failed to create file: " + String(e));
      }
    },
    [handleTabChange],
  );

  const handleCreateEmpty = useCallback(() => {
    createTabWithContent("", "Untitled.tex");
  }, [createTabWithContent]);

  const handleRequestNewFile = useCallback(() => {
    const existing = tabs.find((t) => t.type === "start-page");
    if (existing) {
      setActiveTab(existing.id);
    } else {
      openTab({
        id: `start-${Date.now()}`,
        title: "Start Page",
        type: "start-page",
      });
    }
  }, [tabs, setActiveTab, openTab]);

  const handleCreateFromTemplate = useCallback(
    (code: string) => createTabWithContent(code, "Untitled.tex"),
    [createTabWithContent],
  );

  const handleOpenTemplateModal = useCallback(() => {
    setShowTemplateModal(true);
    if (templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, []);

  const handleTemplateClick = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
  }, []);

  const handleCreateSelectedTemplate = useCallback(() => {
    if (selectedTemplateId) {
      const template = getTemplateById(selectedTemplateId);
      if (template) {
        handleCreateFromTemplate(template.content);
        setShowTemplateModal(false);
      }
    }
  }, [selectedTemplateId, handleCreateFromTemplate]);

  const handleOpenPreambleWizard = useCallback(
    () => setActiveView("wizard-preamble"),
    [],
  );

  // --- File Handlers (Moved to useProjectFiles) ---

  const handleCloseTab = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      const tab = tabs.find((t) => t.id === id);
      if (tab && tab.isDirty) {
        setTabToCloseId(id);
        setUnsavedChangesModalOpen(true);
        return;
      }

      // Use store's closeTab - it handles everything
      const closed = closeTabStore(id);
      if (!closed) {
      }
    },
    [tabs, closeTabStore],
  );

  const handleConfirmSave = useCallback(async () => {
    if (tabToCloseId) {
      const saved = await handleSave(tabToCloseId);
      if (saved) {
        closeTabStore(tabToCloseId);
        setUnsavedChangesModalOpen(false);
        setTabToCloseId(null);
      }
    }
  }, [tabToCloseId, handleSave, closeTabStore]);

  const handleConfirmDiscard = useCallback(() => {
    if (tabToCloseId) {
      closeTabsById([tabToCloseId]);
      setUnsavedChangesModalOpen(false);
      setTabToCloseId(null);
    }
  }, [tabToCloseId, closeTabsById]);

  const handleCancelClose = useCallback(() => {
    setUnsavedChangesModalOpen(false);
    setTabToCloseId(null);
  }, []);

  const handleOpenFileNode = useCallback(
    async (node: FileSystemNode) => {
      if (node.type === "folder") return;

      // Check if already open
      if (tabs.some((t) => t.id === node.path)) {
        setActiveTab(node.path);
        return;
      }

      // Check if this is a .dtex file
      const isDtexFile = node.path.toLowerCase().endsWith(".dtex");

      if (isDtexFile) {
        // Handle .dtex file opening
        try {
          const { DtexService } = await import("./services/dtexService");
          const dtexFile = await DtexService.parse(node.path);

          // Check if source database exists in collections
          // Match by DB name, DB path, OR if the file's collection matches a loaded collection
          const dbExists = collections.some(
            (c) =>
              c.name === dtexFile.database.name ||
              c.path === dtexFile.database.path ||
              (dtexFile.database.collection &&
                c.name === dtexFile.database.collection),
          );

          if (dbExists) {
            // Database exists - open file normally
            openTab({
              id: node.path,
              title: node.name,
              type: "editor",
              content: dtexFile.content.latex,
              language: "my-latex",
              isDirty: false,
              isDtexFile: true,
              dtexMetadata: dtexFile.metadata,
              metadataDirty: false,
              dtexData: dtexFile,
            });

            // Auto-open Resource Inspector to show metadata
            setShowRightSidebar(true);
          } else {
            // Database not found - show import modal
            setDtexImportModal({
              opened: true,
              dtexFile,
              filePath: node.path,
            });
          }
        } catch (e) {
          console.error("Failed to load .dtex file:", e);
          // Fallback: try to open as plain text
          try {
            const { readTextFile } = await import("@tauri-apps/plugin-fs");
            const content = await readTextFile(node.path);
            openTab({
              id: node.path,
              title: node.name,
              type: "editor",
              content,
              language: "latex",
              isDirty: false,
            });
          } catch (e2) {
            openTab({
              id: node.path,
              title: node.name,
              type: "editor",
              content: `Error reading file: ${String(e2)}`,
              language: "latex",
            });
          }
        }
      } else {
        // Handle regular tex/text files
        let content = "";
        try {
          const { readTextFile } = await import("@tauri-apps/plugin-fs");
          content = await readTextFile(node.path);
        } catch (e) {
          content = `Error reading file: ${String(e)}`;
        }

        openTab({
          id: node.path,
          title: node.name,
          type: "editor",
          content,
          language: "latex",
        });
      }
    },
    [tabs, setActiveTab, openTab, setShowRightSidebar],
  );

  const handleCloseTabs = useCallback(
    (ids: string[]) => {
      closeTabsById(ids);
    },
    [closeTabsById],
  );

  const handleEditorChange = useCallback(
    (id: string, val: string) => {
      if (editorSurfaceActiveRef.current && editorRef.current) {
        latestEditorSourceRef.current = { documentId: id, source: val };
      }
      // Access store directly to avoid dependency on 'tabs'
      const { tabs } = useTabsStore.getState();
      const tab = tabs.find((t) => t.id === id);

      if (tab && !tab.isDirty) {
        // This fires only for the first edit after a successful save. A
        // debounce here creates a window where closing the tab loses data.
        useTabsStore.getState().markDirty(id, true);
      }

      if (activeActivity === "outline") {
        debouncedOutlineUpdate(val);
      }
    },
    [activeActivity, debouncedOutlineUpdate],
  );

  // --- FIX: Update structure on view change ---
  const handleOpenDatabase = useCallback(() => setShowDatabasePanel(true), []);
  const handleOpenPackageBrowser = useCallback(
    () => setActiveView("package-browser"),
    [],
  );

  const handleOpenPackageStudioBuilder = useCallback(
    (builderId?: string) => {
      syncActiveEditorContent();
      if (builderId) setActivePackageStudioBuilderId(builderId);
      setActiveActivity("packages");
      setActiveView("package-studio");
      setIsSidebarOpen(true);
    },
    [syncActiveEditorContent],
  );
  const handleOpenExamGenerator = useCallback(() => {}, []);

  useEffect(() => {
    if (activeActivity === "outline") {
      const tab = tabs.find((t) => t.id === activeTabId);
      if (tab && tab.content) {
        setOutlineSource(tab.content);
      } else {
        // Also try to get from editor ref if content is stale in store
        if (editorRef.current) {
          try {
            setOutlineSource(editorRef.current.getValue());
          } catch (e) {
            /* ignore */
          }
        }
      }
    }
  }, [activeActivity, activeTabId, tabs]);

  // Keyboard shortcut: Ctrl+Shift+P for Package Browser
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest(".stoicheia-scope")
      ) {
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setActiveView("package-browser");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Keyboard shortcut: Ctrl+Shift+N for New from Template
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest(".stoicheia-scope")
      ) {
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setShowTemplateModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Throttled cursor position update - uses store directly, no App re-render
  const handleCursorChange = useCallback(
    throttle((line: number, column: number) => {
      // Use store directly - does not trigger App.tsx re-render
      useCursorStore.getState().setCursor(line, column);
    }, 100),
    [],
  );

  const handleRevealLine = useCallback((line: number) => {
    if (editorRef.current) {
      editorRef.current.revealLine(line);
      editorRef.current.setPosition({ column: 1, lineNumber: line });
      editorRef.current.focus();
    }
  }, []);

  const handleInsertSnippet = useCallback((code: string) => {
    if (editorRef.current) {
      const sel = editorRef.current.getSelection();
      const op = {
        range: sel || {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
        },
        text: code,
        forceMoveMarkers: true,
      };
      editorRef.current.executeEdits("wizard", [op]);
      editorRef.current.focus();
    }
  }, []);

  const handleInsertFromPackageStudio = useCallback(
    (code: string) => {
      setActiveView("editor");
      window.setTimeout(() => handleInsertSnippet(code), 80);
    },
    [handleInsertSnippet],
  );

  const getPackageStudioEditorContext = useCallback(
    (message: string) => {
      const tabsState = useTabsStore.getState();
      const tab = tabsState.tabs.find(
        (item) => item.id === tabsState.activeTabId,
      );

      if (!tab || tab.type !== "editor") {
        notifications.show({
          title: "Package Studio",
          message,
          color: "yellow",
        });
        return null;
      }

      const source =
        activeView === "editor" &&
        tab.id === tabsState.activeTabId &&
        editorRef.current
          ? editorRef.current.getValue()
          : tab.content || "";

      return { source, tabId: tab.id };
    },
    [activeView],
  );

  const applyPackageStudioPlanToEditor = useCallback(
    (
      plan: PackageEditPlan,
      source: string,
      tabId: string,
      noEditColor: "blue" | "yellow" = "blue",
    ) => {
      if (plan.edits.length === 0) {
        notifications.show({
          title: plan.title,
          message: plan.summary,
          color: noEditColor,
        });
        if (activeView !== "package-studio") setActiveView("editor");
        return false;
      }

      setActiveTab(tabId);
      const keepPackageStudioOpen = activeView === "package-studio";
      if (keepPackageStudioOpen) {
        const nextContent = applyPackageTextEdits(source, plan.edits);
        updateTabContent(tabId, nextContent);
        markDirty(tabId, true);
      } else {
        setActiveView("editor");

        window.setTimeout(() => {
          const editor = editorRef.current;
          if (!editor || editor.getValue() !== source) {
            const nextContent = applyPackageTextEdits(source, plan.edits);
            updateTabContent(tabId, nextContent);
            markDirty(tabId, true);
            if (editor) {
              editor.setValue(nextContent);
              editor.focus();
            }
            return;
          }

          editor.executeEdits(
            "package-studio",
            plan.edits.map((edit) => ({
              range: {
                startLineNumber: edit.range.start.line,
                startColumn: edit.range.start.column,
                endLineNumber: edit.range.end.line,
                endColumn: edit.range.end.column,
              },
              text: edit.replacement,
              forceMoveMarkers: true,
            })),
          );
          const nextContent = editor.getValue();
          updateTabContent(tabId, nextContent);
          markDirty(tabId, true);
          editor.focus();
        }, 80);
      }

      notifications.show({
        title: plan.title,
        message: plan.summary,
        color: "green",
      });

      return true;
    },
    [activeView, markDirty, setActiveTab, updateTabContent],
  );

  const reviewPackageStudioPlan = useCallback(
    (
      plan: PackageEditPlan,
      source: string,
      tabId: string,
      targetFilePath: string,
      noEditColor: "blue" | "yellow" = "blue",
    ) => {
      if (plan.edits.length === 0) {
        return applyPackageStudioPlanToEditor(
          plan,
          source,
          tabId,
          noEditColor,
        );
      }

      setPendingPackageStudioEditReview({
        plan,
        source,
        tabId,
        targetFilePath,
        noEditColor,
      });
      setActiveView("package-studio");
      notifications.show({
        title: "Package Studio",
        message: "Review the source changes before applying them.",
        color: "blue",
      });
      return true;
    },
    [applyPackageStudioPlanToEditor],
  );

  const handleDismissPendingPackageStudioEditReview = useCallback(() => {
    setPendingPackageStudioEditReview(null);
  }, []);

  const handleApplyPendingPackageStudioEditReview = useCallback(() => {
    if (!pendingPackageStudioEditReview) return false;

    const tabsState = useTabsStore.getState();
    const targetTab = tabsState.tabs.find(
      (tab) => tab.id === pendingPackageStudioEditReview.tabId,
    );

    if (!targetTab || targetTab.type !== "editor") {
      notifications.show({
        title: "Package Studio",
        message: "The target editor tab is no longer open.",
        color: "red",
      });
      setPendingPackageStudioEditReview(null);
      return false;
    }

    const currentSource =
      tabsState.activeTabId === pendingPackageStudioEditReview.tabId &&
      activeView === "editor" &&
      editorRef.current
        ? editorRef.current.getValue()
        : targetTab.content || "";

    if (currentSource !== pendingPackageStudioEditReview.source) {
      notifications.show({
        title: "Package Studio",
        message:
          "The document changed after the review was created. Generate the package change again.",
        color: "yellow",
      });
      setPendingPackageStudioEditReview(null);
      return false;
    }

    const applied = applyPackageStudioPlanToEditor(
      pendingPackageStudioEditReview.plan,
      pendingPackageStudioEditReview.source,
      pendingPackageStudioEditReview.tabId,
      pendingPackageStudioEditReview.noEditColor,
    );
    setPendingPackageStudioEditReview(null);
    return applied;
  }, [
    activeView,
    applyPackageStudioPlanToEditor,
    pendingPackageStudioEditReview,
  ]);

  const handleReviewPackageStudioEditPlan = useCallback(
    (plan: PackageEditPlan, source: string, targetFilePath: string) => {
      const tabsState = useTabsStore.getState();
      const targetTab = tabsState.tabs.find(
        (tab) => tab.type === "editor" && tab.id === targetFilePath,
      );

      if (!targetTab) {
        notifications.show({
          title: "Package Studio",
          message: "The target editor tab is no longer open.",
          color: "yellow",
        });
        return false;
      }

      const currentSource =
        tabsState.activeTabId === targetTab.id &&
        activeView === "editor" &&
        editorRef.current
          ? editorRef.current.getValue()
          : targetTab.content || "";
      if (currentSource !== source) {
        notifications.show({
          title: "Package Studio",
          message:
            "The target document changed before the review was created. Generate the change again.",
          color: "yellow",
        });
        return false;
      }

      return reviewPackageStudioPlan(
        plan,
        source,
        targetTab.id,
        targetFilePath,
        "blue",
      );
    },
    [activeView, reviewPackageStudioPlan],
  );

  const handleFixPackageDiagnosticFromPackageStudio = useCallback(
    async (diagnostic: PackageDiagnostic) => {
      const context = getPackageStudioEditorContext(
        "Open a LaTeX document before fixing a package diagnostic.",
      );
      if (!context) return;

      try {
        let plan: PackageEditPlan | null = null;

        if (
          diagnostic.code === "package-conflict-color-xcolor" ||
          diagnostic.code === "obsolete-package-epsfig" ||
          diagnostic.code === "package-conflict-subfigure-subcaption"
        ) {
          if (!diagnostic.packageId) return;
          plan = await planRemovePackage({
            source: context.source,
            revision: Date.now(),
            packageId: diagnostic.packageId,
          });
        } else if (diagnostic.code === "package-order-hyperref-late") {
          plan = await planMovePackage({
            source: context.source,
            revision: Date.now(),
            packageId: "hyperref",
            target: "latePreamble",
          });
        } else if (
          diagnostic.code === "package-order-cleveref-after-hyperref"
        ) {
          plan = await planMovePackage({
            source: context.source,
            revision: Date.now(),
            packageId: "cleveref",
            target: "afterPackage",
            afterPackageId: "hyperref",
          });
        }

        if (!plan) {
          notifications.show({
            title: "Package Studio",
            message: "No automatic fix is available for this diagnostic yet.",
            color: "blue",
          });
          return;
        }

        reviewPackageStudioPlan(
          plan,
          context.source,
          context.tabId,
          context.tabId,
          plan.diagnostics.some(
            (item) => item.severity === "warning" || item.severity === "error",
          )
            ? "yellow"
            : "blue",
        );
      } catch (caught) {
        console.error("Failed to create package diagnostic fix plan:", caught);
        notifications.show({
          title: "Package Studio",
          message: String(caught),
          color: "red",
        });
      }
    },
    [getPackageStudioEditorContext, reviewPackageStudioPlan],
  );

  const handleApplyBuilderConfigurationFromPackageStudio = useCallback(
    async (configuration: BuilderConfigurationDraft) => {
      const context = getPackageStudioEditorContext(
        "Open a LaTeX document before changing a package configuration.",
      );
      if (!context) return;

      try {
        const plan = await planApplyBuilderConfiguration({
          ...configuration,
          source: context.source,
          revision: Date.now(),
        });

        reviewPackageStudioPlan(
          plan,
          context.source,
          context.tabId,
          context.tabId,
          plan.diagnostics.some(
            (diagnostic) =>
              diagnostic.severity === "warning" ||
              diagnostic.severity === "error",
          )
            ? "yellow"
            : "blue",
        );
      } catch (caught) {
        console.error("Failed to apply builder configuration plan:", caught);
        notifications.show({
          title: "Package Studio",
          message: String(caught),
          color: "red",
        });
      }
    },
    [getPackageStudioEditorContext, reviewPackageStudioPlan],
  );

  const handleRevealPackageStudioSourceLine = useCallback(
    (line: number) => {
      setActiveView("editor");
      window.setTimeout(() => handleRevealLine(line), 80);
    },
    [handleRevealLine],
  );

  const handleEditorDidMount = useCallback(
    (editor: any, monaco: any) => {
      editorRef.current = editor;
      const mountedDocumentId = useTabsStore.getState().activeTabId;
      if (mountedDocumentId) {
        latestEditorSourceRef.current = {
          documentId: mountedDocumentId,
          source: editor.getValue(),
        };
      }
      configureLatexMonaco(monaco);
      // settings is a dependency here
      monaco.editor.setTheme(settings.editor.theme);
    },
    [settings.editor.theme],
  );

  /* PDF -> Editor (Inverse) - commented out, SyncTeX integration moved to ResourceInspector
  const _handleSyncTexInverse = useCallback(async (page: number, x: number, y: number) => {
      if (!activeTab || !activeTab.id || !isTexFile) return;

      try {
          const texPath = activeTab.id;
          const pdfPath = texPath.replace(/\\.tex$/i, '.pdf');
          const lastSlash = texPath.lastIndexOf(texPath.includes('\\\\') ? '\\\\' : '/');
          const cwd = texPath.substring(0, lastSlash);

          const args = [
              "edit",
              "-o", `${page}:${x}:${y}:${pdfPath}`
          ];

          const result = await invoke<string>('run_synctex_command', { args, cwd });
          const lineMatch = result.match(/Line:(\\d+)/);

          if (lineMatch) {
              const line = parseInt(lineMatch[1], 10);
              
              if (isNaN(line) || line < 1) {
                  setCompileError("SyncTeX returned invalid line number.");
                  return;
              }
              
              handleRevealLine(line);
          } else {
              setCompileError("SyncTeX inverse sync failed. Could not find corresponding line.");
          }

      } catch (e) {
          console.error("SyncTeX Inverse Failed:", e);
          const errorMsg = String(e);
          if (errorMsg.includes('synctex.gz')) {
              setCompileError("SyncTeX file not found. Please recompile your document with SyncTeX enabled.");
          } else {
              setCompileError("SyncTeX inverse search failed: " + errorMsg);
          }
      }
  }, [activeTab, isTexFile, handleRevealLine]);
  */

  // --- Word Count Logic ---
  const handleWordCount = useCallback(async () => {
    if (!activeTab || !activeTab.id || !isTexFile) return;

    try {
      const texPath = activeTab.id;
      const lastSlash = texPath.lastIndexOf(
        texPath.includes("\\") ? "\\" : "/",
      );
      const cwd = texPath.substring(0, lastSlash);

      const args = ["-brief", "-total", texPath];

      const result = await invoke<string>("run_texcount_command", {
        args,
        cwd,
      });
      setWordCountResult(result);
      setShowWordCount(true);
    } catch (e) {
      console.error("TexCount Failed:", e);
      console.error("Word count failed: " + String(e));
    }
  }, [activeTab, isTexFile]);

  // --- Handlers (DB) ---

  const handleOpenFileFromTable = useCallback(
    (path: string) => {
      // Adapt path to FileSystemNode
      const node: FileSystemNode = {
        id: path,
        name: path.split(/[/\\]/).pop() || path,
        type: "file",
        path: path,
        children: [],
      };
      handleOpenFileNode(node);

      // Auto-open Resource Inspector when file selected from Table
      setShowRightSidebar(true);
    },
    [handleOpenFileNode],
  );

  const handleOpenFileAtLine = useCallback(
    (path: string, lineNumber: number) => {
      // Open the file first
      const node: FileSystemNode = {
        id: path,
        name: path.split(/[/\\]/).pop() || path,
        type: "file",
        path: path,
        children: [],
      };
      handleOpenFileNode(node);

      // Then scroll to the line after a short delay to ensure editor is ready
      setTimeout(() => {
        handleRevealLine(lineNumber);
      }, 150);
    },
    [handleOpenFileNode, handleRevealLine],
  );

  const handleExportToTex = useCallback(
    async (resourceId?: string) => {
      try {
        let filePath: string | undefined;

        // 1. Determine Source Path
        if (resourceId) {
          // Lookup in loaded resources
          const { allLoadedResources } = useDatabaseStore.getState();
          const r = allLoadedResources.find(
            (res) => res.id === resourceId || res.path === resourceId,
          );
          if (r) {
            filePath = r.path;
          }
        } else {
          // Use active tab
          filePath = useTabsStore.getState().activeTabId;
        }

        if (!filePath) {
          notifications.show({
            title: "Export Failed",
            message: "No file selected",
            color: "red",
          });
          return;
        }

        // Ensure it's a .dtex file
        if (!filePath.toLowerCase().endsWith(".dtex")) {
          notifications.show({
            title: "Export Failed",
            message: "Only .dtex files can be exported to .tex",
            color: "red",
          });
          return;
        }

        // 2. Parse source .dtex
        const dtexFile = await DtexService.parse(filePath);

        // 3. Determine output path (replace .dtex with .tex)
        const outputPath = filePath.replace(/\.dtex$/i, ".tex");
        const outputName = outputPath.split(/[/\\]/).pop();

        // 4. Export
        await DtexService.exportToTex(dtexFile, outputPath);

        // 5. Notify
        notifications.show({
          title: "Export Successful",
          message: `Exported to ${outputName}`,
          color: "green",
        });

        // 6. Refresh file tree
        reloadProjectFiles(projectData.map((n) => n.path));
      } catch (error) {
        console.error("Failed to export .tex:", error);
        notifications.show({
          title: "Export Failed",
          message: String(error),
          color: "red",
        });
      }
    },
    [projectData, reloadProjectFiles],
  );

  const handleBatchExport = useCallback(
    async (scope: "all" | "collection", collectionName?: string) => {
      setBatchExporting(true);
      setBatchResults(null);
      const { allLoadedResources } = useDatabaseStore.getState();

      // Filter resources
      let targets = allLoadedResources.filter(
        (r) =>
          r.path.toLowerCase().endsWith(".tex") && r.kind !== "bibliography",
      );

      if (scope === "collection" && collectionName) {
        targets = targets.filter((r) => r.collection === collectionName);
      }

      setBatchProgress({
        current: 0,
        total: targets.length,
        success: 0,
        failed: 0,
      });

      const errors: { file: string; error: string }[] = [];
      let successCount = 0;
      let failedCount = 0;

      // Import path module safely or use string manipulation if needed (DtexService handles creation)
      // We iterate
      for (let i = 0; i < targets.length; i++) {
        const res = targets[i];
        setBatchProgress((prev) => ({
          ...prev,
          current: i + 1,
          currentFile: res.title || res.path.split(/[/\\]/).pop(),
        }));

        try {
          const dbInfo: DtexDatabaseInfo = {
            id: res.id,
            name: res.collection || "Default Database", // Use collection name as DB name for easier matching
            type: "files_database",
            collection: res.collection,
          };

          await DtexService.createFromTexFile(res.path, dbInfo);
          successCount++;
        } catch (e) {
          console.error("Batch export failed for", res.path, e);
          failedCount++;
          errors.push({
            file: res.title || res.path.split(/[/\\]/).pop() || "Unknown",
            error: String(e),
          });
        }

        // Yield to UI
        await new Promise((r) => setTimeout(r, 10));
      }

      setBatchExporting(false);
      setBatchResults({ success: successCount, failed: failedCount, errors });

      // Refresh file tree (approximate refresh of parenting folders)
      reloadProjectFiles(targets.map((t) => t.path));
    },
    [reloadProjectFiles],
  );

  const handleExportDtex = useCallback(
    async (resourceId?: string) => {
      try {
        let filePath: string | undefined;
        let collectionName: string | undefined;

        // 1. Determine Source Path
        if (resourceId) {
          // Lookup in loaded resources
          const { allLoadedResources } = useDatabaseStore.getState();
          const r = allLoadedResources.find(
            (res) => res.id === resourceId || res.path === resourceId,
          );
          if (r) {
            filePath = r.path;
            collectionName = r.collection;
          }
        } else {
          // Use active tab
          filePath = useTabsStore.getState().activeTabId;
          // Try to find collection for active file
          if (filePath) {
            const { allLoadedResources } = useDatabaseStore.getState();
            const r = allLoadedResources.find((res) => res.path === filePath);
            if (r) {
              collectionName = r.collection;
            }
          }
        }

        if (!filePath) {
          notifications.show({
            title: "Export Failed",
            message: "No file selected",
            color: "red",
          });
          return;
        }

        // Ensure it's a .tex file
        if (!filePath.toLowerCase().endsWith(".tex")) {
          notifications.show({
            title: "Export Failed",
            message: "Only .tex files can be exported to .dtex",
            color: "red",
          });
          return;
        }

        // 2. Export
        const dbInfo: DtexDatabaseInfo = {
          id: "local",
          name: "Local Export",
          type: "local",
          collection: collectionName,
        };

        const targetPath = await DtexService.createFromTexFile(
          filePath,
          dbInfo,
        );

        // 3. Notify & Refresh
        notifications.show({
          title: "Export Successful",
          message: `Created ${targetPath.split(/[/\\]/).pop()}`,
          color: "green",
        });

        // Refresh file tree
        reloadProjectFiles(projectData.map((node) => node.path));
      } catch (err) {
        console.error(err);
        notifications.show({
          title: "Export Error",
          message: String(err),
          color: "red",
        });
      }
    },
    [reloadProjectFiles, projectData],
  );

  const handleOpenFileDialog = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await open({
        multiple: false,
        title: "Open File",
        filters: [
          {
            name: "TeX Files",
            extensions: ["tex", "sty", "cls", "bib", "dtx", "ins", "dtex"],
          },
          {
            name: "All Files",
            extensions: ["*"],
          },
        ],
      });

      if (selectedPath && typeof selectedPath === "string") {
        // Check if file is in database
        const {
          allLoadedResources,
          importFile,
          activeCollection,
          collections,
        } = useDatabaseStore.getState();
        const inDb = allLoadedResources.some((r) => r.path === selectedPath);

        if (!inDb) {
          // Auto-import to active or first collection
          let targetCol = activeCollection;
          if (!targetCol && collections.length > 0) {
            targetCol = collections[0].name;
          }

          if (targetCol) {
            try {
              await importFile(selectedPath, targetCol);
              notifications.show({
                title: "File Imported",
                message: `Added to collection "${targetCol}"`,
                color: "blue",
              });
            } catch (err) {
              console.warn("Failed to auto-import file:", err);
            }
          }
        }

        handleOpenFileFromTable(selectedPath);
      }
    } catch (e) {
      console.error("Failed to open file dialog:", e);
    }
  }, [handleOpenFileFromTable]);

  // --- Resize Logic moved to useAppPanelResize hook ---

  // --- DND Logic ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        // Drop on Editor (Open File)
        if (over.id === "editor-zone") {
          const activeNode = active.data.current?.node as FileSystemNode;
          if (activeNode && activeNode.type === "file") {
            handleOpenFileNode(activeNode);
          }
          return;
        }

        // Drop on Folder (Move File)
        const activeNode = active.data.current?.node as FileSystemNode;
        const overNode = over.data.current?.node as FileSystemNode;

        if (activeNode && overNode && overNode.type === "folder") {
          handleMoveItem(activeNode.path, overNode.path);
        }
      }
    },
    [handleOpenFileNode, handleMoveItem],
  );

  // --- RENDER ---
  return (
    <MantineProvider
      theme={activeTheme.theme}
      forceColorScheme={activeTheme.type}
      cssVariablesResolver={resolver}
    >
      <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
        <AppShell header={{ height: 35 }} footer={{ height: 24 }} padding={0}>
          {/* HEADER */}
          <AppShell.Header
            withBorder={false}
            style={{ zIndex: 200, backgroundColor: "var(--app-header-bg)" }}
          >
            <HeaderContent
              onNewFile={handleRequestNewFile}
              onNewFromTemplate={handleOpenTemplateModal}
              onSaveFile={handleSaveFromActiveSurface}
              onOpenFile={handleOpenFileDialog}
              // Left Sidebar
              showLeftSidebar={isSidebarOpen}
              onToggleLeftSidebar={() => setIsSidebarOpen((prev) => !prev)}
              // Database
              showDatabasePanel={showDatabasePanel}
              onToggleDatabasePanel={() =>
                setShowDatabasePanel(!showDatabasePanel)
              }
              databasePanelPosition={databasePanelPosition}
              onToggleDatabasePosition={() =>
                setDatabasePanelPosition((pos) =>
                  pos === "bottom" ? "left" : "bottom",
                )
              }
              // Right Sidebar
              showRightSidebar={showRightSidebar}
              onToggleRightSidebar={() =>
                setShowRightSidebar(!showRightSidebar)
              }
              // Edit Actions
              onUndo={() => editorRef.current?.trigger(null, "undo", null)}
              onRedo={() => editorRef.current?.trigger(null, "redo", null)}
              onCut={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.clipboardCutAction",
                  null,
                )
              }
              onCopy={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.clipboardCopyAction",
                  null,
                )
              }
              onPaste={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.clipboardPasteAction",
                  null,
                )
              }
              onFind={() =>
                editorRef.current?.trigger(null, "actions.find", null)
              }
              // View Actions
              onToggleWordCount={handleWordCount}
              onZoomIn={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.fontZoomIn",
                  null,
                )
              }
              onZoomOut={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.fontZoomOut",
                  null,
                )
              }
              // Tools
              onOpenWizard={(wizard) =>
                setActiveView(`wizard-${wizard}` as ViewType)
              }
              onOpenSettings={() => {
                setActiveActivity("settings");
                setActiveView("settings");
                setIsSidebarOpen(false);
              }}
              // Database Menu Actions
              onOpenDatabase={handleOpenFolder}
              onAddCollection={handleAddFolder}
              onRefreshDatabase={() =>
                reloadProjectFiles(projectData.map((node) => node.path))
              }
              // Build Actions
              onCompile={handleCompile}
              onStopCompile={handleStopCompile}
              // Package Browser
              onOpenPackageBrowser={() => setActiveView("package-browser")}
              // Insert Actions
              onInsertImage={async () => {
                if (editorRef.current) {
                  try {
                    // @ts-ignore
                    const { open } = await import("@tauri-apps/plugin-dialog");
                    const selectedPath = await open({
                      multiple: false,
                      title: "Select Image",
                      filters: [
                        {
                          name: "Images",
                          extensions: [
                            "png",
                            "jpg",
                            "jpeg",
                            "gif",
                            "pdf",
                            "eps",
                            "svg",
                          ],
                        },
                      ],
                    });

                    if (selectedPath && typeof selectedPath === "string") {
                      const imageCode = `\\begin{figure}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{${selectedPath}}
    \\caption{Caption here}
    \\label{fig:label}
\\end{figure}`;
                      const selection = editorRef.current.getSelection();
                      if (selection) {
                        editorRef.current.executeEdits("header-menu", [
                          {
                            range: selection,
                            text: imageCode,
                            forceMoveMarkers: true,
                          },
                        ]);
                        editorRef.current.focus();
                      }
                    }
                  } catch (e) {
                    console.error("Failed to open image dialog:", e);
                  }
                }
              }}
              onToggleAI={() => {
                if (activeView === "ai-assistant") {
                  setActiveView("editor");
                } else {
                  setActiveView("ai-assistant");
                }
              }}
              onExportDtex={handleExportDtex}
              onExportToTex={handleExportToTex}
              onBatchExport={() => setBatchModalOpen(true)}
              // New Actions
              onSaveAs={handleSaveAsFromActiveSurface}
              onCloseFile={() => {
                if (activeTabId) {
                  handleCloseTab(activeTabId);
                }
              }}
              recentProjects={recentProjects}
              onOpenRecent={(path) => {
                // handleOpenFolder seems to be a void function that triggers dialog?
                // Let's use reloadProjectFiles directly for recent projects
                reloadProjectFiles([path]);
                // Also need to set root path
                setRootPath(path);
                addToRecent(path);
              }}
              onSelectAll={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.selectAll",
                  null,
                )
              }
              onReplace={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.startFindReplaceAction",
                  null,
                )
              }
              onGoToLine={() =>
                editorRef.current?.trigger(null, "editor.action.gotoLine", null)
              }
              onToggleComment={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.commentLine",
                  null,
                )
              }
              onResetZoom={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.fontZoomReset",
                  null,
                )
              }
            />
          </AppShell.Header>

          {/* MAIN LAYOUT */}
          <AppShell.Main
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100vh",
              paddingTop: 35,
              paddingBottom: 24,
              backgroundColor: "var(--app-bg)",
            }}
          >
            <Group gap={0} h="calc(100vh - 35px - 24px)" wrap="nowrap">
              {/* 1. SIDEBAR */}
              <Sidebar
                width="var(--sidebar-width)"
                isOpen={isSidebarOpen}
                onResizeStart={startResizeSidebar}
                activeSection={activeActivity} // This assumes activeActivity is of type SidebarSection
                onToggleSection={handleToggleSidebar}
                onNavigate={handleNavigateView}
                // File System
                onOpenFolder={handleOpenFolder}
                onAddFolder={handleAddFolder}
                onRemoveFolder={handleRemoveFolder}
                onOpenFileNode={handleOpenFileNode}
                onOpenFileAtLine={handleOpenFileAtLine}
                onCreateItem={handleCreateItem}
                onRenameItem={handleRenameItem}
                onDeleteItem={handleDeleteItem}
                onMoveItem={handleMoveItem}
                // Tools
                onInsertSymbol={handleInsertSnippet}
                activePackageId={activePackageId}
                onSelectPackage={setActivePackageId}
                activePackageStudioBuilderId={activePackageStudioBuilderId}
                onOpenPackageStudioBuilder={handleOpenPackageStudioBuilder}
                outlineSource={outlineSource}
                onScrollToLine={handleRevealLine}
                // Git & History
                projectPath={
                  projectData.length > 0 ? projectData[0].path : undefined
                }
                activeFilePath={activeTab?.id}
                activeFileContent={activeTab?.content}
                onRestoreContent={(content) => {
                  if (activeTab) {
                    updateTabContent(activeTab.id, content);
                    markDirty(activeTab.id, true);
                  }
                }}
                onExportDtex={handleExportDtex}
                onExportToTex={handleExportToTex}
              />

              {/* 2. CENTER: EDITOR / VIEWS */}
              <Box
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {activeView === "settings" ? (
                  <Suspense fallback={<ViewLoadingFallback />}>
                    <SettingsPanel
                      settings={settings}
                      onUpdateEditor={updateEditorSetting}
                      onUpdateEditorBehavior={updateEditorBehaviorSetting}
                      onUpdatePdfViewer={updatePdfViewerSetting}
                      onUpdateCompilation={updateCompilationSetting}
                      onUpdateTexEngine={updateTexEngineSetting}
                      onUpdateDatabase={updateDatabaseSetting}
                      onUpdateAccessibility={updateAccessibilitySetting}
                      onUpdateGeneral={updateGeneralSetting}
                      onUpdateUi={setUiTheme}
                      onUpdateCustomThemeOverride={updateCustomThemeOverride}
                      onAddCustomTheme={addCustomTheme}
                      onRemoveCustomTheme={removeCustomTheme}
                      onSetLatexSyntaxColor={setLatexSyntaxColor}
                      onResetLatexSyntaxColor={resetLatexSyntaxColor}
                      onSetLatexSyntaxFontStyle={setLatexSyntaxFontStyle}
                      onResetLatexSyntaxFontStyles={
                        resetLatexSyntaxFontStyles
                      }
                      onResetLatexSyntaxColorGroup={
                        resetLatexSyntaxColorGroup
                      }
                      onResetLatexSyntaxTheme={resetLatexSyntaxTheme}
                      onResetAllLatexSyntaxColors={
                        resetAllLatexSyntaxColors
                      }
                    />
                  </Suspense>
                ) : activeView === "bibliography-workspace" ? (
                  <Suspense fallback={<ViewLoadingFallback />}>
                    <BibliographyWorkspace
                      onClose={handleExitBibliographyWorkspace}
                    />
                  </Suspense>
                ) : activeView === "package-studio" ? (
                  <Suspense fallback={<ViewLoadingFallback />}>
                    <PackageStudioWorkspace
                      activeBuilderId={activePackageStudioBuilderId}
                      onSelectBuilder={setActivePackageStudioBuilderId}
                      onBackToEditor={() => setActiveView("editor")}
                      onInsertCode={handleInsertFromPackageStudio}
                      onFixDiagnostic={
                        handleFixPackageDiagnosticFromPackageStudio
                      }
                      onApplyBuilderConfiguration={
                        handleApplyBuilderConfigurationFromPackageStudio
                      }
                      onReviewEditPlan={handleReviewPackageStudioEditPlan}
                      onRevealSourceLine={handleRevealPackageStudioSourceLine}
                      pendingEditReview={pendingPackageStudioEditReview}
                      onApplyPendingEditPlan={
                        handleApplyPendingPackageStudioEditReview
                      }
                      onDismissPendingEditPlan={
                        handleDismissPendingPackageStudioEditReview
                      }
                      onSaveHostDocument={
                        handleSavePackageStudioDocument
                      }
                      onChooseHostSaveAsTarget={
                        handleChoosePackageStudioSaveAsTarget
                      }
                      onSaveAsHostDocument={
                        handleSaveAsPackageStudioDocument
                      }
                      onExportHostSvg={handleExportPackageStudioSvg}
                      onRegisterGraphicsSaveRequest={
                        handleRegisterGraphicsStudioSaveRequest
                      }
                      onRegisterGraphicsSaveAsRequest={
                        handleRegisterGraphicsStudioSaveAsRequest
                      }
                      activeFilePath={
                        activeTab?.type === "editor" ? activeTab.id : undefined
                      }
                      activeFileContent={
                        activeTab?.type === "editor"
                          ? activeTab.content
                          : undefined
                      }
                      activeFileFocus={packageStudioSourceFocus}
                      hostTheme={activeTheme.type}
                      hostLanguage={settings.general.language}
                      hostLatexCompiler={settings.texEngine.defaultEngine}
                      hostLatexEnginePaths={{
                        lualatex: settings.texEngine.lualatexPath,
                        pdflatex: settings.texEngine.pdflatexPath,
                        xelatex: settings.texEngine.xelatexPath,
                      }}
                      hostDvisvgmPath={settings.texEngine.dvisvgmPath}
                      onOpenHostSettings={() => setActiveView("settings")}
                    />
                  </Suspense>
                ) : /* Default: EDITOR AREA with optional Database Panel */
                databasePanelPosition === "left" && showDatabasePanel ? (
                  /* Horizontal layout: Database left, Editor right */
                  <Group
                    className="database-left-layout"
                    gap={0}
                    h="100%"
                    wrap="nowrap"
                  >
                    <Box
                      className="database-left-panel"
                      style={{
                        borderRight:
                          "1px solid var(--mantine-color-default-border)",
                      }}
                    >
                      <Box className="database-left-panel__content">
                        <Suspense fallback={<ViewLoadingFallback />}>
                          <DatabaseView
                            onOpenFile={handleOpenFileFromTable}
                            canInsert={(() => {
                              if (!activeTab) return false;

                              // 1. Check Metadata
                              const resource = useDatabaseStore
                                .getState()
                                .allLoadedResources.find(
                                  (r) =>
                                    r.path === activeTab.id ||
                                    r.id === activeTab.id,
                                );
                              if (resource && resource.kind === "document")
                                return true;

                              // 2. Fallback: Check content
                              if (
                                activeTab.content &&
                                activeTab.content.includes("\\documentclass")
                              )
                                return true;

                              return false;
                            })()}
                          />
                        </Suspense>
                      </Box>
                    </Box>
                    <ResizerHandle
                      onPointerDown={startResizeDatabase}
                      orientation="vertical"
                    />
                    <Box
                      className="database-left-editor"
                    >
                      <Box className="database-left-editor__content">
                        <EditorArea
                          files={tabs}
                          activeFileId={activeTabId}
                          onFileSelect={handleTabChange}
                          onFileClose={handleCloseTab}
                          onCloseFiles={handleCloseTabs}
                          onContentChange={handleEditorChange}
                          onMount={handleEditorDidMount}
                          showPdf={showRightPanel && activeView === "editor"}
                          onTogglePdf={handleTogglePdf}
                          isTexFile={isTexFile}
                          onCompile={handleCompile}
                          isCompiling={isCompiling}
                          onStopCompile={handleStopCompile}
                          onSave={handleSave}
                          onCreateEmpty={handleCreateEmpty}
                          onOpenWizard={handleOpenPreambleWizard}
                          onCreateFromTemplate={handleCreateFromTemplate}
                          recentProjects={recentProjects}
                          onOpenRecent={handleOpenRecent}
                          onOpenDatabase={handleOpenDatabase}
                          onOpenPackageBrowser={handleOpenPackageBrowser}
                          onOpenExamGenerator={handleOpenExamGenerator}
                          editorSettings={editorSettingsMemo}
                          logEntries={logEntries}
                          showLogPanel={showLogPanel}
                          onCloseLogPanel={handleCloseLogPanel}
                          onJumpToLine={handleRevealLine}
                          onCursorChange={handleCursorChange}
                          onSyncTexForward={handleSyncTexForward}
                          spellCheckEnabled={spellCheckEnabled}
                          onOpenFileFromTable={handleOpenFileFromTable}
                          onOpenFile={handleOpenFileFromTable}
                          onOpenFileDialog={handleOpenFileDialog}
                          lspClient={lspClientRef.current}
                        />
                      </Box>
                    </Box>
                  </Group>
                ) : (
                  /* Vertical layout: Editor top, Database bottom (or no database) */
                  <Stack className="database-bottom-layout" gap={0} h="100%">
                    <Box
                      className="database-bottom-editor"
                      style={{
                        flex: 1,
                        minHeight: 0,
                        overflow: "hidden",
                      }}
                    >
                      <Box className="database-bottom-editor__content">
                        <EditorArea
                          files={tabs}
                          activeFileId={activeTabId}
                          onFileSelect={handleTabChange}
                          onFileClose={handleCloseTab}
                          onCloseFiles={handleCloseTabs}
                          onContentChange={handleEditorChange}
                          onMount={handleEditorDidMount}
                          showPdf={showRightPanel && activeView === "editor"}
                          onTogglePdf={handleTogglePdf}
                          isTexFile={isTexFile}
                          onCompile={handleCompile}
                          isCompiling={isCompiling}
                          onStopCompile={handleStopCompile}
                          onSave={handleSave}
                          onCreateEmpty={handleCreateEmpty}
                          onOpenWizard={handleOpenPreambleWizard}
                          onCreateFromTemplate={handleCreateFromTemplate}
                          recentProjects={recentProjects}
                          onOpenRecent={handleOpenRecent}
                          onOpenDatabase={handleOpenDatabase}
                          onOpenPackageBrowser={handleOpenPackageBrowser}
                          onOpenExamGenerator={handleOpenExamGenerator}
                          onOpenTemplateModal={handleOpenTemplateModal}
                          editorSettings={editorSettingsMemo}
                          logEntries={logEntries}
                          showLogPanel={showLogPanel}
                          onCloseLogPanel={handleCloseLogPanel}
                          onJumpToLine={handleRevealLine}
                          onCursorChange={handleCursorChange}
                          onSyncTexForward={handleSyncTexForward}
                          spellCheckEnabled={spellCheckEnabled}
                          onOpenFileFromTable={handleOpenFileFromTable}
                          onOpenFile={handleOpenFileFromTable}
                          onOpenFileDialog={handleOpenFileDialog}
                          lspClient={lspClientRef.current}
                        />
                      </Box>
                    </Box>
                    {showDatabasePanel && (
                      <>
                        <ResizerHandle
                          onPointerDown={startResizeDatabaseHeight}
                          orientation="horizontal"
                        />
                        <Box
                          className="database-bottom-panel"
                          style={{
                            borderTop:
                              "1px solid var(--mantine-color-default-border)",
                          }}
                        >
                          <Box className="database-bottom-panel__content">
                            <Suspense fallback={<ViewLoadingFallback />}>
                              <DatabaseView
                                onOpenFile={handleOpenFileFromTable}
                                canInsert={(() => {
                                  if (!activeTab) return false;

                                  // 1. Check Metadata
                                  const resource = useDatabaseStore
                                    .getState()
                                    .allLoadedResources.find(
                                      (r) =>
                                        r.path === activeTab.id ||
                                        r.id === activeTab.id,
                                    );
                                  if (
                                    resource &&
                                    resource.kind === "document"
                                  )
                                    return true;

                                  // 2. Fallback: Check content
                                  if (
                                    activeTab.content &&
                                    activeTab.content.includes(
                                      "\\documentclass",
                                    )
                                  )
                                    return true;

                                  return false;
                                })()}
                              />
                            </Suspense>
                          </Box>
                        </Box>
                      </>
                    )}
                  </Stack>
                )}
              </Box>

              {/* 3. RIGHT PANEL (PDF / Inspectors / Gallery) */}
              {showRightPanel && activeView !== "bibliography-workspace" && (
                <>
                  <ResizerHandle
                    onPointerDown={startResizeRightPanel}
                  />
                  <Box
                    className="right-panel"
                    style={{
                      height: "100%",
                      borderLeft:
                        "1px solid var(--mantine-color-default-border)",
                      backgroundColor: "var(--app-panel-bg)",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }}
                  >
                    <Box className="right-panel__content">
                      <Suspense fallback={<ViewLoadingFallback />}>
                      {activeView === "gallery" ? (
                      <PackageGallery
                        selectedPkgId={activePackageId || ""}
                        onInsert={(code) => {
                          handleInsertSnippet(code);
                        }}
                        onClose={() => setActiveView("editor")}
                        onOpenWizard={setActiveView}
                        onOpenPackageBrowser={() =>
                          setActiveView("package-browser")
                        }
                      />
                    ) : activeView === "package-browser" ? (
                      <PackageBrowser
                        compact={true}
                        onClose={() => setActiveView("editor")}
                        onInsertPackage={(code) => {
                          handleInsertSnippet(code);
                        }}
                      />
                    ) : activeView === "wizard-preamble" ? (
                      <WizardWrapper
                        title="Preamble Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <PreambleWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-table" ||
                      activeView === "wizard-tabularray" ? (
                      <WizardWrapper
                        title="Table Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <UnifiedTableWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-math" ? (
                      <WizardWrapper
                        title="Math Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <MathWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-graphicx" ? (
                      <WizardWrapper
                        title="Graphicx Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <GraphicxWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-tikz" ? (
                      <WizardWrapper
                        title="TikZ Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <TikzPgfPlotsWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-fancyhdr" ? (
                      <WizardWrapper
                        title="Fancy Header Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <FancyhdrWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-pstricks" ? (
                      <WizardWrapper
                        title="PSTricks Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <PstricksWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                          onChange={() => {}}
                        />
                      </WizardWrapper>
                    ) : activeView === "ai-assistant" ? (
                      <AISidebar
                        onInsertCode={(code) => handleInsertSnippet(code)}
                        onClose={() => setActiveView("editor")}
                      />
                    ) : (
                      <ResourceInspector
                        mainEditorPdfPath={pdfPath}
                        mainEditorPdfUrl={pdfUrl}
                        mainEditorPdfLoading={pdfLoading}
                        syncTexCoords={syncTexCoords}
                        activeEditorTab={activeTab}
                        onInsertFragment={handleInsertSnippet}
                        onSyncTexInverse={onSyncTexInverse}
                        canInsert={(() => {
                          if (!activeTab) return false;

                          // 1. Check Metadata
                          const resource = useDatabaseStore
                            .getState()
                            .allLoadedResources.find(
                              (r) =>
                                r.path === activeTab.id ||
                                r.id === activeTab.id,
                            );
                          if (resource && resource.kind === "document")
                            return true;

                          // 2. Fallback: Check content
                          if (
                            activeTab.content &&
                            activeTab.content.includes("\\documentclass")
                          )
                            return true;

                          return false;
                        })()}
                      />
                      )}
                      </Suspense>
                    </Box>
                  </Box>
                </>
              )}
            </Group>
          </AppShell.Main>

          {/* FOOTER */}
          <AppShell.Footer withBorder={false} p={0}>
            <StatusBar
              language={activeTab?.language}
              dbConnected={true}
              spellCheckEnabled={spellCheckEnabled}
              onToggleSpellCheck={() =>
                setSpellCheckEnabled(!spellCheckEnabled)
              }
              onWordCount={handleWordCount}
            />
          </AppShell.Footer>

          <Modal
            opened={showWordCount}
            onClose={() => setShowWordCount(false)}
            title="Word Count Result"
          >
            <Text style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
              {wordCountResult}
            </Text>
          </Modal>

          {/* Template Modal */}
          <Modal
            opened={showTemplateModal}
            onClose={() => setShowTemplateModal(false)}
            title="Create New Document from Template"
            size="xl"
            centered
            styles={{
              body: { height: "70vh", overflow: "hidden" },
            }}
          >
            <div
              style={{
                display: "flex",
                height: "100%",
                gap: "1rem",
              }}
            >
              {/* LEFT COLUMN: Template List */}
              <div
                style={{
                  width: "35%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <ScrollArea h="100%">
                  <Stack gap="sm">
                    {templates.map((template) => {
                      const isSelected = selectedTemplateId === template.id;
                      return (
                        <div
                          key={template.id}
                          onClick={() => handleTemplateClick(template.id)}
                          onDoubleClick={() => {
                            handleTemplateClick(template.id);
                            handleCreateSelectedTemplate();
                          }}
                          style={{
                            padding: "1rem",
                            border: `1px solid ${
                              isSelected
                                ? "var(--mantine-primary-color-filled)"
                                : "var(--mantine-color-default-border)"
                            }`,
                            borderRadius: "var(--mantine-radius-md)",
                            cursor: "pointer",
                            backgroundColor: isSelected
                              ? "var(--mantine-color-default-hover)"
                              : "transparent",
                            transition: "all 0.2s",
                          }}
                        >
                          <Group mb="xs" wrap="nowrap">
                            <FontAwesomeIcon
                              icon={templateIcons[template.icon] ?? faFile}
                              style={{
                                width: "1.25rem",
                                height: "1.25rem",
                                color: isSelected
                                  ? "var(--mantine-primary-color-filled)"
                                  : "var(--mantine-color-dimmed)",
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <Text
                                fw={600}
                                size="sm"
                                c={isSelected ? "bright" : "dimmed"}
                                style={{
                                  color: isSelected
                                    ? "var(--mantine-color-text)"
                                    : undefined,
                                }}
                              >
                                {template.name}
                              </Text>
                              <Text size="xs" c="dimmed" lineClamp={2}>
                                {template.description}
                              </Text>
                            </div>
                          </Group>
                        </div>
                      );
                    })}
                  </Stack>
                </ScrollArea>
              </div>

              {/* RIGHT COLUMN: Preview & Action */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  borderLeft: "1px solid var(--mantine-color-default-border)",
                  paddingLeft: "1rem",
                }}
              >
                <Text fw={600} mb="xs">
                  Template Preview:
                </Text>
                <ScrollArea
                  flex={1}
                  type="auto"
                  style={{
                    border: "1px solid var(--mantine-color-default-border)",
                    borderRadius: "var(--mantine-radius-md)",
                    backgroundColor: "var(--mantine-color-default-active)",
                  }}
                >
                  <Code
                    block
                    style={{
                      backgroundColor: "transparent",
                      minHeight: "100%",
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                    }}
                  >
                    {selectedTemplateId
                      ? getTemplateById(selectedTemplateId)?.content
                      : "Select a template to view code..."}
                  </Code>
                </ScrollArea>

                <Group justify="flex-end" mt="md">
                  <Button
                    variant="default"
                    onClick={() => setShowTemplateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSelectedTemplate}>
                    Create Document
                  </Button>
                </Group>
              </div>
            </div>
          </Modal>
          {batchModalOpen && (
            <Suspense fallback={null}>
              <BatchExportModal
                opened={batchModalOpen}
                onClose={() => setBatchModalOpen(false)}
                onExport={handleBatchExport}
                isExporting={batchExporting}
                progress={batchProgress}
                results={batchResults}
              />
            </Suspense>
          )}
        </AppShell>
      </DndContext>
      {unsavedChangesModalOpen && (
        <Suspense fallback={null}>
          <UnsavedChangesModal
            opened={unsavedChangesModalOpen}
            onClose={handleCancelClose}
            onDiscard={handleConfirmDiscard}
            onSave={handleConfirmSave}
            fileName={
              tabs.find((t) => t.id === tabToCloseId)?.title || "this file"
            }
          />
        </Suspense>
      )}
      {dtexImportModal.opened && (
        <Suspense fallback={null}>
          <DtexImportModal
        opened={dtexImportModal.opened}
        onClose={() =>
          setDtexImportModal({ opened: false, dtexFile: null, filePath: "" })
        }
        dtexFile={dtexImportModal.dtexFile}
        filePath={dtexImportModal.filePath}
        onImport={async (option) => {
          const { dtexFile, filePath } = dtexImportModal;
          if (!dtexFile) return;

          // Open the file based on import option
          if (option.type === "standalone") {
            // Just open without database sync
            openTab({
              id: filePath,
              title: filePath.split("/").pop() || "Untitled",
              type: "editor",
              content: dtexFile.content.latex,
              language: "my-latex",
              isDirty: false,
              isDtexFile: true,
              dtexMetadata: dtexFile.metadata,
              metadataDirty: false,
              dtexData: dtexFile,
            });
            setShowRightSidebar(true);
          } else if (option.type === "add-to-existing") {
            // Add resource to existing collection
            const collectionName = option.collectionId;
            const collection = collections.find(
              (c) => c.name === collectionName,
            );

            if (collection && collection.path) {
              try {
                const { writeTextFile } = await import("@tauri-apps/plugin-fs");

                // Generate .tex filename from metadata id or original filename
                const texFilename =
                  (dtexFile.metadata.id ||
                    filePath.split("/").pop()?.replace(".dtex", "")) + ".tex";
                const texPath = collection.path + "/" + texFilename;

                // Save .tex file to disk
                await writeTextFile(texPath, dtexFile.content.latex);

                // Create resource in database with metadata
                await createResource(
                  texPath,
                  collectionName,
                  dtexFile.content.latex,
                  dtexFile.metadata,
                );

                // Refresh resources
                await fetchResourcesForLoadedCollections();

                // Open the new .tex file
                openTab({
                  id: texPath,
                  title: texFilename,
                  type: "editor",
                  content: dtexFile.content.latex,
                  language: "my-latex",
                  isDirty: false,
                });
                setShowRightSidebar(true);

              } catch (err) {
                console.error("Failed to import .dtex to database:", err);
                // Fallback: open as standalone
                openTab({
                  id: filePath,
                  title: filePath.split("/").pop() || "Untitled",
                  type: "editor",
                  content: dtexFile.content.latex,
                  language: "my-latex",
                  isDirty: false,
                  isDtexFile: true,
                  dtexMetadata: dtexFile.metadata,
                  metadataDirty: false,
                  dtexData: dtexFile,
                });
                setShowRightSidebar(true);
              }
            } else {
              console.error(
                "Collection not found or has no path:",
                collectionName,
              );
            }
          } else if (option.type === "create-database") {
            // Create database at original path
            const dbPath = dtexFile.database.path;
            const dbName = dtexFile.database.name;

            if (dbPath) {
              try {
                const { mkdir, writeTextFile } =
                  await import("@tauri-apps/plugin-fs");

                // 1. Create database folder if doesn't exist
                try {
                  await mkdir(dbPath, { recursive: true });
                } catch {
                  // Folder may already exist
                }

                // 2. Create collection
                await createCollection(dbName, dbPath);

                // Generate .tex filename
                const texFilename =
                  (dtexFile.metadata.id ||
                    filePath.split("/").pop()?.replace(".dtex", "")) + ".tex";
                const texPath = dbPath + "/" + texFilename;

                // 3. Save .tex file
                await writeTextFile(texPath, dtexFile.content.latex);

                // 4. Create resource
                await createResource(
                  texPath,
                  dbName,
                  dtexFile.content.latex,
                  dtexFile.metadata,
                );

                // 5. Refresh and open file
                await fetchResourcesForLoadedCollections();

                openTab({
                  id: texPath,
                  title: texFilename,
                  type: "editor",
                  content: dtexFile.content.latex,
                  language: "my-latex",
                  isDirty: false,
                });
                setShowRightSidebar(true);

              } catch (err) {
                console.error("Failed to create database:", err);
                // Fallback: open as standalone
                openTab({
                  id: filePath,
                  title: filePath.split("/").pop() || "Untitled",
                  type: "editor",
                  content: dtexFile.content.latex,
                  language: "my-latex",
                  isDirty: false,
                  isDtexFile: true,
                  dtexMetadata: dtexFile.metadata,
                  metadataDirty: false,
                  dtexData: dtexFile,
                });
                setShowRightSidebar(true);
              }
            } else {
              console.error("No database path specified in .dtex file");
            }
          }

          // Close modal
          setDtexImportModal({ opened: false, dtexFile: null, filePath: "" });
        }}
          />
        </Suspense>
      )}
    </MantineProvider>
  );
}
