export type ResizableSplitSide = "left" | "right" | "top" | "bottom";

export const FALLBACK_ROOT_SIZE = { width: 1200, height: 720 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const axes = {
  left: {
    rootDirection: "row",
    dimension: "width",
    separatorOrientation: "vertical",
    cursor: "col-resize",
    pointerCoordinate: "clientX",
    deltaDirection: 1,
    panelFirst: true,
  },
  right: {
    rootDirection: "row",
    dimension: "width",
    separatorOrientation: "vertical",
    cursor: "col-resize",
    pointerCoordinate: "clientX",
    deltaDirection: -1,
    panelFirst: false,
  },
  top: {
    rootDirection: "column",
    dimension: "height",
    separatorOrientation: "horizontal",
    cursor: "row-resize",
    pointerCoordinate: "clientY",
    deltaDirection: 1,
    panelFirst: true,
  },
  bottom: {
    rootDirection: "column",
    dimension: "height",
    separatorOrientation: "horizontal",
    cursor: "row-resize",
    pointerCoordinate: "clientY",
    deltaDirection: -1,
    panelFirst: false,
  },
} as const;

export const getResizableSplitAxis = (side: ResizableSplitSide) => axes[side];

export const resolveResizableBounds = (input: {
  rootSize: number;
  fallbackRootSize: number;
  minSize: number;
  maxSize?: number;
  contentMinSize: number;
  separatorSize: number;
}) => {
  const rootSize = input.rootSize > 0 ? input.rootSize : input.fallbackRootSize;
  const maxFromContent = Math.max(0, rootSize - input.separatorSize - input.contentMinSize);
  const configuredMax = input.maxSize ?? maxFromContent;
  const maxSize = Math.max(0, Math.min(configuredMax, maxFromContent));
  const minSize = Math.min(input.minSize, maxSize);

  return { minSize, maxSize };
};

export const resolveDraggedPanelSize = (input: {
  side: ResizableSplitSide;
  startSize: number;
  pointerDelta: number;
  minSize: number;
  maxSize: number;
  collapsible: boolean;
}) => {
  const axis = getResizableSplitAxis(input.side);
  const rawSize = input.startSize + input.pointerDelta * axis.deltaDirection;
  const collapsed = input.collapsible && rawSize < input.minSize / 2;

  return {
    rawSize,
    size: collapsed ? 0 : clamp(rawSize, input.minSize, input.maxSize),
    collapsed,
  };
};
