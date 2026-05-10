export const resolveSidebarSplitterSize = (options: {
  panelWidth: number;
  sidebarWidth: number;
  minWidth: number;
  maxWidth: number;
}) => {
  const { panelWidth, sidebarWidth, minWidth, maxWidth } = options;
  const clampedWidth = Math.min(Math.max(sidebarWidth, minWidth), maxWidth);
  const sidebarSize = (clampedWidth / panelWidth) * 100;

  return [sidebarSize, 100 - sidebarSize];
};

export const resolveSidebarWidth = (panelWidth: number, sidebarSize: number) => (panelWidth * sidebarSize) / 100;

export const resolveSidebarResizeEnd = (options: { panelWidth: number; sidebarSize: number; minWidth: number }) => {
  const { panelWidth, sidebarSize, minWidth } = options;
  const width = resolveSidebarWidth(panelWidth, sidebarSize);

  if (width < minWidth) {
    return { type: "collapse" } as const;
  }

  return { type: "resize", width } as const;
};
