export interface EditorResizeBounds {
  minimum: number;
  maximum: number;
}

export const getEditorResizeBounds = (totalWidth: number, inspectorVisible: boolean): EditorResizeBounds => {
  const minimumCanvasWidth = inspectorVisible ? 520 : 360;
  const maximum = Math.max(220, Math.min(860, totalWidth - minimumCanvasWidth));
  return { minimum: Math.min(280, maximum), maximum };
};

export const clampEditorWidth = (width: number, bounds: EditorResizeBounds) =>
  Math.min(Math.max(width, bounds.minimum), bounds.maximum);
