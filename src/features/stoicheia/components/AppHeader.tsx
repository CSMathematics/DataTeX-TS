import { Check, ChevronDown, Clock, Code2, Command, Copy, Download, ExternalLink, FileCode2, FilePlus2, FolderOpen, Grid3x3, Hand, HelpCircle, Keyboard, Magnet, Moon, MousePointer2, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Redo2, Save, Settings as SettingsIcon, Tags, Trash2, Undo2, Zap, Sun } from 'lucide-react';
import { ToolType, useEditorStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AutosaveDraft, canUseNativeOpenTextFile, exportSvgFile, getAutosaveDraft, getRecentFiles, OpenTextFileResult, openTextFile, RecentFileSnapshot, rememberRecentFile, removeRecentFile, saveTextFile, SaveTarget } from '../files';
import { deleteNodeFromSource } from './nodeDeletion';
import { getNodeId } from './nodeIdentity';
import { GLOBAL_STYLE_DEFAULTS } from '../tikz/styleCommands';
import { getUiTranslation } from '../i18n';
import stoicheiaLogoUrl from '../assets/stoicheia-logo.svg';
import { isStoicheiaInteractionTarget } from '../bridge/focusScope';
import {
  copyableStoicheiaSource,
  type StoicheiaCopySourceMode,
} from '../bridge/copySource';

interface AppHeaderProps {
  mode?: 'standalone' | 'embedded';
  shortcutScopeRoot?: RefObject<HTMLElement | null>;
  onRequestApply?: (source: string) => void;
  onRequestSave?: (source: string) => void;
  onRequestSaveAs?: (source: string) => void;
  onRequestExportSvg?: (
    svgSource: string,
    suggestedFileName: string,
  ) => void;
  applyActionLabel?: string;
  copySourceMode?: StoicheiaCopySourceMode;
  showEditor: boolean;
  showInspector: boolean;
  sourcePanelMode: 'source' | 'styles';
  activePage: 'workspace' | 'settings';
  onOpenSettings: () => void;
  onOpenSource: () => void;
  onOpenStyles: () => void;
  onOpenCommandPalette: () => void;
  onToggleEditor: () => void;
  onToggleInspector: () => void;
}

