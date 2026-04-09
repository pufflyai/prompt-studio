interface AttachedPanelWidthBounds {
  min: number;
  max: number;
}

export const clampAttachedPanelWidth = (width: number, bounds: AttachedPanelWidthBounds) => {
  const { min, max } = bounds;
  return Math.min(Math.max(width, min), max);
};
