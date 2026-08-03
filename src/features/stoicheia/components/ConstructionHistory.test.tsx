import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store';
import { ConstructionHistory } from './ConstructionHistory';

describe('ConstructionHistory', () => {
  beforeEach(() => {
    useEditorStore.setState({
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 3, y: 4 },
        { type: 'Segment', p1: 'A', p2: 'B' },
        { type: 'Circle', center: 'A', radius_point: 'B' },
      ],
      selectedNode: null,
      hoveredNode: null,
    });
  });

  it('renders parsed nodes in construction order', () => {
    render(<ConstructionHistory />);

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Point A')).toBeInTheDocument();
    expect(screen.getByText('Segment A-B')).toBeInTheDocument();
    expect(screen.getByText('Circle A-B')).toBeInTheDocument();
  });

  it('selects and hovers the shared node id', () => {
    render(<ConstructionHistory />);

    const segmentStep = screen.getByRole('button', { name: /Segment A-B/ });
    fireEvent.mouseEnter(segmentStep);
    expect(useEditorStore.getState().hoveredNode).toBe('segment_A_B');

    fireEvent.click(segmentStep);
    expect(useEditorStore.getState().selectedNode).toBe('segment_A_B');

    fireEvent.mouseLeave(segmentStep);
    expect(useEditorStore.getState().hoveredNode).toBeNull();
  });
});
