import { describe, expect, it } from 'vitest';
import fixture from './fixtures/generated-latex.v1.json';
import { deleteNodeFromSource } from '../components/nodeDeletion';
import {
  updateTikzBlockReferences,
  updateTikzCommandOptions,
} from '../editor/commandOptions';
import {
  DEFAULT_AUTO_LABEL_SHAPES,
  useEditorStore,
  type AstNode,
} from '../store';

const resetStore = (source: string, parsedNodes: AstNode[] = []) => {
  useEditorStore.setState(useEditorStore.getInitialState(), true);
  useEditorStore.setState({
    source,
    sourceHistory: [],
    sourceRedoStack: [],
    parsedNodes,
    parsedSource: source,
    resolvedPoints: null,
    resolvedViewport: null,
    geometryDiagnostics: [],
    autoLabelShapes: { ...DEFAULT_AUTO_LABEL_SHAPES },
  });
};

const point = (name: string, x: number, y: number): AstNode => ({
  type: 'Point',
  name,
  x,
  y,
  coordinate_mode: 'cartesian',
});

const scenarioRunners: Record<string, () => string> = {
  'first-of-multiple-pictures-lf': () => {
    resetStore(String.raw`\documentclass{article}
\begin{document}
\begin{tikzpicture}
\tkzDefPoint(0,0){A}
\end{tikzpicture}
Between pictures.
\begin{tikzpicture}
\tkzDefPoint(1,1){B}
\end{tikzpicture}
\end{document}`);
    useEditorStore.getState().insertTikzCommand(String.raw`\tkzDrawPoints(A)`);
    return useEditorStore.getState().source;
  },
  'before-end-document-crlf-unicode': () => {
    resetStore('\\documentclass{article}\r\n\\begin{document}\r\nΕλληνικό κείμενο\r\n\\end{document}\r\n');
    useEditorStore.getState().insertTikzCommand(String.raw`\tkzDrawPolygon(A,B,C)`);
    return useEditorStore.getState().source;
  },
  'append-without-document-shell': () => {
    resetStore('% scratch source');
    useEditorStore.getState().insertTikzCommand(String.raw`\tkzDrawCircle(O,A)`);
    return useEditorStore.getState().source;
  },
  'composite-construction-name-reservation': () => {
    resetStore(String.raw`\documentclass{standalone}
\usepackage{tkz-euclide}
\begin{document}
\begin{tikzpicture}
\tkzDefPoint(0,0){A}
\tkzDefPoint(4,0){B}
\tkzDefPoint(1,3){C}
\end{tikzpicture}
\end{document}`, [point('A', 0, 0), point('B', 4, 0), point('C', 1, 3)]);
    expect(useEditorStore.getState().addMidPoint('A', 'B')).toBe('D');
    expect(useEditorStore.getState().addDefinedTriangle({
      mode: 'two_angles',
      p1: 'A',
      p2: 'B',
      angle1: 45,
      angle2: 60,
      swap: true,
    })).toBe('E');
    expect(useEditorStore.getState().addPolygonConstruction({
      mode: 'square',
      points: ['A', 'B'],
    })).toEqual(['F', 'G']);
    useEditorStore.getState().addSegment('D', 'E', 'color=teal,line width=.8pt');
    return useEditorStore.getState().source;
  },
  'transform-and-intersection': () => {
    resetStore(String.raw`\begin{tikzpicture}
\tkzDefPoint(0,0){A}
\tkzDefPoint(2,0){B}
\tkzDefPoint(0,2){C}
\tkzDefPoint(3,1){D}
\tkzDefPoint(1,1){O}
\end{tikzpicture}`, [
      point('A', 0, 0),
      point('B', 2, 0),
      point('C', 0, 2),
      point('D', 3, 1),
      point('O', 1, 1),
    ]);
    expect(useEditorStore.getState().addPointTransformation({
      mode: 'translation',
      source: 'A',
      references: ['B', 'C'],
    })).toBe('E');
    expect(useEditorStore.getState().addLineCircleIntersection({
      mode: 'R',
      line: ['A', 'D'],
      circle: ['O'],
      radius: 2.5,
      near: true,
    })).toEqual(['F', 'G']);
    return useEditorStore.getState().source;
  },
  'styles-nested-options-unicode-label': () => {
    resetStore(String.raw`\begin{tikzpicture}
\tkzDefPoint(0,0){A}
\end{tikzpicture}`, [point('A', 0, 0)]);
    useEditorStore.getState().upsertStyleSetup(
      'point',
      'size=4,color={rgb,255:red,18;green,52;blue,86},fill=blue!15',
      true,
    );
    expect(useEditorStore.getState().upsertCustomStyle(
      'accent',
      'draw=blue!70!black,line width=.8pt',
      true,
    )).toBe(true);
    useEditorStore.getState().addPointLabel(
      'A',
      '$Α_{κέντρο}$',
      'above,color={rgb,255:red,18;green,52;blue,86}',
    );
    return useEditorStore.getState().source;
  },
  'cartesian-and-polar-coordinate-edit': () => {
    const source = String.raw`\begin{tikzpicture}
\tkzDefPoint(0,0){A}
\tkzDefPoint(30:2){P}
\end{tikzpicture}`;
    resetStore(source, [
      point('A', 0, 0),
      {
        type: 'Point',
        name: 'P',
        x: Math.sqrt(3),
        y: 1,
        coordinate_mode: 'polar',
        angle: 30,
        distance: 2,
      },
    ]);
    useEditorStore.getState().updatePointCoords('A', 1.25, -2.5);
    useEditorStore.getState().updatePointCoords('P', 0, 2);
    return useEditorStore.getState().source;
  },
  'inspector-options-and-reference-swap': () => {
    const source = String.raw`\begin{tikzpicture}
\tkzDefTriangle[equilateral](A,B)
\tkzGetPoint{C}
\tkzDrawPolygon(A,B,C)
\tkzDrawPoints(C)
\end{tikzpicture}`;
    const styled = updateTikzCommandOptions(
      source,
      { command: 'tkzDrawPolygon', arguments: 'A,B,C' },
      'fill=cyan!15,draw={rgb,255:red,18;green,52;blue,86},line width=.8pt',
    );
    return updateTikzBlockReferences(styled, [
      { command: 'tkzDefTriangle', arguments: 'A,B' },
      { command: 'tkzDrawPolygon', arguments: 'A,B,C' },
      { command: 'tkzDrawPoints', arguments: 'C' },
    ], { A: 'B', B: 'A' });
  },
  'delete-construction-preserves-unrelated-bytes': () => {
    const source = String.raw`\begin{tikzpicture}
% πριν
\tkzDefMidPoint(A,B)
\tkzGetPoint{M}
\tkzDrawPoints(M)
\tkzLabelPoint(M){$M$}
\tkzDrawSegment[dashed](A,B)
% μετά
\end{tikzpicture}
`;
    return deleteNodeFromSource(source, {
      type: 'MidPoint',
      p1: 'A',
      p2: 'B',
      name: 'M',
    });
  },
  'direct-add-polygon-action': () => {
    resetStore(String.raw`\begin{tikzpicture}
\tkzDefPoint(0,0){A}
\tkzDefPoint(2,0){B}
\tkzDefPoint(1,2){C}
\end{tikzpicture}`, [point('A', 0, 0), point('B', 2, 0), point('C', 1, 2)]);
    useEditorStore.getState().addPolygon(['A', 'B', 'C']);
    return useEditorStore.getState().source;
  },
};

describe('generated LaTeX byte-exact parity', () => {
  it('keeps the runner and fixture scenario sets in lockstep', () => {
    expect(Object.keys(scenarioRunners)).toEqual(
      fixture.scenarios.map(({ id }) => id),
    );
  });

  it.each(fixture.scenarios)('$id', ({ id, expectedSource }) => {
    const run = scenarioRunners[id];
    expect(run, `missing generated-LaTeX parity runner: ${id}`).toBeDefined();
    expect(run()).toBe(expectedSource);
  });
});
