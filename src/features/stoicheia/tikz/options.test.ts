import { describe, expect, it } from 'vitest';
import { parseFastStyle, splitTikzOptions } from './options';

describe('TikZ option adapter', () => {
  it('keeps commas inside nested values', () => {
    expect(splitTikzOptions('red, decoration={markings, mark=at position .5}, thick'))
      .toEqual(['red', 'decoration={markings, mark=at position .5}', 'thick']);
  });

  it('maps common stroke, fill, dash, arrow and extension options', () => {
    const style = parseFastStyle('color=blue, fill=yellow, very thick, densely dashed, opacity=.4, <->, add=1 and 2');

    expect(style).toMatchObject({
      stroke: '#2563eb',
      fill: '#ca8a04',
      strokeWidth: 1.8,
      dashArray: '5 3',
      opacity: 0.4,
      arrowStart: true,
      arrowEnd: true,
      arrowStartTip: 'default',
      arrowEndTip: 'default',
      extendBefore: 1,
      extendAfter: 2,
    });
  });

  it('maps named endpoint arrow tips and path arrows', () => {
    expect(parseFastStyle('Latex-Latex')).toMatchObject({
      arrowStart: true,
      arrowEnd: true,
      arrowStartTip: 'Latex',
      arrowEndTip: 'Latex',
    });
    expect(parseFastStyle('-{Stealth[scale=2]}')).toMatchObject({
      arrowStart: false,
      arrowEnd: true,
      arrowEndTip: 'Stealth',
      arrowEndScale: 2,
    });
    expect(parseFastStyle('>=Stealth,->')).toMatchObject({
      arrowEnd: true,
      arrowEndTip: 'Stealth',
    });
    expect(parseFastStyle('tkz arrow={To[scale=3] at .4}').arrowMiddle).toMatchObject({
      tip: 'To',
      scale: 3,
      position: 0.4,
      each: false,
    });
    expect(parseFastStyle('tkz arrows').arrowEach).toMatchObject({
      tip: 'default',
      position: 0.5,
      each: true,
    });
  });
});
