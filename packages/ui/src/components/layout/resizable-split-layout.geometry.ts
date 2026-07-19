export type ResizableSplitSide = "left" | "right" | "top" | "bottom";

const MIN_HORIZONTAL_COLLAPSE_THRESHOLD_PX = 72;
const MAX_HORIZONTAL_COLLAPSE_THRESHOLD_PX = 160;
const VERTICAL_COLLAPSE_THRESHOLD_PX = 72;

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
}) => {
  const rootSize = input.rootSize > 0 ? input.rootSize : input.fallbackRootSize;
  const maxFromContent = Math.max(0, rootSize - input.contentMinSize);
  const configuredMax = input.maxSize ?? maxFromContent;
  const maxSize = Math.max(0, Math.min(configuredMax, maxFromContent));
  const minSize = Math.min(input.minSize, maxSize);

  return { minSize, maxSize };
};

const resolveCollapseThreshold = (side: ResizableSplitSide, minSize: number) => {
  if (side === "top" || side === "bottom") return VERTICAL_COLLAPSE_THRESHOLD_PX;
  return clamp(minSize / 2, MIN_HORIZONTAL_COLLAPSE_THRESHOLD_PX, MAX_HORIZONTAL_COLLAPSE_THRESHOLD_PX);
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
  const collapsed = input.collapsible && rawSize <= resolveCollapseThreshold(input.side, input.minSize);

  return {
    rawSize,
    size: collapsed ? 0 : clamp(rawSize, input.minSize, input.maxSize),
    collapsed,
  };
};
