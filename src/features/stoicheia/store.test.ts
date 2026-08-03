import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_APP_SETTINGS, DEFAULT_AUTO_LABEL_SHAPES, useEditorStore } from './store';

describe('Editor Store Source Manipulation', () => {
  beforeEach(() => {
    // Reset store to default before each test
    useEditorStore.setState({
      source: `\\documentclass{article}
\\usepackage{tikz}
\\usepackage{tkz-euclide}
\\pagestyle{empty}
\\begin{document}
\\begin{tikzpicture}
  \\tkzDefPoint(0,0){A}
\\end{tikzpicture}
\\end{document}`,
      sourceHistory: [],
      sourceRedoStack: [],
      parsedNodes: [{ type: "Point", name: "A", x: 0, y: 0 }],
      parsedSource: '',
      resolvedPoints: null,
      resolvedViewport: null,
      geometryDiagnostics: [],
      activeTool: 'cursor',
      selectedPoints: [],
      settings: { ...DEFAULT_APP_SETTINGS, defaultZoom: 1 },
      theme: DEFAULT_APP_SETTINGS.theme,
      showEditorMinimap: DEFAULT_APP_SETTINGS.showEditorMinimap,
      previewMode: DEFAULT_APP_SETTINGS.previewMode,
      showGrid: DEFAULT_APP_SETTINGS.showGrid,
      snapToGrid: DEFAULT_APP_SETTINGS.snapToGrid,
      zoomLevel: 1,
      pan: { x: 0, y: 0 },
      fitViewRequest: 0,
      autoLabelShapes: { ...DEFAULT_AUTO_LABEL_SHAPES },
    });
  });

  it('synchronizes app settings with runtime editor state', () => {
    useEditorStore.getState().updateSettings({
      theme: 'light',
      language: 'ru',
      defaultZoom: 2,
      editorWidthRatio: 0.6,
      showEditorMinimap: true,
      editorFontSize: 17,
      editorWordWrap: false,
      editorLineNumbers: false,
      autoSaveDraft: false,
      previewMode: 'latex',
      latexCompiler: 'xelatex',
      latexEnginePaths: { ...DEFAULT_APP_SETTINGS.latexEnginePaths, xelatex: '/opt/texlive/bin/xelatex' },
      showGrid: false,
      snapToGrid: false,
      canvasGridStep: 0.5,
      snapStep: 2,
      exportSvgFilename: 'proof.svg',
    });

    const state = useEditorStore.getState();
    expect(state.settings).toMatchObject({
      theme: 'light',
      language: 'ru',
      defaultZoom: 2,
      editorWidthRatio: 0.6,
      showEditorMinimap: true,
      editorFontSize: 17,
      editorWordWrap: false,
      editorLineNumbers: false,
      autoSaveDraft: false,
      previewMode: 'latex',
      latexCompiler: 'xelatex',
      latexEnginePaths: { ...DEFAULT_APP_SETTINGS.latexEnginePaths, xelatex: '/opt/texlive/bin/xelatex' },
      showGrid: false,
      snapToGrid: false,
      canvasGridStep: 0.5,
      snapStep: 2,
      exportSvgFilename: 'proof.svg',
    });
    expect(state.theme).toBe('light');
    expect(state.zoomLevel).toBe(2);
    expect(state.showEditorMinimap).toBe(true);
    expect(state.previewMode).toBe('latex');
    expect(state.settings.latexCompiler).toBe('xelatex');
    expect(state.settings.latexEnginePaths.xelatex).toBe('/opt/texlive/bin/xelatex');
    expect(state.compiledSource).toBeNull();
    expect(state.showGrid).toBe(false);
    expect(state.snapToGrid).toBe(false);
  });

  it('inserts TikZ command before \\end{tikzpicture}', () => {
    useEditorStore.getState().insertTikzCommand('\\tkzDrawPoints(A)');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDrawPoints(A)\n\\end{tikzpicture}');
  });

  it('tracks source undo and redo changes', () => {
    const initialSource = useEditorStore.getState().source;

    useEditorStore.getState().setSource(`${initialSource}\n% edit`);
    expect(useEditorStore.getState().source).toContain('% edit');
    expect(useEditorStore.getState().sourceHistory).toEqual([initialSource]);

    useEditorStore.getState().undoSource();
    expect(useEditorStore.getState().source).toBe(initialSource);
    expect(useEditorStore.getState().sourceRedoStack[0]).toContain('% edit');

    useEditorStore.getState().redoSource();
    expect(useEditorStore.getState().source).toContain('% edit');

    const editedSource = useEditorStore.getState().source;
    useEditorStore.getState().insertTikzCommand('\\tkzDrawPoints(A)');
    expect(useEditorStore.getState().source).toContain('\\tkzDrawPoints(A)');

    useEditorStore.getState().undoSource();
    expect(useEditorStore.getState().source).toBe(editedSource);
  });

  it('adds, toggles and removes global and custom style setup commands', () => {
    useEditorStore.getState().upsertStyleSetup('point', 'size=3,color=red,fill=red!20');
    expect(useEditorStore.getState().source).toContain('\\begin{tikzpicture}\n\\tkzSetUpPoint[size=3,color=red,fill=red!20]');

    useEditorStore.getState().toggleStyleSetup('point', false);
    expect(useEditorStore.getState().source).toContain('% stoicheia-style-off \\tkzSetUpPoint[size=3,color=red,fill=red!20]');

    useEditorStore.getState().upsertStyleSetup('point', 'size=4,color=blue', false);
    expect(useEditorStore.getState().source).toContain('% stoicheia-style-off \\tkzSetUpPoint[size=4,color=blue]');

    useEditorStore.getState().toggleStyleSetup('point', true);
    expect(useEditorStore.getState().source).toContain('\\tkzSetUpPoint[size=4,color=blue]');
    expect(useEditorStore.getState().source).not.toContain('stoicheia-style-off \\tkzSetUpPoint[size=4,color=blue]');

    expect(useEditorStore.getState().upsertCustomStyle('myStyle', 'color=orange,line width=.8pt')).toBe(true);
    expect(useEditorStore.getState().upsertCustomStyle('bad style', 'color=red')).toBe(false);
    expect(useEditorStore.getState().source).toContain('\\tkzSetUpStyle[color=orange,line width=.8pt]{myStyle}');

    useEditorStore.getState().toggleCustomStyle('myStyle', false);
    expect(useEditorStore.getState().source).toContain('% stoicheia-style-off \\tkzSetUpStyle[color=orange,line width=.8pt]{myStyle}');

    useEditorStore.getState().removeStyleSetup('point');
    useEditorStore.getState().removeCustomStyle('myStyle');
    expect(useEditorStore.getState().source).not.toContain('tkzSetUpPoint');
    expect(useEditorStore.getState().source).not.toContain('tkzSetUpStyle');
  });

  it('adds a new point with correct name and location', () => {
    // Current parsed nodes has 'A', so next should be 'B'
    const name = useEditorStore.getState().addPoint(5.5, -2.1);
    const source = useEditorStore.getState().source;
    expect(name).toBe('B');
    expect(source).toContain('\\tkzDefPoint(5.5,-2.1){B}');
    expect(source).toContain('\\tkzDrawPoints(B)');
    expect(source).toContain('\\tkzLabelPoint(B){$B$}');
    // ensure it is inside tikzpicture
    expect(source.indexOf('\\tkzDefPoint(5.5,-2.1){B}') < source.indexOf('\\end{tikzpicture}')).toBe(true);
  });

  it('uses unique names when points are added before parsing catches up', () => {
    const firstName = useEditorStore.getState().addPoint(1, 1);
    const secondName = useEditorStore.getState().addPoint(2, 2);

    expect(firstName).toBe('B');
    expect(secondName).toBe('C');
    expect(useEditorStore.getState().source).toContain('\\tkzDefPoint(2,2){C}');
  });

  it('adds a polar point with angle, distance and a unique reference', () => {
    const name = useEditorStore.getState().addPolarPoint(40.126, 4.004);
    const source = useEditorStore.getState().source;

    expect(name).toBe('B');
    expect(source).toContain('\\tkzDefPoint(40.13:4){B}');
    expect(source).toContain('\\tkzDrawPoints(B)');
    expect(source).toContain('\\tkzLabelPoint(B){$B$}');
  });

  it('adds a midpoint with a unique reference and visible marker', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}
\\tkzDefPoint(0,0){A}
\\tkzDefPoint(4,2){B}
\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 4, y: 2 },
      ],
    });
    const name = useEditorStore.getState().addMidPoint('A', 'B');
    const source = useEditorStore.getState().source;

    expect(name).toBe('C');
    expect(source).toContain('\\tkzDefMidPoint(A,B)');
    expect(source).toContain('\\tkzGetPoint{C}');
    expect(source).toContain('\\tkzDrawPoints(C)');
    expect(source).toContain('\\tkzLabelPoint(C){$C$}');
  });

  it('adds a golden-ratio point', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(10,0){B}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 10, y: 0 },
      ],
    });

    expect(useEditorStore.getState().addGoldenRatioPoint('A', 'B')).toBe('C');
    expect(useEditorStore.getState().source).toContain('\\tkzDefGoldenRatio(A,B)\n\\tkzGetPoint{C}');
  });

  it('adds a weighted barycentric point and rejects a zero total weight', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(6,3){B}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 6, y: 3 },
      ],
    });

    expect(useEditorStore.getState().addBarycentricPoint([{ point: 'A', weight: 1 }, { point: 'B', weight: 2 }])).toBe('C');
    expect(useEditorStore.getState().source).toContain('\\tkzDefBarycentricPoint(A=1,B=2)\n\\tkzGetPoint{C}');
    const source = useEditorStore.getState().source;
    expect(useEditorStore.getState().addBarycentricPoint([{ point: 'A', weight: 1 }, { point: 'B', weight: -1 }])).toBeNull();
    expect(useEditorStore.getState().source).toBe(source);
  });

  it('adds advanced point constructions with unique result names', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(6,0){B}\n\\tkzDefPoint(4,0){C}\n\\tkzDefPoint(8,0){D}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 6, y: 0 },
        { type: 'Point', name: 'C', x: 4, y: 0 },
        { type: 'Point', name: 'D', x: 8, y: 0 },
      ],
    });

    expect(useEditorStore.getState().addSimilitudeCenter('int', 'A', 'B', 'C', 'D')).toBe('E');
    expect(useEditorStore.getState().source).toContain('\\tkzDefSimilitudeCenter[int](A,B)(C,D)');
    expect(useEditorStore.getState().addHarmonicPoint('ext', 'A', 'B', 'C')).toBe('F');
    expect(useEditorStore.getState().source).toContain('\\tkzDefHarmonic[ext](A,B,C)');
    expect(useEditorStore.getState().addHarmonicPair('A', 'B', 0.5)).toEqual(['G', 'H']);
    expect(useEditorStore.getState().source).toContain('\\tkzGetPoints{G}{H}');
    expect(useEditorStore.getState().addEquiPoints('A', 'B', 'C', 2, true)).toEqual(['I', 'J']);
    expect(useEditorStore.getState().source).toContain('\\tkzDefEquiPoints[from=C,dist=2,show](A,B)');
  });

  it('adds arc, line and circle constrained points', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(2,0){B}\n\\tkzDefPoint(0,2){C}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Point', name: 'C', x: 0, y: 2 },
      ],
    });

    expect(useEditorStore.getState().addMidArcPoint('A', 'B', 'C')).toBe('D');
    expect(useEditorStore.getState().source).toContain('\\tkzDefMidArc(A,B,C)');
    expect(useEditorStore.getState().addPointOnLine('A', 'B', 1.2)).toBe('E');
    expect(useEditorStore.getState().source).toContain('\\tkzDefPointOnLine[pos=1.2](A,B)');
    expect(useEditorStore.getState().addPointOnCircle('through', 'A', 45, 'B')).toBe('F');
    expect(useEditorStore.getState().source).toContain('\\tkzDefPointOnCircle[through=center A angle 45 point B]');
    expect(useEditorStore.getState().addPointOnCircle('R', 'A', 90, 3)).toBe('G');
    expect(useEditorStore.getState().source).toContain('\\tkzDefPointOnCircle[R=center A angle 90 radius 3]');
  });

  it('adds a selected triangle center with a unique name', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(4,0){B}\n\\tkzDefPoint(0,3){C}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 4, y: 0 },
        { type: 'Point', name: 'C', x: 0, y: 3 },
      ],
    });
    expect(useEditorStore.getState().addTriangleCenter('gergonne', 'A', 'B', 'C')).toBe('D');
    expect(useEditorStore.getState().source).toContain('\\tkzDefTriangleCenter[gergonne](A,B,C)\n\\tkzGetPoint{D}');
  });

  it('adds every tkzDefPointBy transformation syntax', () => {
    const add = useEditorStore.getState().addPointTransformation;
    expect(add({ mode: 'translation', source: 'A', references: ['B', 'C'] })).toBe('B');
    expect(add({ mode: 'homothety', source: 'A', references: ['B'], value: '0.5' })).toBe('C');
    expect(add({ mode: 'reflection', source: 'A', references: ['B', 'C'] })).toBe('D');
    expect(add({ mode: 'symmetry', source: 'A', references: ['B'] })).toBe('E');
    expect(add({ mode: 'projection', source: 'A', references: ['B', 'C'] })).toBe('F');
    expect(add({ mode: 'rotation', source: 'A', references: ['B'], value: '30' })).toBe('G');
    expect(add({ mode: 'rotation_in_rad', source: 'A', references: ['B'], value: 'pi/3' })).toBe('H');
    expect(add({ mode: 'rotation_with_nodes', source: 'A', references: ['B', 'C', 'D'] })).toBe('I');
    expect(add({ mode: 'inversion', source: 'A', references: ['B', 'C'] })).toBe('J');
    expect(add({ mode: 'inversion_negative', source: 'A', references: ['B', 'C'] })).toBe('K');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefPointBy[translation=from B to C](A)');
    expect(source).toContain('\\tkzDefPointBy[homothety=center B ratio 0.5](A)');
    expect(source).toContain('\\tkzDefPointBy[reflection=over B--C](A)');
    expect(source).toContain('\\tkzDefPointBy[symmetry=center B](A)');
    expect(source).toContain('\\tkzDefPointBy[projection=onto B--C](A)');
    expect(source).toContain('\\tkzDefPointBy[rotation=center B angle 30](A)');
    expect(source).toContain('\\tkzDefPointBy[rotation in rad=center B angle pi/3](A)');
    expect(source).toContain('\\tkzDefPointBy[rotation with nodes=center B from C to D](A)');
    expect(source).toContain('\\tkzDefPointBy[inversion=center B through C](A)');
    expect(source).toContain('\\tkzDefPointBy[inversion negative=center B through C](A)');
  });

  it('transforms a list of points with tkzDefPointsBy and reserves every image name', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(2,0){B}\n\\tkzDefPoint(0,2){C}\n\\tkzDefPoint(3,3){D}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Point', name: 'C', x: 0, y: 2 },
        { type: 'Point', name: 'D', x: 3, y: 3 },
      ],
    });
    expect(useEditorStore.getState().addPointsTransformation({ mode: 'translation', sources: ['A', 'B'], references: ['C', 'D'] })).toEqual(['E', 'F']);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefPointsBy[translation=from C to D](A,B){E,F}');
    expect(source).toContain('\\tkzDrawPoints(E,F)');
    expect(source).toContain('\\tkzLabelPoint(E){$E$}');
    expect(source).toContain('\\tkzLabelPoint(F){$F$}');
    expect(useEditorStore.getState().addPoint(1, 1)).toBe('G');
  });

  it('supports the empty tkzDefPointsBy image list with prime names', () => {
    expect(useEditorStore.getState().addPointsTransformation({ mode: 'symmetry', sources: ['A'], references: ['A'], primeNames: true })).toEqual(["A'"]);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefPointsBy[symmetry=center A](A){}');
    expect(source).toContain("\\tkzDrawPoints(A')");
  });

  it('adds tkzDefPointWith vector conditions and K', () => {
    expect(useEditorStore.getState().addVectorPoint({ mode: 'orthogonal_normed', p1: 'A', p2: 'B', factor: 2 })).toBe('B');
    expect(useEditorStore.getState().source).toContain('\\tkzDefPointWith[orthogonal normed,K=2](A,B)');
    expect(useEditorStore.getState().addVectorPoint({ mode: 'colinear', p1: 'A', p2: 'B', anchor: 'C', factor: 1 })).toBe('C');
    expect(useEditorStore.getState().source).toContain('\\tkzDefPointWith[colinear=at C](A,B)');
  });

  it('adds tkzGetVectxy with a safe macro prefix', () => {
    expect(useEditorStore.getState().addVectorCoordinates('A', 'B', 'V')).toBe(true);
    expect(useEditorStore.getState().source).toContain('\\tkzGetVectxy(A,B){V}');
    expect(useEditorStore.getState().addVectorCoordinates('A', 'B', 'V1')).toBe(false);
  });

  it('duplicates a segment and stores length or unit conversions', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(3,0){B}\n\\tkzDefPoint(0,2){C}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 3, y: 0 },
        { type: 'Point', name: 'C', x: 0, y: 2 },
      ],
    });

    expect(useEditorStore.getState().addDuplicateSegment({ rayStart: 'A', rayThrough: 'B', segmentStart: 'A', segmentEnd: 'C' })).toBe('D');
    expect(useEditorStore.getState().addLengthCalculation('A', 'B', 'dAB', 'cm')).toBe(true);
    expect(useEditorStore.getState().addUnitConversion('pt_to_cm', '28.45274', 'oneCm')).toBe(true);
    expect(useEditorStore.getState().addUnitConversion('cm_to_pt', '1', 'onePt')).toBe(true);
    expect(useEditorStore.getState().addLengthCalculation('A', 'A', 'bad')).toBe(false);
    expect(useEditorStore.getState().addUnitConversion('pt_to_cm', '1', 'bad-name')).toBe(false);

    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDuplicateSegment(A,B)(A,C)\n\\tkzGetPoint{D}');
    expect(source).toContain('\\tkzDrawSegment(A,D)');
    expect(source).toContain('\\tkzCalcLength[cm](A,B)\n\\tkzGetLength{dAB}');
    expect(source).toContain('\\tkzpttocm(28.45274){oneCm}');
    expect(source).toContain('\\tkzcmtopt(1){onePt}');
  });

  it('adds point coordinate, swap, dot product and power circle commands', () => {
    expect(useEditorStore.getState().addPointCoordinates('A', 'coordA')).toBe(true);
    expect(useEditorStore.getState().addSwapPoints('A', 'B')).toBe(true);
    expect(useEditorStore.getState().addDotProduct('A', 'B', 'B', 'dotABB')).toBe(true);
    expect(useEditorStore.getState().addPowerCircle('A', 'B', 'C', 'powerA')).toBe(true);
    expect(useEditorStore.getState().addPointCoordinates('A', 'bad-name')).toBe(false);
    expect(useEditorStore.getState().addSwapPoints('A', 'A')).toBe(false);
    expect(useEditorStore.getState().addDotProduct('A', 'A', 'B', 'bad')).toBe(false);
    expect(useEditorStore.getState().addPowerCircle('A', 'B', 'B', 'bad')).toBe(false);

    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzGetPointCoord(A){coordA}');
    expect(source).toContain('\\tkzSwapPoints(A,B)');
    expect(source).toContain('\\tkzDotProduct(A,B,B)\n\\tkzGetResult{dotABB}');
    expect(source).toContain('\\tkzPowerCircle(A)(B,C)\n\\tkzGetResult{powerA}');
  });

  it('adds radical axis and boolean geometry test commands', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(2,0){B}\n\\tkzDefPoint(5,0){C}\n\\tkzDefPoint(6,0){D}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Point', name: 'C', x: 5, y: 0 },
        { type: 'Point', name: 'D', x: 6, y: 0 },
      ],
    });

    expect(useEditorStore.getState().addRadicalAxis({ circle1: ['A', 'B'], circle2: ['C', 'D'] })).toEqual(['E', 'F']);
    expect(useEditorStore.getState().addRadicalAxis({ circle1: ['A', 'A'], circle2: ['C', 'D'] })).toBeNull();
    expect(useEditorStore.getState().addLinearityTest(['A', 'B', 'C'])).toBe(true);
    expect(useEditorStore.getState().addLinearityTest(['A', 'B', 'B'])).toBe(false);
    expect(useEditorStore.getState().addOrthogonalityTest(['A', 'B', 'C'])).toBe(true);
    expect(useEditorStore.getState().addOrthogonalityTest(['A', 'A', 'C'])).toBe(false);

    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefRadicalAxis(A,B)(C,D)\n\\tkzGetPoints{E}{F}');
    expect(source).toContain('\\tkzDrawLine[add=1 and 1](E,F)');
    expect(source).toContain('\\tkzIsLinear(A,B,C)\n\\iftkzLinear');
    expect(source).toContain('\\tkzIsOrtho(A,B,C)\n\\iftkzOrtho');
  });

  it('adds angle calculations and retrieves tkzAngleResult', () => {
    expect(useEditorStore.getState().addAngleCalculation('angle', ['A', 'B', 'C'], 'angleABC')).toBe(true);
    expect(useEditorStore.getState().addAngleCalculation('slope', ['A', 'B'])).toBe(true);
    expect(useEditorStore.getState().addAngleRetrieval('slopeAB')).toBe(true);
    expect(useEditorStore.getState().addAngleRetrieval('bad-name')).toBe(false);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzFindAngle(A,B,C)\n\\tkzGetAngle{angleABC}');
    expect(source).toContain('\\tkzFindSlopeAngle(A,B)');
    expect(source).toContain('\\tkzGetAngle{slopeAB}');
  });

  it('adds all tkzDefRandPointOn modes', () => {
    expect(useEditorStore.getState().addRandomPoint({ mode: 'rectangle', references: ['A', 'B'] })).toBeTruthy();
    expect(useEditorStore.getState().addRandomPoint({ mode: 'segment', references: ['A', 'B'] })).toBeTruthy();
    expect(useEditorStore.getState().addRandomPoint({ mode: 'line', references: ['A', 'B'] })).toBeTruthy();
    expect(useEditorStore.getState().addRandomPoint({ mode: 'circle', references: ['A'], radius: 2 })).toBeTruthy();
    expect(useEditorStore.getState().addRandomPoint({ mode: 'circle_through', references: ['A', 'B'] })).toBeTruthy();
    expect(useEditorStore.getState().addRandomPoint({ mode: 'disk_through', references: ['A', 'B'] })).toBeTruthy();
    const source = useEditorStore.getState().source;
    for (const option of ['rectangle=A and B', 'segment=A--B', 'line=A--B', 'circle=center A radius 2', 'circle through=center A through B', 'disk through=center A through B']) {
      expect(source).toContain(`\\tkzDefRandPointOn[${option}]`);
    }
  });

  it('adds single and double-result tkzDefLine constructions', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(2,0){B}\n\\tkzDefPoint(0,2){C}\n\\tkzDefPoint(4,2){D}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Point', name: 'C', x: 0, y: 2 }, { type: 'Point', name: 'D', x: 4, y: 2 },
      ],
    });
    expect(useEditorStore.getState().addDefinedLine({ mode: 'mediator', points: ['A', 'B'] })).toEqual(['E', 'F']);
    expect(useEditorStore.getState().source).toContain('\\tkzDefLine[mediator](A,B)\n\\tkzGetPoints{E}{F}\n\\tkzDrawLine(E,F)');
    expect(useEditorStore.getState().addDefinedLine({ mode: 'parallel', points: ['A', 'B'], through: 'C', factor: 2, normed: true })).toEqual(['G']);
    expect(useEditorStore.getState().source).toContain('\\tkzDefLine[parallel=through C,K=2,normed](A,B)');
    expect(useEditorStore.getState().addDefinedLine({ mode: 'bisector_out', points: ['A', 'B', 'C'] })).toEqual(['H']);
    expect(useEditorStore.getState().source).toContain('\\tkzDefLine[bisector out](A,B,C)');
    expect(useEditorStore.getState().addDefinedLine({ mode: 'tangent_from', points: ['A', 'B'], through: 'D' })).toEqual(['I', 'J']);
    expect(useEditorStore.getState().source).toContain('\\tkzDefLine[tangent from=D](A,B)\n\\tkzGetPoints{I}{J}\n\\tkzDrawSegments(D,I D,J)');
  });

  it('adds every tkzDefTriangle option and swap', () => {
    const modes = ['equilateral', 'half', 'isosceles_right', 'pythagore', 'pythagoras', 'egyptian', 'school', 'gold', 'euclid', 'golden', 'sublime', 'cheops'] as const;
    for (const mode of modes) expect(useEditorStore.getState().addDefinedTriangle({ mode, p1: 'A', p2: 'B' })).not.toBeNull();
    expect(useEditorStore.getState().addDefinedTriangle({ mode: 'two_angles', p1: 'A', p2: 'B', angle1: 50, angle2: 70, swap: true })).not.toBeNull();
    const source = useEditorStore.getState().source;
    for (const mode of modes) expect(source).toContain(`\\tkzDefTriangle[${mode.replace('_', ' ')}](A,B)`);
    expect(source).toContain('\\tkzDefTriangle[two angles=50 and 70,swap](A,B)');
    expect(source).toContain('\\tkzDrawPolygon(A,B,');
  });

  it('adds an associated triangle with automatic names or a name prefix', () => {
    const automatic = useEditorStore.getState().addAssociatedTriangle({ mode: 'orthic', p1: 'A', p2: 'B', p3: 'C' });
    expect(automatic).toEqual(['B', 'C', 'D']);
    expect(useEditorStore.getState().source).toContain('\\tkzDefSpcTriangle[orthic](A,B,C){B,C,D}');
    expect(useEditorStore.getState().source).toContain('\\tkzDrawPolygon(B,C,D)');

    const prefixed = useEditorStore.getState().addAssociatedTriangle({ mode: 'feuerbach', p1: 'A', p2: 'B', p3: 'C', namePrefix: 'F' });
    expect(prefixed).toEqual(['Fa', 'Fb', 'Fc']);
    expect(useEditorStore.getState().source).toContain('\\tkzDefSpcTriangle[feuerbach,name=F](A,B,C){a,b,c}');
    expect(useEditorStore.getState().addPoint(1, 1)).toBe('E');
  });

  it('adds all polygon constructions with unique result names', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(4,0){B}\n\\tkzDefPoint(1,3){C}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 4, y: 0 },
        { type: 'Point', name: 'C', x: 1, y: 3 },
      ],
    });
    expect(useEditorStore.getState().addPolygonConstruction({ mode: 'square', points: ['A', 'B'] })).toEqual(['D', 'E']);
    expect(useEditorStore.getState().addPolygonConstruction({ mode: 'rectangle', points: ['A', 'C'] })).toEqual(['F', 'G']);
    expect(useEditorStore.getState().addPolygonConstruction({ mode: 'parallelogram', points: ['A', 'B', 'C'] })).toEqual(['H']);
    expect(useEditorStore.getState().addPolygonConstruction({ mode: 'permute', points: ['A', 'B', 'C'] })).toEqual(['B', 'C']);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefSquare(A,B)\n\\tkzGetPoints{D}{E}\n\\tkzDrawPolygon(A,B,D,E)');
    expect(source).toContain('\\tkzDefRectangle(A,C)\n\\tkzGetPoints{F}{G}\n\\tkzDrawPolygon(A,F,C,G)');
    expect(source).toContain('\\tkzDefParallelogram(A,B,C)\n\\tkzGetPoint{H}\n\\tkzDrawPolygon(A,B,C,H)');
    expect(source).toContain('\\tkzPermute(A,B,C)\n\\tkzDrawPolygon(A,B,C)');
  });

  it('adds a golden rectangle and every regular-polygon option', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(4,0){B}\n\\end{tikzpicture}`,
      parsedNodes: [{ type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 4, y: 0 }],
    });
    expect(useEditorStore.getState().addPolygonConstruction({ mode: 'golden_rectangle', points: ['A', 'B'] })).toEqual(['C', 'D']);
    expect(useEditorStore.getState().addPolygonConstruction({ mode: 'regular_polygon', points: ['A', 'B'], regularMode: 'side', sides: 7, namePrefix: 'R' }))
      .toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefGoldenRectangle(A,B)\n\\tkzGetPoints{C}{D}');
    expect(source).toContain('\\tkzDefRegPolygon[side,sides=7,name=R](A,B)');
    expect(source).toContain('\\tkzDrawPolygon(R1,R2,R3,R4,R5,R6,R7)');
  });

  it('adds all tkzDefCircle modes with their local options', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(4,0){B}\n\\tkzDefPoint(0,3){C}\n\\tkzDefPoint(3,2){D}\n\\tkzDefPoint(-2,1){E}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 4, y: 0 },
        { type: 'Point', name: 'C', x: 0, y: 3 }, { type: 'Point', name: 'D', x: 3, y: 2 },
        { type: 'Point', name: 'E', x: -2, y: 1 },
      ],
    });
    expect(useEditorStore.getState().addDefinedCircle({ mode: 'R', points: ['A'], value: 2 })).toHaveLength(1);
    expect(useEditorStore.getState().addDefinedCircle({ mode: 'diameter', points: ['A', 'B'] })).toHaveLength(2);
    for (const mode of ['circum', 'in', 'ex', 'euler', 'nine', 'spieker'] as const) {
      expect(useEditorStore.getState().addDefinedCircle({ mode, points: ['A', 'B', 'C'] })).toHaveLength(2);
    }
    expect(useEditorStore.getState().addDefinedCircle({ mode: 'apollonius', points: ['A', 'B'], value: 2 })).toHaveLength(2);
    expect(useEditorStore.getState().addDefinedCircle({ mode: 'orthogonal_from', points: ['A', 'B'], references: ['D'] })).toHaveLength(2);
    expect(useEditorStore.getState().addDefinedCircle({ mode: 'orthogonal_through', points: ['A', 'B'], references: ['D', 'E'] })).toHaveLength(2);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefCircle[R](A,2)');
    expect(source).toContain('\\tkzDefCircle[apollonius,K=2](A,B)');
    expect(source).toContain('\\tkzDefCircle[orthogonal from=D](A,B)');
    expect(source).toContain('\\tkzDefCircle[orthogonal through=D and E](A,B)');
  });

  it('adds projected excenters and circle transformations', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(4,0){B}\n\\tkzDefPoint(0,3){C}\n\\tkzDefPoint(1,1){D}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 4, y: 0 },
        { type: 'Point', name: 'C', x: 0, y: 3 }, { type: 'Point', name: 'D', x: 1, y: 1 },
      ],
    });
    expect(useEditorStore.getState().addProjectedExcenters({ p1: 'A', p2: 'B', p3: 'C', namePrefix: 'J', excenterSuffixes: ['a', 'b', 'c'], projectionPrefixes: ['X', 'Y', 'Z'] })).toHaveLength(9);
    expect(useEditorStore.getState().addCircleTransformation({ mode: 'rotation', center: 'A', radiusPoint: 'B', references: ['C'], value: '30' })).toHaveLength(2);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefSpcTriangle[excentral,name=J](A,B,C){a,b,c}');
    expect(source).toContain('\\tkzDefProjExcenter[name=J](A,B,C)(a,b,c){X,Y,Z}');
    expect(source).toContain('\\tkzDefCircleBy[rotation=center C angle 30](A,B)');
  });

  it('adds every tkzInterLC circle definition and tkzTestInterLC', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(-3,0){A}\n\\tkzDefPoint(3,0){B}\n\\tkzDefPoint(0,0){O}\n\\tkzDefPoint(2,0){C}\n\\tkzDefPoint(0,2){D}\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: -3, y: 0 }, { type: 'Point', name: 'B', x: 3, y: 0 },
        { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'C', x: 2, y: 0 },
        { type: 'Point', name: 'D', x: 0, y: 2 },
      ],
    });
    expect(useEditorStore.getState().addLineCircleIntersection({ mode: 'N', line: ['A', 'B'], circle: ['O', 'C'], near: true })).toHaveLength(2);
    expect(useEditorStore.getState().addLineCircleIntersection({ mode: 'R', line: ['A', 'B'], circle: ['O'], radius: 2 })).toHaveLength(2);
    expect(useEditorStore.getState().addLineCircleIntersection({ mode: 'with_nodes', line: ['A', 'B'], circle: ['O', 'C', 'D'], common: 'C' })).toHaveLength(2);
    expect(useEditorStore.getState().addLineCircleTest(['A', 'B'], ['O', 'C'])).toBe(true);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzInterLC[near](A,B)(O,C)');
    expect(source).toContain('\\tkzInterLC[R](A,B)(O,2)');
    expect(source).toContain('\\tkzInterLC[with nodes,common=C](A,B)(O,C,D)');
    expect(source).toContain('\\tkzTestInterLC(A,B)(O,C)\n\\iftkzFlagLC');
  });

  it('adds every tkzInterCC definition and tkzTestInterCC', () => {
    expect(useEditorStore.getState().addCircleCircleIntersection({ mode: 'N', circles: [['A', 'B'], ['C', 'D']], common: 'B' })).toHaveLength(2);
    expect(useEditorStore.getState().addCircleCircleIntersection({ mode: 'R', circles: [['A'], ['C']], radii: [2, 3] })).toHaveLength(2);
    expect(useEditorStore.getState().addCircleCircleIntersection({ mode: 'with_nodes', circles: [['A', 'B', 'C'], ['D', 'E', 'F']] })).toHaveLength(2);
    expect(useEditorStore.getState().addCircleCircleTest([['A', 'B'], ['C', 'D']])).toBe(true);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzInterCC[common=B](A,B)(C,D)');
    expect(source).toContain('\\tkzInterCC[R](A,2)(C,3)');
    expect(source).toContain('\\tkzInterCC[with nodes](A,B,C)(D,E,F)');
    expect(source).toContain('\\tkzTestInterCC(A,B)(C,D)\n\\iftkzFlagCC');
  });

  it('adds a segment correctly', () => {
    useEditorStore.getState().addSegment('A', 'B');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDrawSegment(A,B)');
  });

  it('optionally adds editable labels to newly drawn single shapes', () => {
    useEditorStore.setState({
      autoLabelShapes: {
        segments: true,
        lines: true,
        angles: false,
        circles: true,
        arcs: true,
      },
    });

    useEditorStore.getState().addSegment('A', 'B');
    useEditorStore.getState().addLine('A', 'C');
    useEditorStore.getState().addAngle('A', 'B', 'C');
    useEditorStore.getState().addCircle('O', 'A');
    useEditorStore.getState().addArc('O', 'A', 'B');

    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzLabelSegment[auto](A,B){$AB$}');
    expect(source).toContain('\\tkzLabelLine[pos=.5](A,C){$(AC)$}');
    expect(source).toContain('\\tkzMarkAngle[size=0.5](A,B,C)');
    expect(source).not.toContain('\\tkzLabelAngle[pos=0.7](A,B,C)');
    expect(source).toContain('\\tkzLabelCircle[above](O,A)(45){$\\mathcal{C}$}');
    expect(source).toContain('\\tkzLabelArc[pos=.5](O,A,B){$\\frown AB$}');
  });

  it('adds styled single and multiple lines and segments', () => {
    useEditorStore.getState().addLine('A', 'B', 'add=1 and 2, dashed');
    expect(useEditorStore.getState().addLines([['A', 'C'], ['B', 'D']], 'color=blue')).toBe(true);
    useEditorStore.getState().addSegment('A', 'D', 'dim={$5$,10pt,midway}');
    expect(useEditorStore.getState().addSegments([['A', 'B'], ['C', 'D']], '->')).toBe(true);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDrawLine[add=1 and 2, dashed](A,B)');
    expect(source).toContain('\\tkzDrawLines[color=blue](A,C B,D)');
    expect(source).toContain('\\tkzDrawSegment[dim={$5$,10pt,midway}](A,D)');
    expect(source).toContain('\\tkzDrawSegments[->](A,B C,D)');
  });

  it('adds polygonal chains, multiple circles and semicircles', () => {
    expect(useEditorStore.getState().addPolySeg(['A', 'B', 'C'], 'dashed')).toBe(true);
    expect(useEditorStore.getState().addCircles([['A', 'B'], ['C', 'D']], 'blue')).toBe(true);
    useEditorStore.getState().addSemiCircle('A', 'C', 'swap');
    expect(useEditorStore.getState().addSemiCircles([['A', 'B'], ['C', 'D']], 'fill=red!20')).toBe(true);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDrawPolySeg[dashed](A,B,C)');
    expect(source).toContain('\\tkzDrawCircles[blue](A,B C,D)');
    expect(source).toContain('\\tkzDrawSemiCircle[swap](A,C)');
    expect(source).toContain('\\tkzDrawSemiCircles[fill=red!20](A,B C,D)');
  });

  it('adds an arc from a center, start point, and end point', () => {
    useEditorStore.getState().addArc('O', 'A', 'B');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDrawArc(O,A)(B)');
  });

  it('adds a sector directly from a center, start point, and end direction', () => {
    useEditorStore.getState().addSector('O', 'A', 'B');
    expect(useEditorStore.getState().source).toContain('\\tkzDrawSector(O,A)(B)');
  });

  it('adds circle, polygon, sector and angle fills with visible defaults', () => {
    useEditorStore.getState().fillCircle('O', 'A');
    expect(useEditorStore.getState().fillPolygon(['A', 'B', 'C'])).toBe(true);
    useEditorStore.getState().fillSector('O', 'A', 'B');
    useEditorStore.getState().fillAngle('A', 'O', 'B');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzFillCircle[fill=blue!20](O,A)');
    expect(source).toContain('\\tkzFillPolygon[fill=blue!20](A,B,C)');
    expect(source).toContain('\\tkzFillSector[fill=blue!20](O,A)(B)');
    expect(source).toContain('\\tkzFillAngle[size=1, fill=blue!20](A,O,B)');
  });

  it('fills multiple angles with shared options', () => {
    expect(useEditorStore.getState().fillAngles([['A', 'O', 'B'], ['B', 'O', 'C']], 'size=2,fill=red!20')).toBe(true);
    expect(useEditorStore.getState().source).toContain('\\tkzFillAngles[size=2,fill=red!20](A,O,B B,O,C)');
  });

  it('adds canvas initialization and bounding-box commands', () => {
    useEditorStore.getState().addCanvasInit('xmin=-3,xmax=6,ymin=-1,ymax=5');
    useEditorStore.getState().addCanvasClip(0.5);
    useEditorStore.getState().addShowBoundingBox('color=red,dashed');
    useEditorStore.getState().addClipBoundingBox();
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzInit[xmin=-3,xmax=6,ymin=-1,ymax=5]');
    expect(source).toContain('\\tkzClip[space=0.5]');
    expect(source).toContain('\\tkzShowBB[color=red,dashed]');
    expect(source).toContain('\\tkzClipBB');
  });

  it('adds an ellipse with numeric radii and rotation', () => {
    expect(useEditorStore.getState().addEllipse('A', 4, 2, 45, 'color=blue')).toBe(true);
    expect(useEditorStore.getState().source).toContain('\\tkzDrawEllipse[color=blue](A,4,2,45)');
    expect(useEditorStore.getState().addEllipse('A', 0, 2, 0)).toBe(false);
  });

  it('adds a perpendicular line through a selected point', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: "Point", name: "A", x: 0, y: 0 },
        { type: "Point", name: "B", x: 4, y: 0 },
        { type: "Point", name: "C", x: 2, y: 2 },
      ],
      source: `\\begin{tikzpicture}
\\tkzDefPoint(0,0){A}
\\tkzDefPoint(4,0){B}
\\tkzDefPoint(2,2){C}
\\end{tikzpicture}`,
    });

    useEditorStore.getState().addPerpendicularLine('A', 'B', 'C');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefLine[orthogonal=through C](A,B)');
    expect(source).toContain('\\tkzGetPoint{D}');
    expect(source).toContain('\\tkzDrawLine[add=2 and 2](C,D)');
  });

  it('adds a perpendicular projection with foot and right-angle mark', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: "Point", name: "A", x: 0, y: 0 },
        { type: "Point", name: "B", x: 4, y: 0 },
        { type: "Point", name: "C", x: 2, y: 2 },
      ],
      source: `\\begin{tikzpicture}
\\tkzDefPoint(0,0){A}
\\tkzDefPoint(4,0){B}
\\tkzDefPoint(2,2){C}
\\end{tikzpicture}`,
    });

    useEditorStore.getState().addProjectionLine('A', 'B', 'C');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefPointBy[projection=onto A--B](C)');
    expect(source).toContain('\\tkzGetPoint{D}');
    expect(source).toContain('\\tkzDrawLine[add=2 and 2](C,D)');
    expect(source).toContain('\\tkzMarkRightAngle(C,D,A)');
    expect(source).toContain('\\tkzDrawPoints(D)');
  });

  it('adds a perpendicular bisector with two unique helper points', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: "Point", name: "A", x: 0, y: 0 },
        { type: "Point", name: "B", x: 4, y: 0 },
      ],
      source: `\\begin{tikzpicture}
\\tkzDefPoint(0,0){A}
\\tkzDefPoint(4,0){B}
\\end{tikzpicture}`,
    });

    useEditorStore.getState().addPerpendicularBisector('A', 'B');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefLine[mediator](A,B)');
    expect(source).toContain('\\tkzGetPoints{C}{D}');
    expect(source).toContain('\\tkzDrawLine[add=.5 and .5](C,D)');
  });

  it('adds an internal angle bisector through the middle vertex', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: "Point", name: "A", x: 0, y: 0 },
        { type: "Point", name: "B", x: 2, y: 2 },
        { type: "Point", name: "C", x: 4, y: 0 },
      ],
      source: `\\begin{tikzpicture}
\\tkzDefPoint(0,0){A}
\\tkzDefPoint(2,2){B}
\\tkzDefPoint(4,0){C}
\\end{tikzpicture}`,
    });

    useEditorStore.getState().addAngleBisector('A', 'B', 'C');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefLine[bisector](A,B,C)');
    expect(source).toContain('\\tkzGetPoint{D}');
    expect(source).toContain('\\tkzDrawLine[add=0 and 1](B,D)');
  });

  it('adds one triangle altitude with its foot and right-angle mark', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: "Point", name: "A", x: 0, y: 0 },
        { type: "Point", name: "B", x: 2, y: 3 },
        { type: "Point", name: "C", x: 5, y: 0 },
      ],
      source: `\\begin{tikzpicture}
\\tkzDefPoint(0,0){A}
\\tkzDefPoint(2,3){B}
\\tkzDefPoint(5,0){C}
\\end{tikzpicture}`,
    });

    useEditorStore.getState().addTriangleAltitude('A', 'B', 'C');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefLine[altitude](A,B,C)');
    expect(source).toContain('\\tkzGetPoint{D}');
    expect(source).toContain('\\tkzDrawSegment(B,D)');
    expect(source).toContain('\\tkzDrawPoints(D)');
    expect(source).toContain('\\tkzMarkRightAngle(B,D,A)');
  });

  it('adds all altitudes, their feet, and the orthocenter', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: "Point", name: "A", x: 0, y: 0 },
        { type: "Point", name: "B", x: 2, y: 3 },
        { type: "Point", name: "C", x: 5, y: 0 },
      ],
      source: `\\begin{tikzpicture}
\\tkzDefPoint(0,0){A}
\\tkzDefPoint(2,3){B}
\\tkzDefPoint(5,0){C}
\\end{tikzpicture}`,
    });

    useEditorStore.getState().addAllAltitudes('A', 'B', 'C');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefSpcTriangle[ortho](A,B,C){D,E,F}');
    expect(source).toContain('\\tkzDefTriangleCenter[ortho](A,B,C)');
    expect(source).toContain('\\tkzGetPoint{G}');
    expect(source).toContain('\\tkzDrawSegments(A,D B,E C,F)');
    expect(source).toContain('\\tkzDrawPoints(D,E,F,G)');
    expect(source).toContain('\\tkzMarkRightAngles(A,D,C B,E,A C,F,A)');
  });

  it('does not reuse a helper point name from a construction', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}
\\tkzDefPoint(0,0){A}
\\tkzGetPoint{B}
\\end{tikzpicture}`,
      parsedNodes: [{ type: "Point", name: "A", x: 0, y: 0 }],
    });

    expect(useEditorStore.getState().addPoint(1, 1)).toBe('C');
  });

  it('updates point coordinates correctly', () => {
    // Inject a specific string to be updated
    useEditorStore.setState({
      source: `\\begin{tikzpicture}
\\tkzDefPoint(0,0){A}
\\end{tikzpicture}`
    });
    useEditorStore.getState().updatePointCoords('A', 1.5, 2.5);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzDefPoint(1.5,2.5){A}');
    expect(source).not.toContain('\\tkzDefPoint(0,0){A}');
    expect(useEditorStore.getState().parsedNodes).toContainEqual({ type: 'Point', name: 'A', x: 1.5, y: 2.5 });
  });

  it('updates cached resolved point coordinates during point dragging', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}
