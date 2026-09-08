import { Box, Flex } from "@chakra-ui/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { getResizableSplitAxis } from "@/components/layout/resizable-split-layout.geometry";

// Two separators share one behaviour. The "gap" separator sits between panel
// cards: it is as wide as the panel gap and shows a grip of three dots. The
// "line" separator divides content inside a panel: it is a 1px border line.
// Both become a full-length bar after a short hover delay, while dragging, or
// on keyboard focus, and both have an invisible hit area wider than themselves.

export type ResizableSplitSeparator = "gap" | "line";

const HOVER_DELAY_MS = 250;
const GRIP_DOTS = [0, 1, 2];

const resolveHandleLayout = (vertical: boolean, thickness: string) => {
  if (vertical) {
    return {
      w: thickness,
      h: "full",
      hitArea: { top: 0, bottom: 0, insetInlineStart: "-1", insetInlineEnd: "-1" },
      gripDirection: "column" as const,
      bar: { top: "0", bottom: "0", insetInlineStart: "50%", w: "0.5", transform: "translateX(-50%)" },
    };
  }

  return {
    w: "full",
    h: thickness,
    hitArea: { insetInline: 0, top: "-1", bottom: "-1" },
    gripDirection: "row" as const,
    bar: { top: "50%", insetInline: "0", h: "0.5", transform: "translateY(-50%)" },
  };
};

type HandleLayout = ReturnType<typeof resolveHandleLayout>;

interface HandlePartProps {
  active: boolean;
  layout: HandleLayout;
}

const ResizeHandleGrip = (props: HandlePartProps) => {
  const { active, layout } = props;

  return (
    <Flex
      data-part="grip"
      direction={layout.gripDirection}
      gap="3xs"
      opacity={active ? 0 : 1}
      transition="opacity 120ms ease"
    >
      {GRIP_DOTS.map((dot) => (
        <Box key={dot} boxSize="0.5" borderRadius="full" bg="border" />
      ))}
    </Flex>
  );
};

const ResizeHandleBar = (props: HandlePartProps) => {
  const { active, layout } = props;

  return (
    <Box
      data-part="bar"
      position="absolute"
      borderRadius="xs"
      bg="fg.info"
      opacity={active ? 1 : 0}
      transition="opacity 120ms ease"
      pointerEvents="none"
      {...layout.bar}
    />
  );
};

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
  separator: ResizableSplitSeparator;
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
    separator,
    onCollapse,
    onResizeKeyDown,
    onResizeStart,
  } = props;
  const line = separator === "line";
  const layout = resolveHandleLayout(axis.separatorOrientation === "vertical", line ? "1px" : "panel-gap");
  const [hovered, setHovered] = useState(false);
  const hoverTimerRef = useRef(0);
  const active = hovered || dragging;
  // A collapsed panel hides its separator; the nav chrome owns reopening.
  const visibility = collapsed
    ? { "aria-hidden": true, tabIndex: -1, display: "none" }
    : { tabIndex: 0, display: "flex" };

  useEffect(() => () => window.clearTimeout(hoverTimerRef.current), []);

  const handlePointerEnter = () => {
    hoverTimerRef.current = window.setTimeout(() => setHovered(true), HOVER_DELAY_MS);
  };

  const handlePointerLeave = () => {
    window.clearTimeout(hoverTimerRef.current);
    setHovered(false);
  };

  return (
    <Flex
      role="separator"
      aria-label={resizeLabel}
      aria-orientation={axis.separatorOrientation}
      aria-controls={`${resizablePanelId} ${contentPanelId}`}
      aria-valuemin={collapsible ? 0 : Math.round(bounds.minSize)}
      aria-valuemax={Math.round(bounds.maxSize)}
      aria-valuenow={Math.round(resolvedPanelSize)}
      {...visibility}
      position="relative"
      zIndex="docked"
      align="center"
      justify="center"
      flexShrink={0}
      w={layout.w}
      h={layout.h}
      bg={line ? "border" : undefined}
      cursor={axis.cursor}
      touchAction="none"
      outline="none"
      _before={{ content: '""', position: "absolute", ...layout.hitArea }}
      _focusVisible={{ "& [data-part=bar]": { opacity: 1 }, "& [data-part=grip]": { opacity: 0 } }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={onResizeStart}
      onDoubleClick={collapsible ? onCollapse : undefined}
      onKeyDown={onResizeKeyDown}
    >
      {line ? null : <ResizeHandleGrip active={active} layout={layout} />}
      <ResizeHandleBar active={active} layout={layout} />
    </Flex>
  );
};
