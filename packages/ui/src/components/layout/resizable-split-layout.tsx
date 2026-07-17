import type { FlexProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { type SplitPane, SplitView } from "./split-view";

export type ResizableSplitSide = "left" | "right";

interface ResizableSplitLayoutProps extends Omit<FlexProps, "children" | "direction" | "onResize"> {
  resizablePanel: ReactNode;
  contentPanel: ReactNode;
  resizableSide?: ResizableSplitSide;
  defaultSizePx?: number;
  minSizePx?: number;
  maxSizePx?: number;
  contentMinSizePx?: number;
  collapsed?: boolean;
  collapsible?: boolean;
  resizeLabel?: string;
  showResizeSeparator?: boolean;
  onSizeChange?: (width: number) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const ResizableSplitLayout = (props: ResizableSplitLayoutProps) => {
  const {
    resizablePanel,
    contentPanel,
    resizableSide = "left",
    defaultSizePx = 240,
    minSizePx = 200,
    maxSizePx,
    contentMinSizePx = 0,
    collapsed,
    collapsible = true,
    resizeLabel = "Resize panel",
    showResizeSeparator = true,
    onSizeChange,
    onCollapsedChange,
    ...rest
  } = props;
  const resizablePane: SplitPane = {
    id: "resizable",
    content: resizablePanel,
    sizePx: defaultSizePx,
    minSizePx,
    maxSizePx,
    collapsed,
    collapsible,
  };
  const contentPane: SplitPane = {
    id: "content",
    content: contentPanel,
    minSizePx: contentMinSizePx,
  };
  const panes = resizableSide === "left" ? [resizablePane, contentPane] : [contentPane, resizablePane];

  return (
    <SplitView
      {...rest}
      panes={panes}
      resizeLabel={() => resizeLabel}
      showResizeSeparator={showResizeSeparator}
      onSizeChange={(paneId, size) => {
        if (paneId === resizablePane.id) onSizeChange?.(size);
      }}
      onCollapsedChange={(paneId, nextCollapsed) => {
        if (paneId === resizablePane.id) onCollapsedChange?.(nextCollapsed);
      }}
    />
  );
};
