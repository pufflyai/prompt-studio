import { Box, Flex, type FlexProps } from "@chakra-ui/react";
import { type ReactNode, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { clampAttachedPanelWidth } from "./attached-panel.utils";

const DEFAULT_RESIZABLE_MIN_WIDTH = "20rem";
const MIN_CONTENT_WIDTH = 320;

interface AttachedPanelProps extends Omit<FlexProps, "children"> {
  children?: ReactNode;
  header?: ReactNode;
  resizable?: boolean;
}

export const AttachedPanel = (props: AttachedPanelProps) => {
  const { children, header, width = "28rem", minWidth, resizable = false, ...rest } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const cleanupDragRef = useRef<() => void>(() => undefined);
  const [resizedWidth, setResizedWidth] = useState<number | null>(null);
  const resolvedMinWidth = minWidth ?? (resizable ? DEFAULT_RESIZABLE_MIN_WIDTH : width);
  const resolvedWidth = resizedWidth === null ? width : `${resizedWidth}px`;

  useEffect(() => () => cleanupDragRef.current(), []);

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizable || !panelRef.current) {
      return;
    }

    event.preventDefault();

    const panel = panelRef.current;
    const startX = event.clientX;
    const startWidth = panel.getBoundingClientRect().width;
    const computedStyle = window.getComputedStyle(panel);
    const minPanelWidth = Number.parseFloat(computedStyle.minWidth) || MIN_CONTENT_WIDTH;
    const parentWidth = panel.parentElement?.getBoundingClientRect().width ?? window.innerWidth;
    const maxPanelWidth = Math.max(minPanelWidth, parentWidth - MIN_CONTENT_WIDTH);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = clampAttachedPanelWidth(startWidth - deltaX, {
        min: minPanelWidth,
        max: maxPanelWidth,
      });

      setResizedWidth(nextWidth);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      cleanupDragRef.current = () => undefined;
    };

    cleanupDragRef.current = cleanup;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", cleanup, { once: true });
  };

  return (
    <Flex
      ref={panelRef}
      direction="column"
      position="relative"
      flexShrink={0}
      w={resolvedWidth}
      minW={resolvedMinWidth}
      h="100%"
      borderLeftWidth="1px"
      bg="bg"
      overflow="hidden"
      {...rest}
    >
      {resizable ? (
        <Box
          role="separator"
          aria-label="Resize attached panel"
          aria-orientation="vertical"
          position="absolute"
          top="0"
          bottom="0"
          left="0"
          width="3"
          transform="translateX(-50%)"
          cursor="col-resize"
          touchAction="none"
          zIndex="1"
          onPointerDown={handleResizeStart}
        />
      ) : null}
      {header}
      <Flex flex="1" minH={0} direction="column">
        {children}
      </Flex>
    </Flex>
  );
};
