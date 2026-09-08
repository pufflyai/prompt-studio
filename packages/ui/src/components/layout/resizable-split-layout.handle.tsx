import { Box, Flex } from "@chakra-ui/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { getResizableSplitAxis } from "@/components/layout/resizable-split-layout.geometry";

// The separator is the gap between two panels. At rest it shows a grip of three
// dots. After a short hover delay, while dragging, or on keyboard focus it becomes
// a full-length bar so the drag target is obvious. The visible part is as thin as
// the gap; an invisible hit area extends over the neighbouring panels.

const HOVER_DELAY_MS = 250;
const GRIP_DOTS = [0, 1, 2];

interface ResizeHandleProps {
  axis: ReturnType<typeof getResizableSplitAxis>;
  bounds: { minSize: number; maxSize: number };
  collapsed: boolean;
  collapsible: boolean;
  contentPanelId: string;
  dragging: boolean;
  resizablePanelId: string;
  resizeLabel: string;
  resolvedPanelSize: number;
  onCollapse: () => void;
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
    dragging,
    resizablePanelId,
    resizeLabel,
    resolvedPanelSize,
    onCollapse,
    onResizeKeyDown,
    onResizeStart,
  } = props;
  const vertical = axis.separatorOrientation === "vertical";
  const [hovered, setHovered] = useState(false);
  const hoverTimerRef = useRef(0);
  const active = hovered || dragging;

  useEffect(() => () => window.clearTimeout(hoverTimerRef.current), []);

  const handlePointerEnter = () => {
    hoverTimerRef.current = window.setTimeout(() => setHovered(true), HOVER_DELAY_MS);
  };

  const handlePointerLeave = () => {
    window.clearTimeout(hoverTimerRef.current);
    setHovered(false);
  };

  const hitArea = vertical
    ? { top: 0, bottom: 0, insetInlineStart: "-1", insetInlineEnd: "-1" }
    : { insetInline: 0, top: "-1", bottom: "-1" };

  return (
    <Flex
      role="separator"
      aria-label={resizeLabel}
      aria-orientation={axis.separatorOrientation}
      aria-controls={`${resizablePanelId} ${contentPanelId}`}
      aria-valuemin={collapsible ? 0 : Math.round(bounds.minSize)}
      aria-valuemax={Math.round(bounds.maxSize)}
      aria-valuenow={Math.round(resolvedPanelSize)}
      aria-hidden={collapsed ? true : undefined}
      tabIndex={collapsed ? -1 : 0}
      display={collapsed ? "none" : "flex"}
      position="relative"
      zIndex="docked"
      align="center"
      justify="center"
      flexShrink={0}
      w={vertical ? "panel-gap" : "full"}
      h={vertical ? "full" : "panel-gap"}
      cursor={axis.cursor}
      touchAction="none"
      outline="none"
      _before={{ content: '""', position: "absolute", ...hitArea }}
      _focusVisible={{ "& [data-part=bar]": { opacity: 1 }, "& [data-part=grip]": { opacity: 0 } }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={onResizeStart}
      onDoubleClick={collapsible ? onCollapse : undefined}
      onKeyDown={onResizeKeyDown}
    >
      <Flex
        data-part="grip"
        direction={vertical ? "column" : "row"}
        gap="3xs"
        opacity={active ? 0 : 1}
        transition="opacity 120ms ease"
      >
        {GRIP_DOTS.map((dot) => (
          <Box key={dot} boxSize="0.5" borderRadius="full" bg="border" />
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
        borderRadius="xs"
        bg="fg.info"
        opacity={active ? 1 : 0}
        transition="opacity 120ms ease"
        pointerEvents="none"
      />
    </Flex>
  );
};
