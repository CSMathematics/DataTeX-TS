import { describe, expect, it } from 'vitest';
import { clampInspectorWidth, getInspectorResizeBounds } from './inspectorResize';

describe('inspector resize bounds', () => {
  it('keeps both canvas and inspector usable', () => {
    expect(getInspectorResizeBounds(1000)).toEqual({ minimum: 240, maximum: 520 });
    expect(getInspectorResizeBounds(700)).toEqual({ minimum: 240, maximum: 340 });
    expect(getInspectorResizeBounds(500)).toEqual({ minimum: 240, maximum: 240 });
  });

  it('clamps pointer and keyboard resizing', () => {
    const bounds = getInspectorResizeBounds(800);
    expect(clampInspectorWidth(100, bounds)).toBe(240);
    expect(clampInspectorWidth(300, bounds)).toBe(300);
    expect(clampInspectorWidth(600, bounds)).toBe(440);
  });
});
