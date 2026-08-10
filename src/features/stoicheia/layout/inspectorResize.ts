export interface InspectorResizeBounds {
  minimum: number;
  maximum: number;
}

export const getInspectorResizeBounds = (availableWidth: number): InspectorResizeBounds => {
  const minimum = 240;
  const maximum = Math.max(minimum, Math.min(520, availableWidth - 360));
  return { minimum: Math.min(minimum, maximum), maximum };
};

export const clampInspectorWidth = (width: number, bounds: InspectorResizeBounds) =>
  Math.min(Math.max(width, bounds.minimum), bounds.maximum);
