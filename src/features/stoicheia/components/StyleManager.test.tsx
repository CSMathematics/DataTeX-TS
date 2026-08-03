import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StyleManager } from './StyleManager';
import { DEFAULT_APP_SETTINGS, useEditorStore } from '../store';

describe('StyleManager', () => {
  beforeEach(() => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\end{tikzpicture}`,
      sourceHistory: [],
      sourceRedoStack: [],
      parsedNodes: [],
      selectedNode: null,
      settings: { ...DEFAULT_APP_SETTINGS },
    });
  });

  it('creates and toggles global point styles', () => {
    render(<StyleManager />);

    fireEvent.change(screen.getByLabelText('Points color'), { target: { value: 'red' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Points style' }));

    expect(useEditorStore.getState().source).toContain('\\tkzSetUpPoint[size=2, fill=teal, color=red]');

    fireEvent.click(screen.getByRole('button', { name: 'Disable Points style' }));
    expect(useEditorStore.getState().source).toContain('% stoicheia-style-off \\tkzSetUpPoint[size=2, fill=teal, color=red]');

    fireEvent.click(screen.getByRole('button', { name: 'Enable Points style' }));
    expect(useEditorStore.getState().source).toContain('\\tkzSetUpPoint[size=2, fill=teal, color=red]');
  });

  it('creates a custom named style', () => {
    render(<StyleManager />);

    fireEvent.change(screen.getByLabelText('Custom style name'), { target: { value: 'highlight' } });
    fireEvent.change(screen.getByLabelText('Custom style options'), { target: { value: 'color=orange,line width=1pt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create custom style' }));

    expect(useEditorStore.getState().source).toContain('\\tkzSetUpStyle[color=orange,line width=1pt]{highlight}');
  });

  it('applies a complete style profile', () => {
    render(<StyleManager />);
    const initialSource = useEditorStore.getState().source;

    fireEvent.click(screen.getByRole('button', { name: /Presentation/ }));

    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzSetUpPoint[size=3,color=blue,fill=blue!30]');
    expect(source).toContain('\\tkzSetUpLine[line width=.8pt,color=blue!70!black]');
    expect(source).toContain('\\tkzSetUpLabel[font=\\small,color=black]');
    expect(useEditorStore.getState().sourceHistory).toEqual([initialSource]);

    useEditorStore.getState().undoSource();
    expect(useEditorStore.getState().source).toBe(initialSource);
  });
});
