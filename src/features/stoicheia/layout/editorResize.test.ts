import { describe, expect, it } from 'vitest';
import { clampEditorWidth, getEditorResizeBounds } from './editorResize';

describe('editor resize bounds', () => {
  it('reserves more canvas space while the inspector is visible', () => {
    expect(getEditorResizeBounds(1200, true)).toEqual({ minimum: 280, maximum: 680 });
    expect(getEditorResizeBounds(1200, false)).toEqual({ minimum: 280, maximum: 840 });
  });

  it('clamps pointer and keyboard resizing', () => {
    const bounds = getEditorResizeBounds(1200, true);
    expect(clampEditorWidth(100, bounds)).toBe(280);
    expect(clampEditorWidth(440, bounds)).toBe(440);
    expect(clampEditorWidth(900, bounds)).toBe(680);
  });

  it('keeps usable panes on narrow windows', () => {
    expect(getEditorResizeBounds(700, true)).toEqual({ minimum: 220, maximum: 220 });
  });
});
