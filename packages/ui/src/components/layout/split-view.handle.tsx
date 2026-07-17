import { Box } from "@chakra-ui/react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

const RESIZE_SEPARATOR_HOVER_STYLE = { _before: { bg: "border.emphasized" } };
interface SplitViewHandleProps {
  direction: "row" | "column";
  sizePx: number;
  overlapsPanes: boolean;
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
    sizePx,
    overlapsPanes,
    bounds,
    controlledPaneIds,
    resizeLabel,
    resolvedPaneSize,
    showResizeSeparator,
    onResizeKeyDown,
    onResizeStart,
  } = props;
  const isRow = direction === "row";
  const size = `${sizePx}px`;
  const overlapMargin = overlapsPanes ? `${sizePx / -2}px` : undefined;

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
      flex={`0 0 ${size}`}
      w={isRow ? size : "full"}
      h={isRow ? "full" : size}
      mx={isRow ? overlapMargin : undefined}
      my={isRow ? undefined : overlapMargin}
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