const humanizeTool = (tool: ToolType, labels: Record<string, string>) => {
  if (labels[tool]) return labels[tool];
  return tool
    .replace(/^add_/, '')
    .replace(/^get_/, '')
    .split('_')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

const normalizeSvgDownloadName = (filename: string) => {
  const safeName = (filename.trim() || 'stoicheia.svg').replace(/[\\/:*?"<>|]+/g, '-');
  return /\.svg$/i.test(safeName) ? safeName : `${safeName}.svg`;
};

type AppMenu = 'file' | 'edit' | 'insert' | 'view' | 'styles' | 'help';

const isEditableShortcutTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  if (target.closest('.monaco-editor')) return true;

  const element = target as HTMLElement;
  if (element.isContentEditable) return true;

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'textarea' || tagName === 'select') return true;
  if (tagName !== 'input') return false;

  const inputType = ((target as HTMLInputElement).type || 'text').toLowerCase();
  return !['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit'].includes(inputType);
};

export function AppHeader({
  mode = 'standalone',
  shortcutScopeRoot,
  onRequestApply,
  onRequestSave,
  onRequestSaveAs,
  onRequestExportSvg,
  applyActionLabel = 'Apply to DataTeX',
  copySourceMode = 'document',
  showEditor,
  showInspector,
  sourcePanelMode,
  activePage,
  onOpenSettings,
  onOpenSource,
  onOpenStyles,
  onOpenCommandPalette,
  onToggleEditor,
  onToggleInspector,
}: AppHeaderProps) {
  const embedded = mode === 'embedded';
  const {
    isCompiling,
    errorLog,
    autosaveError,
    theme,
    setTheme,
    source,
    filename,
    setFilename,
    canUndoSource,
    canRedoSource,
    setSource,
    undoSource,
    redoSource,
    svgOutput,
    compiledSource,
    exportSvgFilename,
    previewMode,
    setPreviewMode,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    activeTool,
    setActiveTool,
    selectedPoints,
    setSelectedPoints,
    selectedNode,
    selectedAstNode,
    setSelectedNode,
    upsertStyleSetup,
    upsertCustomStyle,
    language,
  } = useEditorStore(useShallow(state => ({
    isCompiling: state.isCompiling,
    errorLog: state.errorLog,
    autosaveError: state.autosaveError,
    theme: state.theme,
    setTheme: state.setTheme,
    source: state.source,
    filename: state.documentFilename,
    setFilename: state.setDocumentFilename,
    canUndoSource: state.sourceHistory.length > 0,
    canRedoSource: state.sourceRedoStack.length > 0,
    setSource: state.setSource,
    undoSource: state.undoSource,
    redoSource: state.redoSource,
    svgOutput: state.svgOutput,
    compiledSource: state.compiledSource,
    exportSvgFilename: state.settings.exportSvgFilename,
    previewMode: state.previewMode,
    setPreviewMode: state.setPreviewMode,
    showGrid: state.showGrid,
    setShowGrid: state.setShowGrid,
    snapToGrid: state.snapToGrid,
    setSnapToGrid: state.setSnapToGrid,
    activeTool: state.activeTool,
    setActiveTool: state.setActiveTool,
    selectedPoints: state.selectedPoints,
    setSelectedPoints: state.setSelectedPoints,
    selectedNode: state.selectedNode,
    selectedAstNode: state.selectedNode
      ? state.parsedNodes.find(node => getNodeId(node) === state.selectedNode) ?? null
      : null,
    setSelectedNode: state.setSelectedNode,
    upsertStyleSetup: state.upsertStyleSetup,
    upsertCustomStyle: state.upsertCustomStyle,
    language: state.settings.language,
  })));
  const t = getUiTranslation(language).header;
  const [openMenu, setOpenMenu] = useState<AppMenu | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [savedSource, setSavedSource] = useState(source);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFileSnapshot[]>([]);
  const [autosaveDraft, setAutosaveDraft] = useState<AutosaveDraft | null>(null);
  const saveTargetRef = useRef<SaveTarget>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const sourceRef = useRef(source);
  const saveMessageTimeoutRef = useRef<number | null>(null);
  const menuTriggerRefs = useRef<Partial<Record<AppMenu, HTMLButtonElement | null>>>({});
  sourceRef.current = source;
  const isDirty = source !== savedSource;
  const canExportExactSvg = Boolean(
    onRequestExportSvg &&
      svgOutput &&
      compiledSource === source &&
      !isCompiling,
  );
  const activeToolLabel = humanizeTool(activeTool, t.toolLabels);
  const sourcePanelLabel = sourcePanelMode === 'source' ? t.view.sourceEditor : t.view.styleManager;

  const setMenuTriggerRef = (menu: AppMenu) => (node: HTMLButtonElement | null) => {
    menuTriggerRefs.current[menu] = node;
  };

  const positionMenu = useCallback((menu: AppMenu) => {
    const trigger = menuTriggerRefs.current[menu];
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = menu === 'file' || menu === 'edit' ? 232 : 264;
    const viewportPadding = 8;
    const scopeBounds = headerRef.current
      ?.closest('.stoicheia-scope')
      ?.getBoundingClientRect();
    const minimumLeft = (scopeBounds?.left ?? 0) + viewportPadding;
    const maximumRight = (scopeBounds?.right ?? window.innerWidth) - viewportPadding;
    const left = Math.max(
      minimumLeft,
      Math.min(rect.left, maximumRight - menuWidth),
    );
    setMenuPosition({ top: Math.round(rect.bottom + 2), left: Math.round(left) });
  }, []);

  const toggleMenu = (menu: AppMenu) => {
    if (openMenu === menu) {
      setOpenMenu(null);
      setMenuPosition(null);
      return;
    }
    positionMenu(menu);
    setOpenMenu(menu);
    if (menu === 'file' && !embedded) refreshFileSnapshots();
  };

  const getMenuStyle = (menu: AppMenu) => (
    openMenu === menu && menuPosition
      ? { top: menuPosition.top, left: menuPosition.left }
      : undefined
  );

  const clearSaveMessageTimeout = useCallback(() => {
    if (saveMessageTimeoutRef.current !== null) {
      window.clearTimeout(saveMessageTimeoutRef.current);
      saveMessageTimeoutRef.current = null;
    }
  }, []);

  const notify = useCallback((message: string) => {
    clearSaveMessageTimeout();
    setSaveMessage(message);
    saveMessageTimeoutRef.current = window.setTimeout(() => {
      setSaveMessage(null);
      saveMessageTimeoutRef.current = null;
    }, 4500);
  }, [clearSaveMessageTimeout]);

  const refreshFileSnapshots = useCallback(() => {
    setRecentFiles(getRecentFiles());
    setAutosaveDraft(getAutosaveDraft());
  }, []);

  const save = useCallback(async (saveAs = false) => {
    const currentSource = sourceRef.current;
    try {
      const target = await saveTextFile(currentSource, filename, saveAs ? null : saveTargetRef.current);
      if (target === null) return;
      saveTargetRef.current = target;
      const savedPath = typeof target === 'string' ? target : target.name;
      const savedFilename = savedPath?.split(/[\\/]/).pop();
      if (savedFilename) setFilename(savedFilename);
      setSavedSource(currentSource);
      rememberRecentFile(savedFilename ?? filename, currentSource, savedPath ?? savedFilename ?? filename);
      refreshFileSnapshots();
      notify(t.notifications.savedTo(savedPath ?? filename));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      notify(t.notifications.saveFailed);
    } finally {
      setOpenMenu(null);
    }
  }, [filename, notify, refreshFileSnapshots]);

  const exportSvg = useCallback(async () => {
    if (!svgOutput) return;
    try {
      const exportName = normalizeSvgDownloadName(exportSvgFilename);
      const result = await exportSvgFile(svgOutput, exportName);
      if (result.status === 'cancelled') return;
      notify(result.status === 'saved' ? t.notifications.exportedSvgTo(result.path) : t.notifications.exportedSvg);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      notify(t.notifications.exportSvgFailed);
    } finally {
      setOpenMenu(null);
    }
  }, [exportSvgFilename, notify, svgOutput]);

  const requestEmbeddedSvgExport = useCallback(() => {
    const state = useEditorStore.getState();
    if (
      !onRequestExportSvg ||
      !state.svgOutput ||
      state.compiledSource !== state.source ||
      state.isCompiling
    ) {
      return;
    }
    onRequestExportSvg(
      state.svgOutput,
      normalizeSvgDownloadName(state.settings.exportSvgFilename),
    );
    setOpenMenu(null);
  }, [onRequestExportSvg]);

  const copyText = async (contents: string, label: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error(t.notifications.clipboardUnavailable);
      await navigator.clipboard.writeText(contents);
      notify(t.notifications.copied(label));
    } catch {
      notify(t.notifications.copyFailed);
    } finally {
      setOpenMenu(null);
    }
  };

  const selectTool = (tool: ToolType) => {
    setActiveTool(tool);
    setOpenMenu(null);
  };

  const deleteSelectedNode = () => {
    if (!selectedAstNode) return;
    setSource(deleteNodeFromSource(source, selectedAstNode));
    setSelectedNode(null);
    setOpenMenu(null);
  };

  const undoSourceChange = () => {
    undoSource();
    setOpenMenu(null);
  };

  const redoSourceChange = () => {
    redoSource();
    setOpenMenu(null);
  };

  const openSource = () => {
    onOpenSource();
    setOpenMenu(null);
  };

  const openStyles = () => {
    onOpenStyles();
    setOpenMenu(null);
  };

  const openSettings = () => {
    setOpenMenu(null);
    onOpenSettings();
  };
  const openCommandPalette = () => {
    setOpenMenu(null);
    onOpenCommandPalette();
  };

  useEffect(() => clearSaveMessageTimeout, [clearSaveMessageTimeout]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        embedded &&
        !isStoicheiaInteractionTarget(
          event.target,
          shortcutScopeRoot?.current ?? null,
        )
      ) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        if (embedded) {
          event.preventDefault();
          if (event.repeat) return;
          if (event.shiftKey) {
            onRequestSaveAs?.(sourceRef.current);
            return;
          }
          if (!onRequestSave) return;
          onRequestSave(sourceRef.current);
          return;
        }
        event.preventDefault();
        if (event.repeat) return;
        void save(event.shiftKey);
      } else if (
        embedded &&
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'e'
      ) {
        event.preventDefault();
        if (event.repeat) return;
        requestEmbeddedSvgExport();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        if (isEditableShortcutTarget(event.target)) return;
        event.preventDefault();
        if (event.shiftKey) {
          redoSource();
        } else {
          undoSource();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        if (isEditableShortcutTarget(event.target)) return;
        event.preventDefault();
        redoSource();
      } else if (event.key === 'Escape') {
        setOpenMenu(null);
        setMenuPosition(null);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
        setMenuPosition(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [
    embedded,
    onRequestSave,
    onRequestSaveAs,
    redoSource,
    requestEmbeddedSvgExport,
    save,
    shortcutScopeRoot,
    undoSource,
  ]);

  useEffect(() => {
    if (!openMenu) return undefined;
    const updateMenuPosition = () => positionMenu(openMenu);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [openMenu, positionMenu]);

  const createNew = () => {
    if (isDirty && !window.confirm(t.prompts.discardUnsavedChanges)) return;
    setSource('');
    setSavedSource('');
    setFilename('source.tex');
    setSelectedNode(null);
    setSelectedPoints([]);
    saveTargetRef.current = null;
    setOpenMenu(null);
  };

  const loadOpenedDocument = (document: OpenTextFileResult) => {
    setSource(document.source);
    setSavedSource(document.source);
    setFilename(document.name);
    rememberRecentFile(document.name, document.source, document.id);
    refreshFileSnapshots();
    setSelectedNode(null);
    setSelectedPoints([]);
    saveTargetRef.current = document.target;
    setOpenMenu(null);
  };

  const restoreSnapshot = (snapshot: RecentFileSnapshot | AutosaveDraft) => {
    if (isDirty && !window.confirm(t.prompts.discardUnsavedChanges)) return;
    const restoredName = 'name' in snapshot ? snapshot.name : snapshot.filename;
    setSource(snapshot.source);
    setSavedSource(snapshot.source);
    setFilename(restoredName);
    setSelectedNode(null);
    setSelectedPoints([]);
    saveTargetRef.current = null;
    setOpenMenu(null);
    notify(t.notifications.restored(restoredName));
  };

  const openFromPicker = async () => {
    if (isDirty && !window.confirm(t.prompts.discardUnsavedChanges)) return;
    const nativeOpenAvailable = canUseNativeOpenTextFile();
    try {
      const opened = await openTextFile();
      if (opened) {
        loadOpenedDocument(opened);
        return;
      }
      if (!nativeOpenAvailable) fileInputRef.current?.click();
    } catch {
      if (!nativeOpenAvailable) fileInputRef.current?.click();
    } finally {
      setOpenMenu(null);
    }
  };

  const openFile = (file: File) => {
    if (isDirty && !window.confirm(t.prompts.discardUnsavedChanges)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const contents = String(reader.result ?? '');
      setSource(contents);
      setSavedSource(contents);
      setFilename(file.name);
      rememberRecentFile(file.name, contents, file.name);
      refreshFileSnapshots();
      setSelectedNode(null);
      setSelectedPoints([]);
      saveTargetRef.current = null;
    };
    reader.readAsText(file);
    setOpenMenu(null);
  };
  const addGlobalStyle = (kind: 'point' | 'line' | 'label') => {
    upsertStyleSetup(kind, GLOBAL_STYLE_DEFAULTS[kind], true);
    onOpenStyles();
    setOpenMenu(null);
  };
  const addHighlightStyle = () => {
    upsertCustomStyle('highlight', 'color=orange,line width=.8pt', true);
    onOpenStyles();
    setOpenMenu(null);
  };
  const togglePreviewMode = () => setPreviewMode(previewMode === 'instant' ? 'latex' : 'instant');
  const status = errorLog
    ? { label: t.status.compileError, dot: 'bg-rose-400', text: 'text-rose-300' }
    : isCompiling
      ? { label: t.status.compiling, dot: 'bg-amber-300 animate-pulse', text: 'text-amber-200' }
      : autosaveError
        ? { label: t.status.autosaveFailed, dot: 'bg-rose-400', text: 'text-rose-300' }
        : { label: t.status.ready, dot: 'bg-emerald-400', text: 'text-emerald-300' };

  if (embedded) {
    const copyCode = () => void copyText(
      copyableStoicheiaSource(sourceRef.current, copySourceMode),
      copySourceMode === 'tikzpicture' ? 'TikZ code' : t.notifications.sourceLabel,
    );

    return (
      <header
        ref={headerRef}
        className="theme-chrome app-titlebar stoicheia-embedded-toolbar relative shrink-0 border-b flex items-center z-[200]"
        aria-label="Stoicheia workspace toolbar"
      >
        <div className="stoicheia-embedded-toolbar-scroll flex min-w-0 flex-1 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleEditor}
            title={showEditor ? t.hideSourceEditor : t.showSourceEditor}
            aria-label={showEditor ? t.hideSourceEditor : t.showSourceEditor}
            aria-pressed={showEditor}
            className={`app-icon-button app-icon-button-compact ${showEditor ? 'app-icon-button-active' : ''}`}
          >
            {showEditor ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
          <button type="button" className="app-icon-button app-icon-button-compact" disabled={!canUndoSource} onClick={undoSourceChange} title={t.edit.undo} aria-label={t.edit.undo}>
            <Undo2 size={15} />
          </button>
          <button type="button" className="app-icon-button app-icon-button-compact" disabled={!canRedoSource} onClick={redoSourceChange} title={t.edit.redo} aria-label={t.edit.redo}>
            <Redo2 size={15} />
          </button>
          <span className="theme-divider h-5 w-px mx-0.5 shrink-0" aria-hidden="true" />
          <button type="button" className="app-state-chip" onClick={sourcePanelMode === 'source' ? openStyles : openSource} title={sourcePanelMode === 'source' ? t.openStyleManager : t.openSourceEditor}>
            {sourcePanelMode === 'source' ? <Palette size={14} /> : <Code2 size={14} />}
            <span>{sourcePanelLabel}</span>
          </button>
          <button type="button" aria-label={t.switchPreview(previewMode === 'instant' ? 'LaTeX' : 'fast')} className={`app-state-chip ${previewMode === 'latex' ? 'app-state-chip-accent' : ''}`} onClick={togglePreviewMode}>
            {previewMode === 'instant' ? <Zap size={14} /> : <FileCode2 size={14} />}
            <span>{previewMode === 'instant' ? 'Instant' : 'LaTeX'}</span>
          </button>
          <button type="button" aria-label={t.toggleCanvasGrid} aria-pressed={showGrid} className={`app-icon-button app-icon-button-compact ${showGrid ? 'app-icon-button-active' : ''}`} onClick={() => setShowGrid(!showGrid)} title={showGrid ? t.hideCanvasGrid : t.showCanvasGrid}>
            <Grid3x3 size={15} />
          </button>
          <button type="button" aria-label={t.toggleSnapToGrid} aria-pressed={snapToGrid} className={`app-icon-button app-icon-button-compact ${snapToGrid ? 'app-icon-button-active' : ''}`} onClick={() => setSnapToGrid(!snapToGrid)} title={snapToGrid ? t.disableSnapToGrid : t.enableSnapToGrid}>
            <Magnet size={15} />
          </button>
          <span className="theme-divider h-5 w-px mx-0.5 shrink-0" aria-hidden="true" />
          <button type="button" className="app-state-chip" onClick={copyCode} aria-label="Copy code" title={copySourceMode === 'tikzpicture' ? 'Copy only the TikZ environment' : 'Copy LaTeX source'}>
            <Copy size={14} />
            <span>Copy code</span>
          </button>
          <button type="button" className="app-icon-button app-icon-button-compact" disabled={!canExportExactSvg} onClick={requestEmbeddedSvgExport} aria-label="Export exact SVG" title={canExportExactSvg ? t.file.exportSvg : 'Compile the current source in LaTeX preview before exporting'}>
            <Download size={15} />
          </button>
          <button type="button" className="app-icon-button app-icon-button-compact" disabled={!onRequestSaveAs} onClick={() => onRequestSaveAs?.(sourceRef.current)} aria-label="Save as through DataTeX" title={t.file.saveAs}>
            <FilePlus2 size={15} />
          </button>
          <button type="button" className="app-state-chip disabled:cursor-not-allowed disabled:opacity-50" disabled={!onRequestSave} aria-label="Save through DataTeX" title="Save the reviewed drawing through DataTeX" onClick={() => onRequestSave?.(sourceRef.current)}>
            <Save size={14} />
            <span>Save</span>
          </button>
          <button type="button" className="app-state-chip app-state-chip-accent disabled:cursor-not-allowed disabled:opacity-50" disabled={!onRequestApply} aria-label={applyActionLabel} title={onRequestApply ? applyActionLabel : 'Open a LaTeX document to enable this action'} onClick={() => onRequestApply?.(sourceRef.current)}>
            <Check size={14} />
            <span>{applyActionLabel}</span>
          </button>
          <button type="button" onClick={onToggleInspector} title={showInspector ? t.hideInspector : t.showInspector} aria-label={showInspector ? t.hideInspector : t.showInspector} aria-pressed={showInspector} className={`app-icon-button app-icon-button-compact ${showInspector ? 'app-icon-button-active' : ''}`}>
            {showInspector ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
        </div>
        {saveMessage && <div role="status" className={`app-save-toast ${saveMessage.includes('failed') ? 'app-save-toast-error' : 'app-save-toast-success'}`}><Save size={15} /><span>{saveMessage}</span></div>}
      </header>
    );
  }

  return (
    <header ref={headerRef} className="theme-chrome app-titlebar relative shrink-0 border-b flex items-center z-[200]">
      <div className="app-brand flex items-center gap-2 min-w-0">
        <img src={stoicheiaLogoUrl} alt="" className="app-brand-logo" />
        <div className="leading-tight">
          <div className="app-brand-name">Stoicheia</div>
          <div className="app-brand-subtitle">{t.brandSubtitle}</div>
        </div>
      </div>

      <div className="theme-divider h-5 w-px mx-1" />

      <nav aria-label={t.applicationMenu} className="flex items-center gap-1 self-stretch">
        <div className="app-menu-wrap">
          <button ref={setMenuTriggerRef('file')} type="button" className="app-menu-trigger" aria-haspopup="menu" aria-expanded={openMenu === 'file'} onClick={() => toggleMenu('file')}>
            {t.menus.file} <ChevronDown size={13} />
          </button>
          {openMenu === 'file' && (
            <div role="menu" className="app-menu-popover" style={getMenuStyle('file')}>
              {!embedded && (
                <>
                  <button role="menuitem" type="button" onClick={createNew}><FilePlus2 size={15} /><span>{t.file.new}</span></button>
                  <button role="menuitem" type="button" onClick={() => void openFromPicker()}><FolderOpen size={15} /><span>{t.file.open}</span></button>
                  <div className="app-menu-separator" />
                  <button role="menuitem" type="button" onClick={() => void save(false)}><Save size={15} /><span>{t.file.save}</span><kbd>Ctrl+S</kbd></button>
                  <button role="menuitem" type="button" onClick={() => void save(true)}><Save size={15} /><span>{t.file.saveAs}</span><kbd>Ctrl+Shift+S</kbd></button>
                  <button role="menuitem" type="button" disabled={!svgOutput} onClick={() => void exportSvg()}><Download size={15} /><span>{t.file.exportSvg}</span></button>
                  {(autosaveDraft || recentFiles.length > 0) && <div className="app-menu-separator" />}
                  {autosaveDraft && (
                    <button role="menuitem" type="button" onClick={() => restoreSnapshot(autosaveDraft)}><Clock size={15} /><span>{t.file.restoreAutosave}</span><kbd>{new Date(autosaveDraft.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</kbd></button>
                  )}
                  {recentFiles.length > 0 && (
                    <div className="app-menu-section">
                      <div className="app-menu-section-title">{t.file.recentFiles}</div>
                      {recentFiles.map(snapshot => (
                        <button key={snapshot.id} role="menuitem" type="button" onClick={() => restoreSnapshot(snapshot)}><FileCode2 size={15} /><span className="truncate">{snapshot.name}</span><kbd>{new Date(snapshot.updatedAt).toLocaleDateString()}</kbd></button>
                      ))}
                      <button role="menuitem" type="button" onClick={() => { recentFiles.forEach(snapshot => removeRecentFile(snapshot.id)); refreshFileSnapshots(); }}><Trash2 size={15} /><span>{t.file.clearRecentFiles}</span></button>
                    </div>
                  )}
                </>
              )}
              {embedded && (
                <>
                  <button
                    role="menuitem"
                    type="button"
                    disabled={!onRequestSave}
                    onClick={() => {
                      onRequestSave?.(sourceRef.current);
                      setOpenMenu(null);
                    }}
                  >
                    <Save size={15} />
                    <span>{t.file.save}</span>
                    <kbd>Ctrl+S</kbd>
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    disabled={!onRequestSaveAs}
                    onClick={() => {
                      onRequestSaveAs?.(sourceRef.current);
                      setOpenMenu(null);
                    }}
                  >
                    <Save size={15} />
                    <span>{t.file.saveAs}</span>
                    <kbd>Ctrl+Shift+S</kbd>
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    disabled={!canExportExactSvg}
                    title={
                      canExportExactSvg
                        ? t.file.exportSvg
                        : "Compile the current source in LaTeX preview before exporting"
                    }
                    onClick={requestEmbeddedSvgExport}
                  >
                    <Download size={15} />
                    <span>{t.file.exportSvg}</span>
                    <kbd>Ctrl+Shift+E</kbd>
                  </button>
                  <div className="app-menu-separator" />
                </>
              )}
              {!embedded && <div className="app-menu-separator" />}
              <button role="menuitem" type="button" onClick={() => void copyText(source, t.notifications.sourceLabel)}><Copy size={15} /><span>{t.file.copySource}</span></button>
              <button role="menuitem" type="button" disabled={!svgOutput} onClick={() => svgOutput && void copyText(svgOutput, t.notifications.svgLabel)}><Copy size={15} /><span>{t.file.copySvg}</span></button>
            </div>
          )}
        </div>
        <div className="app-menu-wrap">
          <button ref={setMenuTriggerRef('edit')} type="button" className="app-menu-trigger" aria-haspopup="menu" aria-expanded={openMenu === 'edit'} onClick={() => toggleMenu('edit')}>
            {t.menus.edit} <ChevronDown size={13} />
          </button>
          {openMenu === 'edit' && (
            <div role="menu" className="app-menu-popover" style={getMenuStyle('edit')}>
              <button role="menuitem" type="button" disabled={!canUndoSource} onClick={undoSourceChange}><Undo2 size={15} /><span>{t.edit.undo}</span><kbd>Ctrl+Z</kbd></button>
              <button role="menuitem" type="button" disabled={!canRedoSource} onClick={redoSourceChange}><Redo2 size={15} /><span>{t.edit.redo}</span><kbd>Ctrl+Shift+Z</kbd></button>
              <div className="app-menu-separator" />
              <button role="menuitemradio" aria-checked={activeTool === 'cursor'} type="button" onClick={() => selectTool('cursor')}><MousePointer2 size={15} /><span>{t.edit.selectionTool}</span><span className="app-menu-check">{activeTool === 'cursor' ? '✓' : ''}</span></button>
              <button role="menuitemradio" aria-checked={activeTool === 'pan'} type="button" onClick={() => selectTool('pan')}><Hand size={15} /><span>{t.edit.panTool}</span><span className="app-menu-check">{activeTool === 'pan' ? '✓' : ''}</span></button>
              <div className="app-menu-separator" />
              <button role="menuitem" type="button" disabled={!selectedPoints.length} onClick={() => { setSelectedPoints([]); setOpenMenu(null); }}><MousePointer2 size={15} /><span>{t.edit.clearSelectedPoints}</span><kbd>{selectedPoints.length}</kbd></button>
              <button role="menuitem" type="button" disabled={!selectedNode} onClick={() => { setSelectedNode(null); setOpenMenu(null); }}><Tags size={15} /><span>{t.edit.clearSelectedObject}</span></button>
              <button role="menuitem" type="button" disabled={!selectedAstNode} onClick={deleteSelectedNode}><Trash2 size={15} /><span>{t.edit.deleteSelectedObject}</span></button>
            </div>
          )}
        </div>
        <div className="app-menu-wrap">
          <button ref={setMenuTriggerRef('insert')} type="button" className="app-menu-trigger" aria-haspopup="menu" aria-expanded={openMenu === 'insert'} onClick={() => toggleMenu('insert')}>
            {t.menus.insert} <ChevronDown size={13} />
          </button>
          {openMenu === 'insert' && (
            <div role="menu" className="app-menu-popover app-menu-popover-wide" style={getMenuStyle('insert')}>
              <button role="menuitemradio" aria-checked={activeTool === 'add_point'} type="button" onClick={() => selectTool('add_point')}><MousePointer2 size={15} /><span>{t.insert.cartesianPoint}</span><span className="app-menu-check">{activeTool === 'add_point' ? '✓' : ''}</span></button>
              <button role="menuitemradio" aria-checked={activeTool === 'add_segment'} type="button" onClick={() => selectTool('add_segment')}><Code2 size={15} /><span>{t.insert.segment}</span><span className="app-menu-check">{activeTool === 'add_segment' ? '✓' : ''}</span></button>
              <button role="menuitemradio" aria-checked={activeTool === 'add_line'} type="button" onClick={() => selectTool('add_line')}><Code2 size={15} /><span>{t.insert.line}</span><span className="app-menu-check">{activeTool === 'add_line' ? '✓' : ''}</span></button>
              <button role="menuitemradio" aria-checked={activeTool === 'add_circle'} type="button" onClick={() => selectTool('add_circle')}><Code2 size={15} /><span>{t.insert.circle}</span><span className="app-menu-check">{activeTool === 'add_circle' ? '✓' : ''}</span></button>
              <button role="menuitemradio" aria-checked={activeTool === 'add_polygon'} type="button" onClick={() => selectTool('add_polygon')}><Code2 size={15} /><span>{t.insert.polygon}</span><span className="app-menu-check">{activeTool === 'add_polygon' ? '✓' : ''}</span></button>
              <button role="menuitemradio" aria-checked={activeTool === 'label_point'} type="button" onClick={() => selectTool('label_point')}><Tags size={15} /><span>{t.insert.pointLabel}</span><span className="app-menu-check">{activeTool === 'label_point' ? '✓' : ''}</span></button>
            </div>
          )}
        </div>
        <div className="app-menu-wrap">
          <button ref={setMenuTriggerRef('view')} type="button" className="app-menu-trigger" aria-haspopup="menu" aria-expanded={openMenu === 'view'} onClick={() => toggleMenu('view')}>
            {t.menus.view} <ChevronDown size={13} />
          </button>
          {openMenu === 'view' && (
            <div role="menu" className="app-menu-popover app-menu-popover-wide" style={getMenuStyle('view')}>
              <button role="menuitemcheckbox" aria-checked={showEditor && sourcePanelMode === 'source'} type="button" onClick={openSource}><Code2 size={15} /><span>{t.view.sourceEditor}</span><span className="app-menu-check">{showEditor && sourcePanelMode === 'source' ? '✓' : ''}</span></button>
              <button role="menuitemcheckbox" aria-checked={showEditor && sourcePanelMode === 'styles'} type="button" onClick={openStyles}><Palette size={15} /><span>{t.view.styleManager}</span><span className="app-menu-check">{showEditor && sourcePanelMode === 'styles' ? '✓' : ''}</span></button>
              <button role="menuitemcheckbox" aria-checked={showInspector} type="button" onClick={() => { onToggleInspector(); setOpenMenu(null); }}><PanelRightOpen size={15} /><span>{t.view.inspector}</span><span className="app-menu-check">{showInspector ? '✓' : ''}</span></button>
              <div className="app-menu-separator" />
              <button role="menuitemradio" aria-checked={previewMode === 'instant'} type="button" onClick={() => { setPreviewMode('instant'); setOpenMenu(null); }}><Zap size={15} /><span>{t.view.fastPreview}</span><span className="app-menu-check">{previewMode === 'instant' ? '✓' : ''}</span></button>
              <button role="menuitemradio" aria-checked={previewMode === 'latex'} type="button" onClick={() => { setPreviewMode('latex'); setOpenMenu(null); }}><FileCode2 size={15} /><span>{t.view.latexPreview}</span><span className="app-menu-check">{previewMode === 'latex' ? '✓' : ''}</span></button>
              <div className="app-menu-separator" />
              <button role="menuitemcheckbox" aria-checked={showGrid} type="button" onClick={() => { setShowGrid(!showGrid); setOpenMenu(null); }}><Grid3x3 size={15} /><span>{t.view.canvasGrid}</span><span className="app-menu-check">{showGrid ? '✓' : ''}</span></button>
              <button role="menuitemcheckbox" aria-checked={snapToGrid} type="button" onClick={() => { setSnapToGrid(!snapToGrid); setOpenMenu(null); }}><Magnet size={15} /><span>{t.view.snapToGrid}</span><span className="app-menu-check">{snapToGrid ? '✓' : ''}</span></button>
            </div>
          )}
        </div>
        <div className="app-menu-wrap">
          <button ref={setMenuTriggerRef('styles')} type="button" className="app-menu-trigger" aria-haspopup="menu" aria-expanded={openMenu === 'styles'} onClick={() => toggleMenu('styles')}>
            {t.menus.styles} <ChevronDown size={13} />
          </button>
          {openMenu === 'styles' && (
            <div role="menu" className="app-menu-popover app-menu-popover-wide" style={getMenuStyle('styles')}>
              <button role="menuitem" type="button" onClick={openStyles}><Palette size={15} /><span>{t.styles.openStyleManager}</span></button>
              <div className="app-menu-separator" />
              <button role="menuitem" type="button" onClick={() => addGlobalStyle('point')}><MousePointer2 size={15} /><span>{t.styles.enablePointDefaults}</span></button>
              <button role="menuitem" type="button" onClick={() => addGlobalStyle('line')}><Code2 size={15} /><span>{t.styles.enableLineDefaults}</span></button>
              <button role="menuitem" type="button" onClick={() => addGlobalStyle('label')}><Tags size={15} /><span>{t.styles.enableLabelDefaults}</span></button>
              <button role="menuitem" type="button" onClick={addHighlightStyle}><Palette size={15} /><span>{t.styles.createHighlightStyle}</span></button>
            </div>
          )}
        </div>
        <div className="app-menu-wrap">
          <button ref={setMenuTriggerRef('help')} type="button" className="app-menu-trigger" aria-haspopup="menu" aria-expanded={openMenu === 'help'} onClick={() => toggleMenu('help')}>
            {t.menus.help} <ChevronDown size={13} />
          </button>
          {openMenu === 'help' && (
            <div role="menu" className="app-menu-popover app-menu-popover-wide" style={getMenuStyle('help')}>
              <button role="menuitem" type="button" onClick={openCommandPalette}><Command size={15} /><span>{t.help.commandPalette}</span><kbd>Ctrl+K</kbd></button>
              <button role="menuitem" type="button" onClick={() => { notify(t.help.shortcutsToast); setOpenMenu(null); }}><Keyboard size={15} /><span>{t.help.keyboardShortcuts}</span></button>
              <button role="menuitem" type="button" onClick={openSettings}><SettingsIcon size={15} /><span>{t.help.latexTroubleshooting}</span></button>
              <button role="menuitem" type="button" onClick={() => { window.open('https://ctan.org/pkg/tkz-euclide', '_blank', 'noopener,noreferrer'); setOpenMenu(null); }}><ExternalLink size={15} /><span>{t.help.tkzDocs}</span></button>
              <button role="menuitem" type="button" onClick={() => { notify(t.help.aboutToast); setOpenMenu(null); }}><HelpCircle size={15} /><span>{t.help.about}</span></button>
            </div>
          )}
        </div>
        <button
          type="button"
          className={`app-menu-trigger ${activePage === 'settings' ? 'app-menu-trigger-active' : ''}`}
          aria-current={activePage === 'settings' ? 'page' : undefined}
          onClick={openSettings}
        >
          <SettingsIcon size={13} />
          {t.settings}
        </button>
        <button
          type="button"
          className="app-menu-trigger"
          onClick={openCommandPalette}
        >
          <Command size={13} />
          {t.command}
          <kbd className="app-menu-trigger-kbd">Ctrl K</kbd>
        </button>
      </nav>

      {!embedded && (
        <input ref={fileInputRef} type="file" accept=".tex,text/x-tex,application/x-tex,text/plain" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) openFile(file); event.target.value = ''; }} />
      )}

      <button
        type="button"
        onClick={onToggleEditor}
        title={showEditor ? t.hideSourceEditor : t.showSourceEditor}
        aria-pressed={showEditor}
        className={`app-icon-button ${showEditor ? 'app-icon-button-active' : ''}`}
      >
        {showEditor ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
      </button>
      <div className={`app-file-pill hidden sm:flex ${isDirty ? 'app-file-pill-dirty' : ''}`} title={isDirty ? `${filename} • Unsaved changes` : filename} aria-label={isDirty ? `${filename} unsaved changes` : filename}>
        <span className="app-file-dot" />
        <Code2 size={13} />
        <span className="truncate">{filename}</span>
        {isDirty && <span className="app-file-dirty-mark" aria-hidden="true">*</span>}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {embedded && (
          <>
            <button
              type="button"
              className="app-state-chip disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!onRequestSave}
              aria-label="Save through DataTeX"
              title="Review pending drawing changes, then save through DataTeX"
              onClick={() => onRequestSave?.(sourceRef.current)}
            >
              <Save size={14} />
              <span>Save</span>
            </button>
            <button
              type="button"
              className="app-state-chip app-state-chip-accent disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!onRequestApply}
              aria-label="Apply changes to DataTeX"
              title={
                onRequestApply
                  ? "Review changes in DataTeX"
                  : "The reviewed document bridge is enabled in the next integration phase"
              }
              onClick={() => onRequestApply?.(sourceRef.current)}
            >
              <Check size={14} />
              <span>Apply to DataTeX</span>
            </button>
          </>
        )}
        <div className="hidden items-center gap-1 lg:flex">
          <button type="button" className="app-state-chip" title={t.activeTool(activeToolLabel)} onClick={() => selectTool(activeTool === 'cursor' ? 'pan' : 'cursor')}>
            {activeTool === 'pan' ? <Hand size={14} /> : <MousePointer2 size={14} />}
            <span>{activeToolLabel}</span>
          </button>
          <button type="button" aria-label={t.switchPreview(previewMode === 'instant' ? 'LaTeX' : 'fast')} className={`app-state-chip ${previewMode === 'latex' ? 'app-state-chip-accent' : ''}`} onClick={togglePreviewMode}>
            {previewMode === 'instant' ? <Zap size={14} /> : <FileCode2 size={14} />}
            <span>{previewMode === 'instant' ? 'Instant' : 'LaTeX'}</span>
          </button>
          <button type="button" aria-label={t.toggleCanvasGrid} aria-pressed={showGrid} className={`app-icon-button app-icon-button-compact ${showGrid ? 'app-icon-button-active' : ''}`} onClick={() => setShowGrid(!showGrid)} title={showGrid ? t.hideCanvasGrid : t.showCanvasGrid}>
            <Grid3x3 size={15} />
          </button>
          <button type="button" aria-label={t.toggleSnapToGrid} aria-pressed={snapToGrid} className={`app-icon-button app-icon-button-compact ${snapToGrid ? 'app-icon-button-active' : ''}`} onClick={() => setSnapToGrid(!snapToGrid)} title={snapToGrid ? t.disableSnapToGrid : t.enableSnapToGrid}>
            <Magnet size={15} />
          </button>
          <button type="button" aria-label={sourcePanelMode === 'source' ? t.openStyleManager : t.openSourceEditor} className="app-state-chip" onClick={sourcePanelMode === 'source' ? openStyles : openSource} title={sourcePanelMode === 'source' ? t.openStyleManager : t.openSourceEditor}>
            {sourcePanelMode === 'source' ? <Palette size={14} /> : <Code2 size={14} />}
            <span>{sourcePanelLabel}</span>
          </button>
        </div>
        {saveMessage && <div role="status" className={`app-save-toast ${saveMessage.includes('failed') ? 'app-save-toast-error' : 'app-save-toast-success'}`}><Save size={15} /><span>{saveMessage}</span></div>}
        <div className={`app-status-pill hidden sm:flex ${status.text}`} title={autosaveError && !errorLog && !isCompiling ? autosaveError : undefined}>
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          {status.label}
        </div>
        {!embedded && (
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={t.switchTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={t.switchTheme(theme === 'dark' ? 'light' : 'dark')}
            className="app-icon-button"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleInspector}
          title={showInspector ? t.hideInspector : t.showInspector}
          aria-pressed={showInspector}
          className={`app-icon-button ${showInspector ? 'app-icon-button-active' : ''}`}
        >
          {showInspector ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
        </button>
      </div>
    </header>
  );
}
