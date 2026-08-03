import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GeometryIconPreview } from './GeometryIconPreview';
import { geometryToolIcons } from './registry';

describe('geometry toolbar icons', () => {
  it('renders every registered custom icon as an SVG', () => {
    render(
      <div>
        {Object.entries(geometryToolIcons).map(([toolId, Icon]) => (
          <Icon key={toolId} title={toolId} />
        ))}
      </div>,
    );

    expect(screen.getAllByRole('img')).toHaveLength(Object.keys(geometryToolIcons).length);
  });

  it('renders a preview sheet with light, dark and accent samples', () => {
    render(<GeometryIconPreview />);

    expect(screen.getByRole('region', { name: 'Geometry icon preview' })).toBeInTheDocument();
    expect(screen.getByText('add_segment')).toBeInTheDocument();
    expect(screen.getByTitle('add_segment light 18px')).toBeInTheDocument();
    expect(screen.getByTitle('add_segment dark 18px')).toBeInTheDocument();
    expect(screen.getByTitle('add_segment accent 24px')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(Object.keys(geometryToolIcons).length * 3);
  });
});
