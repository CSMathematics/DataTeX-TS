import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';
import { toolbarGroups } from './Toolbar';
import { DEFAULT_APP_SETTINGS, useEditorStore } from '../store';

const renderPalette = (props: Partial<Parameters<typeof CommandPalette>[0]> = {}) => {
  const defaults = {
    open: true,
    showEditor: true,
    showInspector: true,
    onClose: vi.fn(),
    onOpenWorkspace: vi.fn(),
    onOpenSource: vi.fn(),
    onOpenStyles: vi.fn(),
    onOpenSettings: vi.fn(),
    onToggleEditor: vi.fn(),
    onToggleInspector: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  return { props: merged, view: render(<CommandPalette {...merged} />) };
};

describe('CommandPalette', () => {
  beforeEach(() => {
    useEditorStore.setState({
      settings: { ...DEFAULT_APP_SETTINGS },
      theme: DEFAULT_APP_SETTINGS.theme,
      activeTool: 'cursor',
      previewMode: 'instant',
      showGrid: true,
      snapToGrid: true,
      showHandles: true,
    });
  });

  it('filters commands and runs the selected workspace action', () => {
    const onOpenSettings = vi.fn();
    const onClose = vi.fn();
    renderPalette({ onOpenSettings, onClose });

    fireEvent.change(screen.getByLabelText('Search commands and tools'), { target: { value: 'settings' } });
    fireEvent.click(screen.getByRole('option', { name: /Open settings/ }));

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('uses keyboard navigation to run preview commands', () => {
    const onClose = vi.fn();
    renderPalette({ onClose });
    const input = screen.getByLabelText('Search commands and tools');

    fireEvent.change(input, { target: { value: 'latex preview' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useEditorStore.getState().previewMode).toBe('latex');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('toggles canvas settings from commands', () => {
    renderPalette();

    fireEvent.change(screen.getByLabelText('Search commands and tools'), { target: { value: 'hide grid' } });
    fireEvent.click(screen.getByRole('option', { name: /Hide canvas grid/ }));

    expect(useEditorStore.getState().showGrid).toBe(false);
  });

  it('selects drawing tools and returns to the workspace', () => {
    const onOpenWorkspace = vi.fn();
    renderPalette({ onOpenWorkspace });

    fireEvent.change(screen.getByLabelText('Search commands and tools'), { target: { value: 'segment' } });
    fireEvent.click(screen.getByRole('option', { name: /^Segment/ }));

    expect(onOpenWorkspace).toHaveBeenCalledOnce();
    expect(useEditorStore.getState().activeTool).toBe('add_segment');
  });

  it('indexes toolbar section labels in tool search results', () => {
    renderPalette();

    fireEvent.change(screen.getByLabelText('Search commands and tools'), { target: { value: 'boolean tests' } });

    const linearity = screen.getByRole('option', { name: /Test linearity/ });
    const orthogonality = screen.getByRole('option', { name: /Test orthogonality/ });
    expect(linearity).toHaveTextContent('Intersections & relations / Boolean tests');
    expect(orthogonality).toHaveTextContent('Intersections & relations / Boolean tests');
    expect(screen.queryByRole('option', { name: /Calculate length/ })).not.toBeInTheDocument();
  });

  it('lists every toolbar tool with its group and section location', () => {
    renderPalette();

    for (const group of toolbarGroups) {
      for (const tool of group.tools) {
        const sectionLabel = group.sections?.find(section => section.tools.some(sectionTool => sectionTool.id === tool.id))?.label;
        const location = sectionLabel ? `${group.label} / ${sectionLabel}` : group.label;
        expect(screen.queryAllByText(`${location} - ${tool.description}`).length).toBeGreaterThan(0);
      }
    }
  });

  it('dispatches sectioned tool selections for toolbar dialogs', async () => {
    const onOpenWorkspace = vi.fn();
    const onClose = vi.fn();
    const listener = vi.fn();
    window.addEventListener('stoicheia:select-tool', listener);
    renderPalette({ onOpenWorkspace, onClose });

    fireEvent.change(screen.getByLabelText('Search commands and tools'), { target: { value: 'construction aids duplicate' } });
    fireEvent.click(screen.getByRole('option', { name: /Duplicate segment/ }));

    expect(onOpenWorkspace).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(useEditorStore.getState().activeTool).toBe('add_duplicate_segment');
    await waitFor(() => expect(listener).toHaveBeenCalled());
    expect(listener.mock.calls.some(([event]) => (
      (event as CustomEvent<{ tool: string }>).detail.tool === 'add_duplicate_segment'
    ))).toBe(true);
    window.removeEventListener('stoicheia:select-tool', listener);
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    renderPalette({ onClose });

    fireEvent.keyDown(screen.getByLabelText('Search commands and tools'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
