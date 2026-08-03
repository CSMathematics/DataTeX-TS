import { describe, expect, it } from 'vitest';
import { AstNode } from '../store';
import { buildFastViewport, WORLD_SCALE } from './fastViewport';

describe('buildFastViewport', () => {
  it('includes circle extents rather than only its defining points', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 },
      { type: 'Point', name: 'A', x: 4, y: 0 },
      { type: 'Circle', center: 'O', radius_point: 'A' },
    ];
    const [minX, , width] = buildFastViewport(nodes).viewBox.split(' ').map(Number);

    expect(minX).toBeLessThan(-4 * WORLD_SCALE);
    expect(minX + width).toBeGreaterThan(4 * WORLD_SCALE);
  });

  it('includes a derived line intersection in its bounds', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 1, y: 0 },
      { type: 'Point', name: 'C', x: 0, y: 1 },
      { type: 'Point', name: 'D', x: 1, y: 0.9 },
      { type: 'IntersectionPoint', p1: 'A', p2: 'B', p3: 'C', p4: 'D', name: 'E' },
    ];
    const resolved = {
      A: { x: 0, y: 0 },
      B: { x: 1, y: 0 },
      C: { x: 0, y: 1 },
      D: { x: 1, y: 0.9 },
      E: { x: 10, y: 0 },
    };
    const [minX, , width] = buildFastViewport(nodes, resolved).viewBox.split(' ').map(Number);

    expect(minX + width).toBeGreaterThan(10 * WORLD_SCALE);
  });

  it('does not synthesize construction points without Rust-resolved geometry', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 4, y: 0 },
      { type: 'MidPoint', p1: 'A', p2: 'B', name: 'M' },
    ];

    const viewport = buildFastViewport(nodes);

    expect(viewport.points.has('A')).toBe(true);
    expect(viewport.points.has('B')).toBe(true);
    expect(viewport.points.has('M')).toBe(false);
  });

  it('uses a complete point map supplied by the Rust resolver', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 4, y: 0 },
      { type: 'MidPoint', p1: 'A', p2: 'B', name: 'M' },
    ];
    const resolved = {
      A: { x: 0, y: 0 },
      B: { x: 4, y: 0 },
      M: { x: 2, y: 0 },
    };

    const viewport = buildFastViewport(nodes, resolved);
    expect(viewport.points.get('M')).toEqual({ x: 2, y: 0 });
    expect(viewport.points.size).toBe(3);
  });

  it('uses a Rust-supplied viewBox without recalculating bounds in TypeScript', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Circle', center: 'Missing', radius_point: 'AlsoMissing' },
    ];
    const viewport = buildFastViewport(nodes, { A: { x: 0, y: 0 } }, '1 2 3 4');

    expect(viewport.viewBox).toBe('1 2 3 4');
    expect(viewport.points.get('A')).toEqual({ x: 0, y: 0 });
  });
});