\\tkzDefPoint(0,0){A}
\\tkzDefPoint(2,0){B}
\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
      ],
      resolvedPoints: { A: { x: 0, y: 0 }, B: { x: 2, y: 0 } },
    });

    useEditorStore.getState().updatePointCoords('A', 1.5, 2.5);

    expect(useEditorStore.getState().resolvedPoints).toMatchObject({
      A: { x: 1.5, y: 2.5 },
      B: { x: 2, y: 0 },
    });
  });

  it('keeps polar syntax when a polar point is dragged', () => {
    useEditorStore.setState({
      source: `\\begin{tikzpicture}
\\tkzDefPoint(45:2){A}
\\end{tikzpicture}`,
      parsedNodes: [{
        type: 'Point', name: 'A', x: Math.SQRT2, y: Math.SQRT2,
        coordinate_mode: 'polar', angle: 45, distance: 2,
      }],
    });

    useEditorStore.getState().updatePointCoords('A', 0, 3);

    expect(useEditorStore.getState().source).toContain('\\tkzDefPoint(90:3){A}');
    expect(useEditorStore.getState().parsedNodes[0]).toMatchObject({ angle: 90, distance: 3 });
  });

  it('requests fit-to-view without changing the drawing source', () => {
    const sourceBefore = useEditorStore.getState().source;
    useEditorStore.getState().requestFitView();

    expect(useEditorStore.getState().fitViewRequest).toBe(1);
    expect(useEditorStore.getState().source).toBe(sourceBefore);
  });

  it('adds an angle correctly with automatic label', () => {
    useEditorStore.getState().addAngle('A', 'B', 'C');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzMarkAngle[size=0.5](A,B,C)');
    expect(source).toContain('\\tkzLabelAngle[pos=0.7](A,B,C){$\\alpha$}');
  });

  it('adds single, multiple and arc markings', () => {
    useEditorStore.getState().addSegmentMark('A', 'B');
    expect(useEditorStore.getState().addSegmentsMark([['A', 'B'], ['C', 'D']], 'mark=||,color=red')).toBe(true);
    useEditorStore.getState().addArcMark('O', 'A', 'B', 'mark=x,pos=.4');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzMarkSegment[mark=|,size=4pt,pos=.5](A,B)');
    expect(source).toContain('\\tkzMarkSegments[mark=||,color=red](A,B C,D)');
    expect(source).toContain('\\tkzMarkArc[mark=x,pos=.4](O,A,B)');
    expect(useEditorStore.getState().addSegmentsMark([['A', 'A']])).toBe(false);
  });

  it('adds multiple angle marks and right-angle marks', () => {
    expect(useEditorStore.getState().addAnglesMark([['A', 'O', 'B'], ['B', 'O', 'C']], 'arc=ll,mark=|')).toBe(true);
    useEditorStore.getState().addRightAngleMark('A', 'H', 'B', 'size=.4,fill=blue!20');
    expect(useEditorStore.getState().addRightAnglesMark([['A', 'H', 'B'], ['C', 'K', 'D']], 'german,dotsize=4pt')).toBe(true);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzMarkAngles[arc=ll,mark=|](A,O,B B,O,C)');
    expect(source).toContain('\\tkzMarkRightAngle[size=.4,fill=blue!20](A,H,B)');
    expect(source).toContain('\\tkzMarkRightAngles[german,dotsize=4pt](A,H,B C,K,D)');
    expect(useEditorStore.getState().addAnglesMark([['A', 'A', 'B']])).toBe(false);
  });

  it('adds TikZ pic angle annotations', () => {
    useEditorStore.getState().addPicAngle('A', 'O', 'B', 'draw=orange,angle radius=1cm,pic text=$\\alpha$');
    useEditorStore.getState().addPicRightAngle('C', 'H', 'A', 'draw,red,angle eccentricity=.5,pic text=.');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzPicAngle[draw=orange,angle radius=1cm,pic text=$\\alpha$](A,O,B)');
    expect(source).toContain('\\tkzPicRightAngle[draw,red,angle eccentricity=.5,pic text=.](C,H,A)');
  });

  it('adds singular, grouped and automatic point labels', () => {
    useEditorStore.getState().addPointLabel('A', '$P$', 'above,color=red');
    expect(useEditorStore.getState().addPointLabels(['A', 'B', 'A'], 'below')).toBe(true);
    expect(useEditorStore.getState().addAutoPointLabels('O', ['A', 'B', 'O'], 0.2, 'color=blue')).toBe(true);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzLabelPoint[above,color=red](A){$P$}');
    expect(source).toContain('\\tkzLabelPoints[below](A,B)');
    expect(source).toContain('\\tkzAutoLabelPoints[center=O,dist=0.2,color=blue](A,B)');
    expect(useEditorStore.getState().addAutoPointLabels('', ['A'])).toBe(false);
  });

  it('adds segment collection and line labels', () => {
    useEditorStore.getState().addSegmentLabel('A', 'B', '$c$', 'auto,swap');
    expect(useEditorStore.getState().addSegmentLabels([['A', 'B'], ['B', 'C']], '$a$', 'above=4pt,color=red')).toBe(true);
    useEditorStore.getState().addLineLabel('C', 'D', '$(d)$', 'pos=1.25,below left');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzLabelSegment[auto,swap](A,B){$c$}');
    expect(source).toContain('\\tkzLabelSegments[above=4pt,color=red](A,B B,C){$a$}');
    expect(source).toContain('\\tkzLabelLine[pos=1.25,below left](C,D){$(d)$}');
  });

  it('adds single and multiple angle labels and circle labels', () => {
    useEditorStore.getState().addAngleLabel('A', 'O', 'B', '$60^{\\circ}$', 'pos=1.5');
    expect(useEditorStore.getState().addAngleLabels([['A', 'O', 'B'], ['B', 'O', 'C']], '$\\alpha$', 'pos=2')).toBe(true);
    useEditorStore.getState().addCircleLabel('O', 'A', 120, '$\\mathcal{C}$', 'above=4pt,color=blue');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzLabelAngle[pos=1.5](A,O,B){$60^{\\circ}$}');
    expect(source).toContain('\\tkzLabelAngles[pos=2](A,O,B B,O,C){$\\alpha$}');
    expect(source).toContain('\\tkzLabelCircle[above=4pt,color=blue](O,A)(120){$\\mathcal{C}$}');
  });

  it('adds an arc label', () => {
    useEditorStore.getState().addArcLabel('O', 'A', 'B', '$\\widearc{AB}$', 'pos=.6,color=red');
    expect(useEditorStore.getState().source).toContain('\\tkzLabelArc[pos=.6,color=red](O,A,B){$\\widearc{AB}$}');
  });

  it('adds compass traces and shown line constructions', () => {
    useEditorStore.getState().addCompass('A', 'B', 'delta=20,color=red');
    expect(useEditorStore.getState().addCompasses([['A', 'C'], ['B', 'C']], 'length=1.5')).toBe(true);
    expect(useEditorStore.getState().addShowLine({ mode: 'parallel', points: ['A', 'B'], through: 'C', gap: 3, length: 2 })).toBe(true);
    expect(useEditorStore.getState().addShowTransformation({ mode: 'projection', source: 'C', references: ['A', 'B'], gap: -2, size: 3 })).toBe(true);
    expect(useEditorStore.getState().addProtractor('A', 'B', 'scale=1.2,return')).toBe(true);
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzCompass[delta=20,color=red](A,B)');
    expect(source).toContain('\\tkzCompasss[length=1.5](A,C B,C)');
    expect(source).toContain('\\tkzShowLine[parallel=through C,length=2,gap=3](A,B)');
    expect(source).toContain('\\tkzShowTransformation[projection=onto A--B,gap=-2,size=3](C)');
    expect(source).toContain('\\tkzProtractor[scale=1.2,return](A,B)');
  });

  it('adds an intersection correctly with automatic name', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: "Point", name: "A", x: 0, y: 0 },
        { type: "Point", name: "B", x: 1, y: 1 },
        { type: "Point", name: "C", x: 2, y: 2 },
        { type: "Point", name: "D", x: 3, y: 3 }
      ]
    });
    useEditorStore.getState().addIntersection('A', 'B', 'C', 'D');
    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzInterLL(A,B)(C,D)');
    expect(source).toContain('\\tkzGetPoint{E}');
    expect(source).toContain('\\tkzDrawPoints(E)');
    expect(source).toContain('\\tkzLabelPoint(E){$E$}');
  });
});
