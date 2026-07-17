import { Box } from "@chakra-ui/react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

const RESIZE_SEPARATOR_HOVER_STYLE = { _before: { bg: "border.emphasized" } };
const RESIZE_HANDLE_SIZE = "12px";

interface SplitViewHandleProps {
  direction: "row" | "column";
  bounds: { minSize: number; maxSize: number };
  controlledPaneIds: string;
  resizeLabel: string;
  resolvedPaneSize: number;
  showResizeSeparator: boolean;
  onResizeKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export const SplitViewHandle = (props: SplitViewHandleProps) => {
  const {
    direction,
    bounds,
    controlledPaneIds,
    resizeLabel,
    resolvedPaneSize,
    showResizeSeparator,
    onResizeKeyDown,
    onResizeStart,
  } = props;
  const isRow = direction === "row";

  return (
    <Box
      role="separator"
      aria-label={resizeLabel}
      aria-orientation={isRow ? "vertical" : "horizontal"}
      aria-controls={controlledPaneIds}
      aria-valuemin={0}
      aria-valuemax={Math.round(bounds.maxSize)}
      aria-valuenow={Math.round(resolvedPaneSize)}
      tabIndex={0}
      position="relative"
      zIndex="1"
      flex={`0 0 ${RESIZE_HANDLE_SIZE}`}
      w={isRow ? RESIZE_HANDLE_SIZE : "full"}
      h={isRow ? "full" : RESIZE_HANDLE_SIZE}
      mx={isRow ? "-6px" : undefined}
      my={isRow ? undefined : "-6px"}
      cursor={isRow ? "col-resize" : "row-resize"}
      touchAction="none"
      outline="none"
      onPointerDown={onResizeStart}
      onKeyDown={onResizeKeyDown}
      _before={{
        content: '""',
        position: "absolute",
        top: isRow ? 0 : "50%",
        bottom: isRow ? 0 : undefined,
        left: isRow ? "50%" : 0,
        right: isRow ? undefined : 0,
        w: isRow ? "1px" : undefined,
        h: isRow ? undefined : "1px",
        bg: showResizeSeparator ? "border.subtle" : "transparent",
        transform: isRow ? "translateX(-50%)" : "translateY(-50%)",
      }}
      _hover={showResizeSeparator ? RESIZE_SEPARATOR_HOVER_STYLE : undefined}
      _focusVisible={{
        _before: {
          bg: "colorPalette.focusRing",
          w: isRow ? "2px" : undefined,
          h: isRow ? undefined : "2px",
        },
      }}
    />
  );
};
