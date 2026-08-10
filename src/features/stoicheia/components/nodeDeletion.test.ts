import { describe, expect, it } from 'vitest';
import { deleteNodeFromSource } from './nodeDeletion';
import type { AstNode } from '../store';

describe('node source deletion', () => {
  it('removes a simple drawing command while preserving unrelated commands', () => {
    const source = String.raw`\tkzDrawSegment[red](A,B)
\tkzDrawCircle(O,A)
`;
    const node = { type: 'Segment', p1: 'A', p2: 'B' } as AstNode;

    const cleaned = deleteNodeFromSource(source, node);

    expect(cleaned).not.toContain(String.raw`\tkzDrawSegment`);
    expect(cleaned).toContain(String.raw`\tkzDrawCircle(O,A)`);
  });

  it('removes a point definition and its point draw/label commands', () => {
    const source = String.raw`\tkzDefPoint(0,0){A}
\tkzDrawPoints(A)
\tkzLabelPoints[above](A)
\tkzLabelPoint(A){$A$}
\tkzDrawSegment(A,B)
`;
    const node = { type: 'Point', name: 'A', x: 0, y: 0, coordinate_mode: 'cartesian' } as AstNode;

    const cleaned = deleteNodeFromSource(source, node);

    expect(cleaned).not.toContain(String.raw`\tkzDefPoint(0,0){A}`);
    expect(cleaned).not.toContain(String.raw`\tkzDrawPoints(A)`);
    expect(cleaned).not.toContain(String.raw`\tkzLabelPoints[above](A)`);
    expect(cleaned).not.toContain(String.raw`\tkzLabelPoint(A){$A$}`);
    expect(cleaned).toContain(String.raw`\tkzDrawSegment(A,B)`);
  });

  it('removes a multi-line construction block with optional draw and label commands', () => {
    const source = String.raw`\tkzDefMidPoint(A,B)
\tkzGetPoint{M}
\tkzDrawPoints(M)
\tkzLabelPoint(M){$M$}
\tkzDrawSegment(A,B)
`;
    const node = { type: 'MidPoint', p1: 'A', p2: 'B', name: 'M' } as AstNode;

    const cleaned = deleteNodeFromSource(source, node);

    expect(cleaned).toBe(String.raw`\tkzDrawSegment(A,B)
`);
  });

  it('returns the original source when the node has no matching command', () => {
    const source = String.raw`\tkzDrawSegment(A,B)
`;
    const node = { type: 'Segment', p1: 'B', p2: 'A' } as AstNode;

    expect(deleteNodeFromSource(source, node)).toBe(source);
  });

  it('removes a standalone segment label command', () => {
    const source = String.raw`\tkzDrawSegment(A,B)
\tkzLabelSegment[auto](A,B){$c$}
`;
    const node = { type: 'LabelSegment', p1: 'A', p2: 'B', text: '$c$', options: 'auto' } as AstNode;

    expect(deleteNodeFromSource(source, node)).toBe(String.raw`\tkzDrawSegment(A,B)
`);
  });

  it('removes compass trace commands', () => {
    const source = String.raw`\tkzCompass[delta=20,color=red](A,B)
\tkzCompasss[length=1.5](A,C B,C)
\tkzDrawSegment(A,B)
`;
    const compass = { type: 'Compass', center: 'A', through: 'B', options: 'delta=20,color=red' } as AstNode;
    const compasses = { type: 'Compasses', pairs: [['A', 'C'], ['B', 'C']], options: 'length=1.5' } as AstNode;

    const withoutCompass = deleteNodeFromSource(source, compass);
    const cleaned = deleteNodeFromSource(withoutCompass, compasses);

    expect(cleaned).toBe(String.raw`\tkzDrawSegment(A,B)
`);
  });

  it('removes show-line construction commands', () => {
    const source = String.raw`\tkzShowLine[parallel=through C,gap=3](A,B)
\tkzShowLine[bisector,size=2](B,A,C)
\tkzDrawSegment(A,B)
`;
    const parallel = { type: 'ShowLine', mode: 'parallel', points: ['A', 'B'], through: 'C', options: 'parallel=through C,gap=3' } as AstNode;
    const bisector = { type: 'ShowLine', mode: 'bisector', points: ['B', 'A', 'C'], options: 'bisector,size=2' } as AstNode;

    const withoutParallel = deleteNodeFromSource(source, parallel);
    const cleaned = deleteNodeFromSource(withoutParallel, bisector);

    expect(cleaned).toBe(String.raw`\tkzDrawSegment(A,B)
`);
  });

  it('removes style setup commands', () => {
    const source = String.raw`\tkzSetUpPoint[size=3,color=red]
\tkzSetUpStyle[color=orange,line width=.8pt]{highlight}
\tkzDrawSegment(A,B)
`;
    const pointStyle = { type: 'StyleSetup', kind: 'point', command: 'tkzSetUpPoint', options: 'size=3,color=red' } as AstNode;
    const customStyle = { type: 'CustomStyle', name: 'highlight', options: 'color=orange,line width=.8pt' } as AstNode;

    const withoutPointStyle = deleteNodeFromSource(source, pointStyle);
    const cleaned = deleteNodeFromSource(withoutPointStyle, customStyle);

    expect(cleaned).toBe(String.raw`\tkzDrawSegment(A,B)
`);
  });

  it('removes duplicate segment, length and unit conversion commands', () => {
    const source = String.raw`\tkzDuplicateSegment(A,B)(C,D)
\tkzGetPoint{E}
\tkzDrawSegment(A,E)
\tkzDrawPoints(E)
\tkzLabelPoint(E){$E$}
\tkzCalcLength[cm](A,B)
\tkzGetLength{dAB}
\tkzpttocm(28.45274){oneCm}
\tkzcmtopt(1){onePt}
\tkzGetPointCoord(A){coordA}
\tkzSwapPoints(A,B)
\tkzDotProduct(A,B,B)
\tkzGetResult{dotABB}
\tkzPowerCircle(A)(B,C)
\tkzGetResult{powerA}
\tkzDefRadicalAxis(A,B)(C,D)
\tkzGetPoints{E}{F}
\tkzDrawLine[add=1 and 1](E,F)
\tkzDrawPoints(E,F)
\tkzLabelPoint(E){$E$}
\tkzLabelPoint(F){$F$}
\tkzIsLinear(A,B,C)
\iftkzLinear
  % The points are aligned.
\else
  % The points are not aligned.
\fi
\tkzIsOrtho(A,B,C)
\iftkzOrtho
  % The lines are orthogonal.
\else
  % The lines are not orthogonal.
\fi
\tkzDrawSegment(A,B)
`;
    const duplicate = { type: 'DuplicateSegment', rayStart: 'A', rayThrough: 'B', segmentStart: 'C', segmentEnd: 'D', name: 'E' } as AstNode;
    const length = { type: 'LengthCalculation', p1: 'A', p2: 'B', macro: 'dAB', options: 'cm' } as AstNode;
    const ptToCm = { type: 'UnitConversion', mode: 'pt_to_cm', value: '28.45274', macro: 'oneCm' } as AstNode;
    const cmToPt = { type: 'UnitConversion', mode: 'cm_to_pt', value: '1', macro: 'onePt' } as AstNode;
    const pointCoordinates = { type: 'PointCoordinates', point: 'A', macro: 'coordA' } as AstNode;
    const swap = { type: 'SwapPoints', p1: 'A', p2: 'B' } as AstNode;
    const dotProduct = { type: 'DotProduct', p1: 'A', p2: 'B', p3: 'B', macro: 'dotABB' } as AstNode;
    const powerCircle = { type: 'PowerCircle', point: 'A', center: 'B', radiusPoint: 'C', macro: 'powerA' } as AstNode;
    const radicalAxis = { type: 'RadicalAxis', circle1: ['A', 'B'], circle2: ['C', 'D'], results: ['E', 'F'] } as AstNode;
    const linearity = { type: 'LinearityTest', points: ['A', 'B', 'C'] } as AstNode;
    const orthogonality = { type: 'OrthogonalityTest', points: ['A', 'B', 'C'] } as AstNode;

    const withoutDuplicate = deleteNodeFromSource(source, duplicate);
    const withoutLength = deleteNodeFromSource(withoutDuplicate, length);
    const withoutPt = deleteNodeFromSource(withoutLength, ptToCm);
    const withoutCm = deleteNodeFromSource(withoutPt, cmToPt);
    const withoutCoordinates = deleteNodeFromSource(withoutCm, pointCoordinates);
    const withoutSwap = deleteNodeFromSource(withoutCoordinates, swap);
    const withoutDot = deleteNodeFromSource(withoutSwap, dotProduct);
    const withoutPower = deleteNodeFromSource(withoutDot, powerCircle);
    const withoutRadicalAxis = deleteNodeFromSource(withoutPower, radicalAxis);
    const withoutLinearity = deleteNodeFromSource(withoutRadicalAxis, linearity);
    const cleaned = deleteNodeFromSource(withoutLinearity, orthogonality);

    expect(cleaned).toBe(String.raw`\tkzDrawSegment(A,B)
`);
  });
});
