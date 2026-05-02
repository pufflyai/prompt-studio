import { Box, Flex, type FlexProps } from "@chakra-ui/react";
import { type ReactNode, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

interface ResizablePanelProps extends Omit<FlexProps, "children"> {
  children: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  handleSide?: "left" | "right";
  ariaLabel?: string;
  onWidthChange?: (width: number) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const ResizablePanel = (props: ResizablePanelProps) => {
  const {
    children,
    defaultWidth = 320,
    minWidth = 224,
    maxWidth = 560,
    handleSide = "right",
    ariaLabel = "Resize panel",
    onWidthChange,
    ...rest
  } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<() => void>(() => undefined);
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => () => cleanupRef.current(), []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelRef.current.getBoundingClientRect().width;
    const direction = handleSide === "right" ? 1 : -1;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    const onMove = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) * direction;
      const next = clamp(startWidth + delta, minWidth, maxWidth);
      setWidth(next);
      onWidthChange?.(next);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      cleanupRef.current = () => undefined;
    };

    cleanupRef.current = cleanup;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", cleanup, { once: true });
  };

  const handle = (
    <Box
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      position="absolute"
      top="0"
      bottom="0"
      width="3"
      cursor="col-resize"
      touchAction="none"
      zIndex="1"
      {...(handleSide === "right"
        ? { right: "0", transform: "translateX(50%)" }
        : { left: "0", transform: "translateX(-50%)" })}
      onPointerDown={handlePointerDown}
    />
  );

  return (
    <Flex ref={panelRef} direction="column" position="relative" flexShrink={0} width={`${width}px`} minH="0" {...rest}>
      {children}
      {handle}
    </Flex>
  );
};
