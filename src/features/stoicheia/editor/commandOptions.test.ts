import { describe, expect, it } from 'vitest';
import { buildTikzCommandIndex, findTikzCommandRange, readTikzCommandOptions, updateTikzBlockReferences, updateTikzCommandOptions } from './commandOptions';

describe('TikZ command option updates', () => {
  it('reads, adds, replaces and removes options without changing arguments', () => {
    const target = { command: 'tkzDrawPolygon', arguments: 'A,B,C' };
    expect(readTikzCommandOptions('\\tkzDrawPolygon(A,B,C)', target)).toBe('');
    const styled = updateTikzCommandOptions('\\tkzDrawPolygon(A,B,C)', target, 'color=red, thick');
    expect(styled).toBe('\\tkzDrawPolygon[color=red, thick](A,B,C)');
    expect(updateTikzCommandOptions(styled, target, '')).toBe('\\tkzDrawPolygon(A,B,C)');
  });

  it('updates commands without arguments by using a lookahead', () => {
    const source = '\\tkzDefRandPointOn[circle=center A radius 2]\n\\tkzGetPoint{P}';
    const target = { command: 'tkzDefRandPointOn', followedBy: '\\s*\\\\tkzGetPoint\\{P\\}' };
    expect(readTikzCommandOptions(source, target)).toBe('circle=center A radius 2');
    expect(updateTikzCommandOptions(source, target, 'disk through=center A through B')).toContain('\\tkzDefRandPointOn[disk through=center A through B]\n\\tkzGetPoint{P}');
  });

  it('reuses a parsed command index for option reads and ranges', () => {
    const source = '\\tkzDrawSegment[color=red](A,B)\n\\tkzDrawSegment[dashed](C,D)\n\\tkzDefRandPointOn[disk]\n\\tkzGetPoint{P}';
    const index = buildTikzCommandIndex(source);
    expect(readTikzCommandOptions(index, { command: 'tkzDrawSegment', arguments: 'A,B' })).toBe('color=red');
    expect(readTikzCommandOptions(index, { command: 'tkzDrawSegment', arguments: 'C,D' })).toBe('dashed');
    const range = findTikzCommandRange(index, { command: 'tkzDefRandPointOn', followedBy: '\\s*\\\\tkzGetPoint\\{P\\}' });
    expect(source.slice(range?.start, range?.end)).toBe('\\tkzDefRandPointOn[disk]\n\\tkzGetPoint{P}');
  });

  it('replaces references simultaneously inside one construction block', () => {
    const source = '\\tkzDefTriangle[equilateral](A,B)\n\\tkzGetPoint{C}\n\\tkzDrawPolygon(A,B,C)\n\\tkzDrawPoints(C)';
    const targets = [
      { command: 'tkzDefTriangle', arguments: 'A,B' },
      { command: 'tkzDrawPolygon', arguments: 'A,B,C' },
      { command: 'tkzDrawPoints', arguments: 'C' },
    ];
    const updated = updateTikzBlockReferences(source, targets, { A: 'B', B: 'A' });
    expect(updated).toContain('\\tkzDefTriangle[equilateral](B,A)');
    expect(updated).toContain('\\tkzDrawPolygon(B,A,C)');
    expect(updated).toContain('\\tkzDrawPoints(C)');
  });

  it('does not replace matching point names outside the selected block', () => {
    const source = '\\tkzDefMidPoint(A,B)\n\\tkzGetPoint{C}\n\\tkzDrawPoints(C)\n\\tkzDefMidPoint(A,D)\n\\tkzGetPoint{E}';
    const updated = updateTikzBlockReferences(source, [{ command: 'tkzDefMidPoint', arguments: 'A,B' }, { command: 'tkzDrawPoints', arguments: 'C' }], { A: 'D' });
    expect(updated).toContain('\\tkzDefMidPoint(D,B)');
    expect(updated).toContain('\\tkzDefMidPoint(A,D)');
  });
});
