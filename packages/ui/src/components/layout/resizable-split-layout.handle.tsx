import { Box } from "@chakra-ui/react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { getResizableSplitAxis } from "@/components/layout/resizable-split-layout.geometry";

const RESIZE_SEPARATOR_HOVER_STYLE = { _before: { bg: "border.emphasized" } };

interface ResizeHandleProps {
  axis: ReturnType<typeof getResizableSplitAxis>;
  bounds: { minSize: number; maxSize: number };
  collapsed: boolean;
  collapsible: boolean;
  contentPanelId: string;
  resizablePanelId: string;
  resizeHandleSizePx: number;
  resizeLabel: string;
  resolvedPanelSize: number;
  showResizeSeparator: boolean;
  onResizeKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export const ResizeHandle = (props: ResizeHandleProps) => {
  const {
    axis,
    bounds,
    collapsed,
    collapsible,
    contentPanelId,
    resizablePanelId,
    resizeHandleSizePx,
    resizeLabel,
    resolvedPanelSize,
    showResizeSeparator,
    onResizeKeyDown,
    onResizeStart,
  } = props;
  const verticalSeparator = axis.separatorOrientation === "vertical";
  const resizeHandleSize = `${resizeHandleSizePx}px`;
  const resizeHandleOffset = `${resizeHandleSizePx / -2}px`;
  const separatorStyle = verticalSeparator
    ? {
        content: '""',
        position: "absolute" as const,
        top: 0,
        bottom: 0,
        insetInlineStart: "50%",
        w: "1px",
        bg: showResizeSeparator ? "border.subtle" : "transparent",
        transform: "translateX(-50%)",
      }
    : {
        content: '""',
        position: "absolute" as const,
        insetInline: 0,
        top: "50%",
        h: "1px",
        bg: showResizeSeparator ? "border.subtle" : "transparent",
        transform: "translateY(-50%)",
      };
  return (
    <Box
      role="separator"
      aria-label={resizeLabel}
      aria-orientation={axis.separatorOrientation}
      aria-controls={`${resizablePanelId} ${contentPanelId}`}
      aria-valuemin={collapsible ? 0 : Math.round(bounds.minSize)}
      aria-valuemax={Math.round(bounds.maxSize)}
      aria-valuenow={Math.round(resolvedPanelSize)}
      aria-hidden={collapsed ? true : undefined}
      tabIndex={collapsed ? -1 : 0}
      display={collapsed ? "none" : undefined}
      position="relative"
      zIndex="docked"
      flex={`0 0 ${resizeHandleSize}`}
      h={verticalSeparator ? "full" : resizeHandleSize}
      w={verticalSeparator ? resizeHandleSize : "full"}
      mx={verticalSeparator ? resizeHandleOffset : undefined}
      my={verticalSeparator ? undefined : resizeHandleOffset}
      cursor={axis.cursor}
      touchAction="none"
      outline="none"
      onPointerDown={onResizeStart}
      onKeyDown={onResizeKeyDown}
      _before={separatorStyle}
      _hover={showResizeSeparator ? RESIZE_SEPARATOR_HOVER_STYLE : undefined}
      _focusVisible={{
        _before: {
          bg: "colorPalette.focusRing",
          h: verticalSeparator ? undefined : "2px",
          w: verticalSeparator ? "2px" : undefined,
        },
      }}
    />
  );
};
