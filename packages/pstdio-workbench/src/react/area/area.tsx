import { Flex } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type {
  RegisteredPlaceholderContribution,
  WorkbenchArea as WorkbenchAreaId,
  WorkbenchCore,
  WorkbenchWidgetPlacement,
} from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { getWorkbenchAreaBackground } from "../theme/workbench-theme-background";
import { WorkbenchWidgetHost } from "./widget-host";

interface WorkbenchAreaProps {
  workbench: WorkbenchCore;
  area: WorkbenchAreaId;
  title?: string;
  showHeader?: boolean;
  hideSingleTabHeader?: boolean;
  pointerEvents?: "auto" | "none";
  transparent?: boolean;
}

// Header bars and the status bar lay their content out in a row, so they
// scroll on the X axis; every other area scrolls vertically.
const horizontalScrollAreas = new Set<WorkbenchAreaId>([
  "top",
  "left-header",
  "main-header",
  "main-left-header",
  "main-right-header",
  "main-bottom-header",
  "floating-header",
  "status",
]);

// A flex column at least as tall as the viewport lets a widget fill the area
// (e.g. a tree with a pinned footer) while still growing and scrolling.
const verticalContentProps = { display: "flex", flexDirection: "column", minH: "100%" } as const;

const getActivePlacement = (widgets: WorkbenchWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

const createPlaceholderPlacement = (placeholder: RegisteredPlaceholderContribution): WorkbenchWidgetPlacement => ({
  widgetId: placeholder.id,
  contributionId: placeholder.id,
  title: placeholder.title,
  closable: false,
});

export const WorkbenchArea = (props: WorkbenchAreaProps) => {
  const { workbench, area, title, pointerEvents = "auto", transparent = false } = props;
  const areaState = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas[area]);
  const activePlacement = getActivePlacement(areaState.widgets, areaState.activeWidgetId);
  const placeholder = activePlacement ? undefined : workbench.layout.getPlaceholder(area);
  const placement = activePlacement ?? (placeholder ? createPlaceholderPlacement(placeholder) : undefined);

  if (!placement) return null;

  const scrollsHorizontally = horizontalScrollAreas.has(area);

  return (
    <Flex
      as="section"
      direction="column"
      h="full"
      minH="0"
      minW="0"
      w="full"
      bg={transparent ? "transparent" : getWorkbenchAreaBackground(area)}
      overflow="hidden"
      pointerEvents={pointerEvents}
      aria-label={title ?? area}
    >
      {/* The area owns scrolling: overflowing widget content scrolls here
          with the same narrow overlay scrollbar used across the workbench. */}
      <ScrollArea
        flex="1"
        minH="0"
        minW="0"
        w="full"
        size="xs"
        showVerticalScrollbar={!scrollsHorizontally}
        showHorizontalScrollbar={scrollsHorizontally}
        // Horizontal bars hold a single row that should stay vertically
        // centered; the ScrollArea otherwise top-aligns its flowing content.
        viewportProps={scrollsHorizontally ? { justifyContent: "center" } : undefined}
        // Vertical areas host a flex column so a widget can fill the area
        // (e.g. a tree with a pinned footer) yet still grow and scroll.
        contentProps={scrollsHorizontally ? undefined : verticalContentProps}
      >
        <WorkbenchWidgetHost workbench={workbench} placement={placement} widget={placeholder} />
      </ScrollArea>
    </Flex>
  );
};
