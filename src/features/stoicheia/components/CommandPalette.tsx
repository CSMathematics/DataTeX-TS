import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Command, Eye, FileCode2, Grid3x3, Magnet, Palette, PanelLeftOpen, PanelRightOpen, Search, Settings, Zap } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { type ToolType, useEditorStore } from '../store';
import { getTranslatedToolbarGroups } from './Toolbar';
import { getUiTranslation } from '../i18n';

type CommandAction = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  keywords: string;
  icon: ReactNode;
  shortcut?: string;
  run: () => void;
};

interface CommandPaletteProps {
  open: boolean;
  showEditor: boolean;
  showInspector: boolean;
  onClose: () => void;
  onOpenWorkspace: () => void;
  onOpenSource: () => void;
  onOpenStyles: () => void;
  onOpenSettings: () => void;
  onToggleEditor: () => void;
  onToggleInspector: () => void;
}

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const dispatchToolSelection = (tool: ToolType) => {
  window.dispatchEvent(new CustomEvent('stoicheia:select-tool', { detail: { tool } }));
};

export function CommandPalette({
  open,
  showEditor,
  showInspector,
  onClose,
  onOpenWorkspace,
  onOpenSource,
  onOpenStyles,
  onOpenSettings,
  onToggleEditor,
  onToggleInspector,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const {
    activeTool,
    setActiveTool,
    previewMode,
    setPreviewMode,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    showHandles,
    setShowHandles,
    language,
  } = useEditorStore(useShallow(state => ({
    activeTool: state.activeTool,
    setActiveTool: state.setActiveTool,
    previewMode: state.previewMode,
    setPreviewMode: state.setPreviewMode,
    showGrid: state.showGrid,
    setShowGrid: state.setShowGrid,
    snapToGrid: state.snapToGrid,
    setSnapToGrid: state.setSnapToGrid,
    showHandles: state.showHandles,
    setShowHandles: state.setShowHandles,
    language: state.settings.language,
  })));
  const t = getUiTranslation(language).commandPalette;
  const translatedToolbarGroups = useMemo(() => getTranslatedToolbarGroups(language), [language]);

  const closeAfter = (action: () => void) => {
    action();
    onClose();
  };

  const selectInteractiveTool = (tool: ToolType) => {
    onOpenWorkspace();
    setActiveTool(tool);
    window.setTimeout(() => dispatchToolSelection(tool), 0);
  };

  const actions = useMemo<CommandAction[]>(() => {
    const toolActions: CommandAction[] = translatedToolbarGroups.flatMap(group => group.tools.map(tool => {
      const sectionLabel = group.sections?.find(section => section.tools.some(sectionTool => sectionTool.id === tool.id))?.label;
      const location = sectionLabel ? `${group.label} / ${sectionLabel}` : group.label;
      return {
        id: `tool:${tool.id}`,
        title: tool.label,
        subtitle: `${location} - ${tool.description}`,
        category: t.categories.tools,
        keywords: `${tool.id} ${tool.label} ${tool.description} ${group.label} ${sectionLabel ?? ''}`,
        icon: tool.icon,
        run: () => selectInteractiveTool(tool.id),
      };
    }));
    const actionCopy = (id: string, fallback: { title: string; subtitle: string; keywords: string }) => t.actions[id] ?? fallback;

    return [
      {
        id: 'workspace:source',
        ...actionCopy('workspace:source', {
          title: 'Open source editor',
          subtitle: showEditor ? 'Focus the source panel' : 'Show the source panel',
          keywords: 'source editor latex tex code panel',
        }),
        category: t.categories.workspace,
        icon: <PanelLeftOpen size={16} />,
        run: onOpenSource,
      },
      {
        id: 'workspace:styles',
        ...actionCopy('workspace:styles', {
          title: 'Open style manager',
          subtitle: 'Edit global tkz-euclide style presets',
          keywords: 'styles style manager global colors line point label',
        }),
        category: t.categories.workspace,
        icon: <Palette size={16} />,
        run: onOpenStyles,
      },
      {
        id: 'workspace:settings',
        ...actionCopy('workspace:settings', {
          title: 'Open settings',
          subtitle: 'Editor, canvas, LaTeX and export preferences',
          keywords: 'settings preferences options latex export editor canvas',
        }),
        category: t.categories.workspace,
        icon: <Settings size={16} />,
        shortcut: 'Ctrl+,',
        run: onOpenSettings,
      },
      {
        id: 'workspace:editor-toggle',
        ...actionCopy('workspace:editor-toggle', {
          title: showEditor ? 'Hide source panel' : 'Show source panel',
          subtitle: 'Toggle the editor/style sidebar',
          keywords: 'toggle source editor sidebar panel',
        }),
        category: t.categories.workspace,
        icon: <PanelLeftOpen size={16} />,
        run: onToggleEditor,
      },
      {
        id: 'workspace:inspector-toggle',
        ...actionCopy('workspace:inspector-toggle', {
          title: showInspector ? 'Hide inspector' : 'Show inspector',
          subtitle: 'Toggle the object tree and properties panel',
          keywords: 'toggle inspector properties object tree sidebar',
        }),
        category: t.categories.workspace,
        icon: <PanelRightOpen size={16} />,
        run: onToggleInspector,
      },
      {
        id: 'preview:instant',
        ...actionCopy('preview:instant', {
          title: 'Use fast preview',
          subtitle: 'Switch to the internal renderer',
          keywords: 'instant fast preview renderer',
        }),
        category: t.categories.preview,
        icon: <Zap size={16} />,
        run: () => setPreviewMode('instant'),
      },
      {
        id: 'preview:latex',
        ...actionCopy('preview:latex', {
          title: 'Use LaTeX preview',
          subtitle: 'Switch to compiled LaTeX output',
          keywords: 'latex preview compile dvisvgm',
        }),
        category: t.categories.preview,
        icon: <FileCode2 size={16} />,
        run: () => setPreviewMode('latex'),
      },
      {
        id: 'canvas:grid',
        ...actionCopy('canvas:grid', {
          title: showGrid ? 'Hide canvas grid' : 'Show canvas grid',
          subtitle: 'Toggle the drawing grid',
          keywords: 'grid canvas show hide',
        }),
        category: t.categories.canvas,
        icon: <Grid3x3 size={16} />,
        run: () => setShowGrid(!showGrid),
      },
      {
        id: 'canvas:snap',
        ...actionCopy('canvas:snap', {
          title: snapToGrid ? 'Disable snap to grid' : 'Enable snap to grid',
          subtitle: 'Toggle point snapping while drawing',
          keywords: 'snap grid magnet point drawing',
        }),
        category: t.categories.canvas,
        icon: <Magnet size={16} />,
        run: () => setSnapToGrid(!snapToGrid),
      },
      {
        id: 'canvas:handles',
        ...actionCopy('canvas:handles', {
          title: showHandles ? 'Hide point handles' : 'Show point handles',
          subtitle: 'Toggle draggable point handles',
          keywords: 'handles points visible drag',
        }),
        category: t.categories.canvas,
        icon: <Eye size={16} />,
        run: () => setShowHandles(!showHandles),
      },
      {
        id: 'tool:cursor',
        ...actionCopy('tool:cursor', {
          title: 'Selection tool',
          subtitle: 'Return to select and move mode',
          keywords: 'cursor selection move select',
        }),
        category: t.categories.tools,
        icon: <Command size={16} />,
        run: () => {
          onOpenWorkspace();
          setActiveTool('cursor');
        },
      },
      {
        id: 'tool:pan',
        ...actionCopy('tool:pan', {
          title: 'Pan tool',
          subtitle: 'Drag the canvas with the left mouse button',
          keywords: 'pan hand move canvas',
        }),
        category: t.categories.tools,
        icon: <Command size={16} />,
        run: () => {
          onOpenWorkspace();
          setActiveTool('pan');
        },
      },
      ...toolActions,
    ];
  }, [
    onOpenSettings,
    onOpenSource,
    onOpenStyles,
    onOpenWorkspace,
    onToggleEditor,
    onToggleInspector,
    previewMode,
    setActiveTool,
    setPreviewMode,
    setShowGrid,
    setShowHandles,
    setSnapToGrid,
    showEditor,
    showGrid,
    showHandles,
    showInspector,
    snapToGrid,
    t,
    translatedToolbarGroups,
  ]);

  const filteredActions = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return actions;
    const terms = normalizedQuery.split(' ');
    return actions.filter(action => {
      const haystack = normalize(`${action.title} ${action.subtitle} ${action.category} ${action.keywords}`);
      return terms.every(term => haystack.includes(term));
    });
  }, [actions, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (selectedIndex >= filteredActions.length) setSelectedIndex(Math.max(0, filteredActions.length - 1));
  }, [filteredActions.length, selectedIndex]);

  if (!open) return null;

  const selectedAction = filteredActions[selectedIndex];
  const runAction = (action: CommandAction | undefined) => {
    if (!action) return;
    closeAfter(action.run);
  };

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t.ariaLabel}
        className="command-palette"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="command-palette-search">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex(index => Math.min(index + 1, filteredActions.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex(index => Math.max(index - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                runAction(selectedAction);
              }
            }}
            placeholder={t.placeholder}
            aria-label={t.placeholder}
          />
          <kbd>Ctrl K</kbd>
        </div>

        <div className="command-palette-list" role="listbox" aria-label={t.availableCommands}>
          {filteredActions.length ? filteredActions.map((action, index) => {
            const isActive = index === selectedIndex;
            const isCurrentTool = action.id === `tool:${activeTool}`;
            const isCurrentPreview =
              (action.id === 'preview:instant' && previewMode === 'instant') ||
              (action.id === 'preview:latex' && previewMode === 'latex');
            return (
              <button
                key={action.id}
                type="button"
                role="option"
                aria-selected={isActive}
                className="command-palette-item"
                data-active={isActive}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => runAction(action)}
              >
                <span className="command-palette-icon">{action.icon}</span>
                <span className="command-palette-copy">
                  <span className="command-palette-title">
                    {action.title}
                    {(isCurrentTool || isCurrentPreview) && <span className="command-palette-current">{t.active}</span>}
                  </span>
                  <span className="command-palette-subtitle">{action.subtitle}</span>
                </span>
                <span className="command-palette-meta">
                  <span>{action.category}</span>
                  {action.shortcut && <kbd>{action.shortcut}</kbd>}
                </span>
              </button>
            );
          }) : (
            <div className="command-palette-empty">{t.noMatches}</div>
          )}
        </div>
      </section>
    </div>
  );
}
