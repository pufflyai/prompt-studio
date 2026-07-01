import { Box } from "@chakra-ui/react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

export type ResizableSplitSide = "left" | "right";

const RESIZE_SEPARATOR_HOVER_STYLE = { _before: { bg: "border.emphasized" } };
const RESIZE_HANDLE_WIDTH = "12px";

interface ResizeHandleProps {
  bounds: { minSize: number; maxSize: number };
  contentPanelId: string;
  resizablePanelId: string;
  resizeLabel: string;
  resolvedPanelWidth: number;
  showResizeSeparator: boolean;
  onResizeKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export const ResizeHandle = (props: ResizeHandleProps) => {
  const {
    bounds,
    contentPanelId,
    resizablePanelId,
    resizeLabel,
    resolvedPanelWidth,
    showResizeSeparator,
    onResizeKeyDown,
    onResizeStart,
  } = props;
  return (
    <Box
      role="separator"
      aria-label={resizeLabel}
      aria-orientation="vertical"
      aria-controls={`${resizablePanelId} ${contentPanelId}`}
      aria-valuemin={0}
      aria-valuemax={Math.round(bounds.maxSize)}
      aria-valuenow={Math.round(resolvedPanelWidth)}
      tabIndex={0}
      position="relative"
      zIndex="1"
      flex={`0 0 ${RESIZE_HANDLE_WIDTH}`}
      w={RESIZE_HANDLE_WIDTH}
      mx="-6px"
      cursor="col-resize"
      touchAction="none"
      outline="none"
      onPointerDown={onResizeStart}
      onKeyDown={onResizeKeyDown}
      _before={{
        content: '""',
        position: "absolute",
        top: 0,
        bottom: 0,
        insetInlineStart: "50%",
        w: "1px",
        bg: showResizeSeparator ? "border.subtle" : "transparent",
        transform: "translateX(-50%)",
      }}
      _hover={showResizeSeparator ? RESIZE_SEPARATOR_HOVER_STYLE : undefined}
      _focusVisible={{
        _before: {
          bg: "colorPalette.focusRing",
          w: "2px",
        },
      }}
    />
  );
};
