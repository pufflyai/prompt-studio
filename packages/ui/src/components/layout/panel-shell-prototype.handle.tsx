import { Box, Flex } from "@chakra-ui/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

// Prototype of the panel separator redesign. Not exported from the package.
// At rest the separator shows three small dots. After a short hover delay it
// becomes a full-length bar so the drag target is obvious.

export type PrototypeHandleOrientation = "vertical" | "horizontal";

interface PrototypeResizeHandleProps {
  orientation: PrototypeHandleOrientation;
  label: string;
  size: string;
  hoverDelayMs: number;
  onResizeStart: () => void;
  onResize: (deltaPx: number) => void;
}

const KEYBOARD_STEP_PX = 24;
const DOT_INDEXES = [0, 1, 2];

export const PrototypeResizeHandle = (props: PrototypeResizeHandleProps) => {
  const { orientation, label, size, hoverDelayMs, onResizeStart, onResize } = props;
  const vertical = orientation === "vertical";
  const cursor = vertical ? "col-resize" : "row-resize";
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hoverTimerRef = useRef(0);
  const active = hovered || dragging;

  useEffect(() => () => window.clearTimeout(hoverTimerRef.current), []);

  const handlePointerEnter = () => {
    hoverTimerRef.current = window.setTimeout(() => setHovered(true), hoverDelayMs);
  };

  const handlePointerLeave = () => {
    window.clearTimeout(hoverTimerRef.current);
    setHovered(false);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const handle = event.currentTarget;
    const start = vertical ? event.clientX : event.clientY;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    onResizeStart();
    setDragging(true);
    handle.setPointerCapture(event.pointerId);
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvent: PointerEvent) => {
      onResize((vertical ? moveEvent.clientX : moveEvent.clientY) - start);
    };

    const stop = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      setDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const backward = vertical ? "ArrowLeft" : "ArrowUp";
    const forward = vertical ? "ArrowRight" : "ArrowDown";
    if (event.key !== backward && event.key !== forward) return;

    event.preventDefault();
    onResizeStart();
    onResize(event.key === forward ? KEYBOARD_STEP_PX : -KEYBOARD_STEP_PX);
  };

  return (
    <Flex
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      tabIndex={0}
      position="relative"
      align="center"
      justify="center"
      flexShrink={0}
      w={vertical ? size : "full"}
      h={vertical ? "full" : size}
      cursor={cursor}
      touchAction="none"
      outline="none"
      _focusVisible={{ "& [data-part=bar]": { opacity: 1 }, "& [data-part=dots]": { opacity: 0 } }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      <Flex
        data-part="dots"
        direction={vertical ? "column" : "row"}
        gap="3xs"
        opacity={active ? 0 : 1}
        transition="opacity 120ms ease"
      >
        {DOT_INDEXES.map((index) => (
          <Box key={index} boxSize="1" borderRadius="full" bg="fg.subtle" />
        ))}
      </Flex>
      <Box
        data-part="bar"
        position="absolute"
        top={vertical ? "0" : "50%"}
        bottom={vertical ? "0" : undefined}
        insetInlineStart={vertical ? "50%" : "0"}
        insetInlineEnd={vertical ? undefined : "0"}
        w={vertical ? "0.5" : undefined}
        h={vertical ? undefined : "0.5"}
        transform={vertical ? "translateX(-50%)" : "translateY(-50%)"}
        borderRadius="2xs"
        bg="fg.info"
        opacity={active ? 1 : 0}
        transition="opacity 120ms ease"
        pointerEvents="none"
      />
    </Flex>
  );
};
