import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConstructionInspector, constructionReferenceNames, getConstructionAppearanceConfig } from './ConstructionInspector';
import { AstNode, useEditorStore } from '../store';

describe('ConstructionInspector', () => {
  it('connects a defined triangle to its outline, generated point and label commands', () => {
    const node: AstNode = { type: 'DefinedTriangle', mode: 'equilateral', p1: 'A', p2: 'B', swap: false, name: 'C' };
    const config = getConstructionAppearanceConfig(node);
    expect(config.appearance.map(item => item.label)).toEqual(['Triangle outline', 'Generated points', 'Point labels']);
  });

  it('updates outline and point-label options from one logical construction panel', () => {
    const node: AstNode = { type: 'DefinedTriangle', mode: 'equilateral', p1: 'A', p2: 'B', swap: false, name: 'C' };
    const source = '\\tkzDefTriangle[equilateral](A,B)\n\\tkzGetPoint{C}\n\\tkzDrawPolygon(A,B,C)\n\\tkzDrawPoints(C)\n\\tkzLabelPoints(C)';
    const setSource = vi.fn();
    render(<ConstructionInspector node={node} source={source} setSource={setSource} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Triangle outline color'), { target: { value: 'red' } });
    fireEvent.click(screen.getByLabelText('Apply Triangle outline options'));
    expect(setSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzDrawPolygon[color=red](A,B,C)'));
    fireEvent.change(screen.getByLabelText('Point labels position'), { target: { value: 'above' } });
    fireEvent.click(screen.getByLabelText('Apply Point labels options'));
    expect(setSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzLabelPoints[above](C)'));
  });

  it('exposes missing draw-line styling for tkzDefLine constructions', () => {
    const node: AstNode = { type: 'DefinedLine', mode: 'parallel', points: ['A', 'B'], through: 'C', factor: 1, normed: false, results: ['D'] };
    const config = getConstructionAppearanceConfig(node);
    expect(config.appearance[0]).toMatchObject({ label: 'Constructed line', target: { command: 'tkzDrawLine', arguments: 'C,D' } });
  });

  it('updates construction references and all dependent draw commands', () => {
    const node: AstNode = { type: 'DefinedTriangle', mode: 'equilateral', p1: 'A', p2: 'B', swap: false, name: 'C' };
    const source = '\\tkzDefTriangle[equilateral](A,B)\n\\tkzGetPoint{C}\n\\tkzDrawPolygon(A,B,C)\n\\tkzDrawPoints(C)\n\\tkzLabelPoints(C)';
    const setSource = vi.fn();
    render(<ConstructionInspector node={node} source={source} pointNames={['A', 'B', 'D']} setSource={setSource} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Reference A'), { target: { value: 'D' } });
    fireEvent.click(screen.getByLabelText('Apply construction references'));
    expect(setSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzDefTriangle[equilateral](D,B)'));
    expect(setSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzDrawPolygon(D,B,C)'));
  });

  it('maps references from intersection and transformation families', () => {
    expect(constructionReferenceNames({ type: 'LineCircleIntersection', mode: 'N', line: ['A', 'B'], circle: ['O', 'C'], near: false, results: ['I', 'J'] })).toEqual(['A', 'B', 'O', 'C']);
    expect(constructionReferenceNames({ type: 'PointTransformation', mode: 'rotation', source: 'A', references: ['O'], value: '30', name: 'B' })).toEqual(['A', 'O']);
  });

  it('provides structured controls for safe numeric and boolean parameters', () => {
    const node: AstNode = { type: 'PointOnLine', p1: 'A', p2: 'B', position: 0.5, name: 'C' };
    const source = '\\tkzDefPointOnLine[pos=0.5](A,B)\n\\tkzGetPoint{C}\n\\tkzDrawPoints(C)\n\\tkzLabelPoints(C)';
    const setSource = vi.fn();
    render(<ConstructionInspector node={node} source={source} pointNames={['A', 'B']} setSource={setSource} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Construction position'), { target: { value: '0.75' } });
    fireEvent.click(screen.getByLabelText('Apply construction options'));
    expect(setSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzDefPointOnLine[pos=0.75](A,B)'));
  });

  it('maps primitive and classical construction references', () => {
    expect(constructionReferenceNames({ type: 'Segment', p1: 'A', p2: 'B' })).toEqual(['A', 'B']);
    expect(constructionReferenceNames({ type: 'TriangleAltitude', side1: 'A', vertex: 'B', side2: 'C', foot: 'H' })).toEqual(['A', 'B', 'C']);
    const config = getConstructionAppearanceConfig({ type: 'ProjectionLine', p1: 'A', p2: 'B', from: 'C', foot: 'H', options: 'add=2 and 2' });
    expect(config.appearance.map(item => item.label)).toContain('Right-angle mark');
  });

  it('adds a marking directly from an existing segment property', () => {
    const node: AstNode = { type: 'Segment', p1: 'A', p2: 'B' };
    const source = '\\tkzDrawSegment(A,B)';
    useEditorStore.setState({ source });
    render(<ConstructionInspector node={node} source={source} setSource={vi.fn()} onClose={() => undefined} />);
    fireEvent.click(screen.getByLabelText('Segment marking enabled'));
    expect(useEditorStore.getState().source).toContain('\\tkzDrawSegment(A,B)\n\\tkzMarkSegment[mark=|,size=4pt,pos=.5](A,B)');
  });

  it('writes middle arrow options from shape controls', () => {
    const source = '\\tkzDrawSegment(A,B)';
    const setSource = vi.fn();
    render(<ConstructionInspector node={{ type: 'Segment', p1: 'A', p2: 'B' }} source={source} setSource={setSource} onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('Segment arrow mode'), { target: { value: 'middle' } });
    fireEvent.change(screen.getByLabelText('Segment arrow tip'), { target: { value: 'Stealth' } });
    fireEvent.change(screen.getByLabelText('Segment arrow position'), { target: { value: '0.4' } });
    fireEvent.click(screen.getByLabelText('Apply Segment options'));

    expect(setSource).toHaveBeenCalledWith('\\tkzDrawSegment[tkz arrow={Stealth at .4}](A,B)');
  });

  it('edits standalone mark options and exposes arc marking only for point-defined arcs', () => {
    const setSource = vi.fn();
    const mark: AstNode = { type: 'ArcMark', center: 'O', start: 'A', end: 'B', options: 'mark=|' };
    const { unmount } = render(<ConstructionInspector node={mark} source="\\tkzMarkArc[mark=|](O,A,B)" setSource={setSource} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Mark symbol'), { target: { value: 'x' } });
    fireEvent.click(screen.getByLabelText('Apply mark options'));
    expect(setSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzMarkArc[mark=x](O,A,B)'));
    unmount();

    const arc: AstNode = { type: 'Arc', mode: 'R', center: 'O', first: '2', second: ['0', '90'], options: 'R' };
    render(<ConstructionInspector node={arc} source="\\tkzDrawArc[R](O,2)(0,90)" setSource={vi.fn()} onClose={() => undefined} />);
    expect(screen.getByLabelText('Arc marking enabled')).toBeDisabled();
  });

  it('edits angle-specific and right-angle-specific options', () => {
    const setAnglesSource = vi.fn();
    const angles: AstNode = { type: 'AnglesMark', angles: [['A', 'O', 'B'], ['B', 'O', 'C']], options: 'size=1' };
    const { unmount } = render(<ConstructionInspector node={angles} source="\\tkzMarkAngles[size=1](A,O,B B,O,C)" setSource={setAnglesSource} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Angle marks arc count'), { target: { value: 'll' } });
    fireEvent.change(screen.getByLabelText('Angle marks mark'), { target: { value: '|' } });
    fireEvent.click(screen.getByLabelText('Apply Angle marks options'));
    expect(setAnglesSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzMarkAngles[size=1, arc=ll, mark=|](A,O,B B,O,C)'));
    unmount();

    const setRightSource = vi.fn();
    const right: AstNode = { type: 'RightAngleMark', p1: 'A', vertex: 'H', p2: 'B', options: 'size=.25' };
    render(<ConstructionInspector node={right} source="\\tkzMarkRightAngle[size=.25](A,H,B)" setSource={setRightSource} onClose={() => undefined} />);
    fireEvent.click(screen.getByLabelText('Right-angle mark german'));
    fireEvent.click(screen.getByLabelText('Apply Right-angle mark options'));
    expect(setRightSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzMarkRightAngle[size=.25, german](A,H,B)'));
  });

  it('edits TikZ pic radius, eccentricity and text', () => {
    const setSource = vi.fn();
    const node: AstNode = { type: 'PicAngle', p1: 'A', vertex: 'O', p2: 'B', options: 'draw,angle radius=5mm' };
    render(<ConstructionInspector node={node} source="\\tkzPicAngle[draw,angle radius=5mm](A,O,B)" setSource={setSource} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('TikZ pic angle angle radius'), { target: { value: '1cm' } });
    fireEvent.change(screen.getByLabelText('TikZ pic angle angle eccentricity'), { target: { value: '1.2' } });
    fireEvent.change(screen.getByLabelText('TikZ pic angle pic text'), { target: { value: '$\\alpha$' } });
    fireEvent.click(screen.getByLabelText('Apply TikZ pic angle options'));
    expect(setSource).toHaveBeenCalledWith(expect.stringContaining('angle radius=1cm'));
    expect(setSource).toHaveBeenCalledWith(expect.stringContaining('angle eccentricity=1.2'));
    expect(setSource).toHaveBeenCalledWith(expect.stringContaining('pic text=$\\alpha$'));
  });

  it('adds and edits labels on existing segments and lines', () => {
    const segmentSource = '\\tkzDrawSegment(A,B)\n\\tkzLabelSegment[auto](A,B){$c$}';
    const setSegmentSource = vi.fn();
    const { unmount } = render(<ConstructionInspector node={{ type: 'Segment', p1: 'A', p2: 'B' }} source={segmentSource} pointNames={['A', 'B']} setSource={setSegmentSource} onClose={() => undefined} />);
    const textInput = screen.getByLabelText('Segment label text');
    fireEvent.change(textInput, { target: { value: '$d$' } });
    fireEvent.blur(textInput);
    expect(setSegmentSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzLabelSegment[auto](A,B){$d$}'));
    unmount();

    const lineSource = '\\tkzDrawLine(A,B)';
    const setLineSource = vi.fn();
    render(<ConstructionInspector node={{ type: 'Line', p1: 'A', p2: 'B' }} source={lineSource} pointNames={['A', 'B']} setSource={setLineSource} onClose={() => undefined} />);
    fireEvent.click(screen.getByLabelText('Line label enabled'));
    expect(setLineSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzLabelLine[pos=.5](A,B){$(AB)$}'));
  });

  it('edits a standalone segment label node', () => {
    const source = '\\tkzLabelSegment[auto](A,B){$c$}';
    const setSource = vi.fn();
    render(<ConstructionInspector node={{ type: 'LabelSegment', p1: 'A', p2: 'B', text: '$c$', options: 'auto' }} source={source} pointNames={['A', 'B']} setSource={setSource} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Segment label text'), { target: { value: '$d$' } });
    fireEvent.change(screen.getByLabelText('Segment label color'), { target: { value: 'red' } });
    fireEvent.click(screen.getByLabelText('Apply Segment label'));
    expect(setSource).toHaveBeenCalledWith('\\tkzLabelSegment[auto, color=red](A,B){$d$}');
  });

  it('edits a standalone angle retrieval macro', () => {
    const setSource = vi.fn();
    render(<ConstructionInspector node={{ type: 'AngleRetrieval', macro: 'angleAOB' }} source={'\\tkzGetAngle{angleAOB}'} setSource={setSource} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Angle retrieval macro'), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByLabelText('Apply angle retrieval macro'));
    expect(setSource).toHaveBeenCalledWith('\\tkzGetAngle{alpha}');
  });

  it('edits angle label text and adds a label to an existing circle', () => {
    const angleSource = '\\tkzMarkAngle(A,O,B)\n\\tkzLabelAngle[pos=1](A,O,B){$\\alpha$}';
    const setAngleSource = vi.fn();
    const { unmount } = render(<ConstructionInspector node={{ type: 'AngleMark', p1: 'A', vertex: 'O', p2: 'B', label: '$\\alpha$' }} source={angleSource} pointNames={['A', 'O', 'B']} setSource={setAngleSource} onClose={() => undefined} />);
    const angleText = screen.getByLabelText('Angle label text');
    fireEvent.change(angleText, { target: { value: '$60^{\\circ}$' } }); fireEvent.blur(angleText);
    expect(setAngleSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzLabelAngle[pos=1](A,O,B){$60^{\\circ}$}'));
    unmount();

    const setCircleSource = vi.fn();
    render(<ConstructionInspector node={{ type: 'Circle', center: 'O', radius_point: 'A' }} source="\\tkzDrawCircle(O,A)" pointNames={['O', 'A']} setSource={setCircleSource} onClose={() => undefined} />);
    fireEvent.click(screen.getByLabelText('Circle label enabled'));
    expect(setCircleSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzLabelCircle[above](O,A)(45){$\\mathcal{C}$}'));
  });

  it('adds and edits a label on an existing towards arc', () => {
    const setSource = vi.fn();
    const { rerender } = render(<ConstructionInspector node={{ type: 'Arc', mode: 'towards', center: 'O', first: 'A', second: ['B'] }} source={'\\tkzDrawArc(O,A)(B)'} pointNames={['O', 'A', 'B']} setSource={setSource} onClose={() => undefined} />);
    fireEvent.click(screen.getByLabelText('Arc label enabled'));
    expect(setSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzLabelArc[pos=.5](O,A,B){$\\frown AB$}'));

    rerender(<ConstructionInspector node={{ type: 'Arc', mode: 'towards', center: 'O', first: 'A', second: ['B'] }} source={'\\tkzDrawArc(O,A)(B)\n\\tkzLabelArc[pos=.5](O,A,B){$\\frown AB$}'} pointNames={['O', 'A', 'B']} setSource={setSource} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Arc label position'), { target: { value: '.75' } });
    expect(setSource).toHaveBeenCalledWith(expect.stringContaining('\\tkzLabelArc[pos=.75](O,A,B){$\\frown AB$}'));
  });
});
