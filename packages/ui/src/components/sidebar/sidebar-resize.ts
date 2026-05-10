const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface ResolveSidebarResizeOptions {
  nextWidth: number;
  minWidth: number;
  maxWidth: number;
  canCollapse: boolean;
}

export const resolveSidebarResize = (options: ResolveSidebarResizeOptions) => {
  const { nextWidth, minWidth, maxWidth, canCollapse } = options;

  if (canCollapse && nextWidth < minWidth) {
    return { type: "collapse" } as const;
  }

  return { type: "resize", width: clamp(nextWidth, minWidth, maxWidth) } as const;
};
