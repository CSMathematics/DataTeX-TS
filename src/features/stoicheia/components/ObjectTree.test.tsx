import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store';
import { ObjectTree } from './ObjectTree';

describe('ObjectTree construction annotations', () => {
  beforeEach(() => {
    useEditorStore.setState({
      source: String.raw`\tkzCompass[delta=20](A,B)
\tkzCompasss[length=1.5](A,C B,C)
\tkzShowLine[parallel=through C,gap=3](A,B)
`,
      parsedNodes: [
        { type: 'Compass', center: 'A', through: 'B', options: 'delta=20' },
        { type: 'Compasses', pairs: [['A', 'C'], ['B', 'C']], options: 'length=1.5' },
        { type: 'ShowLine', mode: 'parallel', points: ['A', 'B'], through: 'C', options: 'parallel=through C,gap=3' },
      ],
      selectedNode: null,
      hoveredNode: null,
    });
  });

  it('renders compass and show-line nodes with concrete labels', () => {
    render(<ObjectTree />);

    expect(screen.getByText('Compass trace A→B')).toBeInTheDocument();
    expect(screen.getByText('Compass traces A→C, B→C')).toBeInTheDocument();
    expect(screen.getByText('Show parallel construction A–B through C')).toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('deletes show-line commands from the scene tree', () => {
    useEditorStore.setState({
      source: String.raw`\tkzShowLine[parallel=through C,gap=3](A,B)
\tkzDrawSegment(A,B)
`,
      parsedNodes: [
        { type: 'ShowLine', mode: 'parallel', points: ['A', 'B'], through: 'C', options: 'parallel=through C,gap=3' },
      ],
    });

    render(<ObjectTree />);
    fireEvent.click(screen.getByTitle('Delete object'));

    expect(useEditorStore.getState().source).toBe(String.raw`\tkzDrawSegment(A,B)
`);
  });

  it('groups scene nodes by object kind in compact sections', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Segment', p1: 'A', p2: 'B' },
        { type: 'Circle', center: 'O', radius_point: 'A' },
        { type: 'LabelPoint', point: 'A', text: '$A$' },
        { type: 'FillCircle', center: 'O', radius: 'A', mode: 'R', options: 'blue!10' },
      ],
    });

    render(<ObjectTree />);

    expect(screen.getByText('Points')).toBeInTheDocument();
    expect(screen.getByText('Lines & segments')).toBeInTheDocument();
    expect(screen.getByText('Circles & arcs')).toBeInTheDocument();
    expect(screen.getByText('Labels')).toBeInTheDocument();
    expect(screen.getByText('Fills & clips')).toBeInTheDocument();
    expect(screen.getByText('Point A')).toBeInTheDocument();
    expect(screen.getByText('Segment A-B')).toBeInTheDocument();
    expect(screen.getByText('Point label A: $A$')).toBeInTheDocument();
  });

});
