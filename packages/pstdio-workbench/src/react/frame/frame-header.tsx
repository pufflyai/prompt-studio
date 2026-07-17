import { Box } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import {
  type Frame,
  type FrameSlot,
  headerTrailingMenuPath,
  type RegisteredWidgetContribution,
  type WorkbenchCore,
} from "../../core";
import { shouldShowAreaTabs, WorkbenchAreaTabsWithMenus } from "../area/area-tabs";
import { useAreaLeadingItems } from "../area/use-area-leading-items";
import { usePanelMenus } from "../area/use-panel-menus";
import { useElementWidth, useResponsivePanelMenus } from "../area/use-responsive-panel-menus";
import { WorkbenchWidgetHost } from "../area/widget-host";
import { WorkbenchHeaderActions } from "../header/header-actions";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { getWorkbenchAreaBackground } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "../workbench/header-bottom-border";
import { resolveSlotChrome } from "./frame-slot-chrome";

interface FrameHeaderProps {
  workbench: WorkbenchCore;
  frame: Frame;
  targetSlot: FrameSlot;
}

const shouldRenderAreaTabs = (
  fullBleed: boolean,
  placements: Parameters<typeof shouldShowAreaTabs>[0],
  options: Parameters<typeof shouldShowAreaTabs>[1],
) => !fullBleed && shouldShowAreaTabs(placements, options);

export const FrameHeader = (props: FrameHeaderProps) => {
  const { workbench, frame, targetSlot } = props;
  const regionId = targetSlot.regions?.header;
  const leading = useAreaLeadingItems(workbench, targetSlot.id);
  const attachedPanelMenus = usePanelMenus(workbench, targetSlot.id);
  const { setElement, width } = useElementWidth();
  const panelMenus = useResponsivePanelMenus(attachedPanelMenus, width);
  const regionRenderer = useWorkbenchStore(workbench.renderers.store, (state) =>
    regionId ? state.renderers[regionId] : undefined,
  );
  const targetPlacements = panelMenus.tabs;
  const chrome = resolveSlotChrome(targetSlot.id);
  const fullBleed = chrome.headerLayout === "full-bleed";
  const hasHeader = Boolean(regionId && regionRenderer);
  const hasTargetTabs = shouldRenderAreaTabs(fullBleed, targetPlacements, {
    hasLeadingActions: leading.items.length > 0,
    hasOpenablePanels: leading.openablePanels.length > 0,
    hasPanelMenuToggles: panelMenus.toggles.length > 0,
  });
  const trailingMenuPath = headerTrailingMenuPath(targetSlot.id);
  if (!regionId) return null;
  const borderSlotId = targetSlot.id;
  const fullBleedProps = fullBleed ? { px: "0", h: "auto", minH: "2.5rem", alignItems: "stretch" as const } : {};

  return (
    <Box ref={setElement} flexShrink={0} minW="0" w="full">
      <Header
        {...fullBleedProps}
        variant={chrome.headerVariant}
        bg={getWorkbenchAreaBackground(regionId)}
        position="relative"
        gap="xs"
        overflow="hidden"
        overflowY="hidden"
      >
        {!fullBleed ? (
          <WorkbenchAreaTabsWithMenus workbench={workbench} area={targetSlot.id} panelMenus={panelMenus} />
        ) : null}
        {hasHeader || chrome.growHeaderWhenEmpty ? (
          <Box flex={hasHeader || !hasTargetTabs ? "1" : "0"} h="full" minW="0" overflow="hidden">
            {hasHeader ? (
              <WorkbenchWidgetHost
                workbench={workbench}
                widget={
                  {
                    id: regionId,
                    title: `${targetSlot.id} header`,
                    area: targetSlot.id,
                    rendererId: regionId,
                    singleton: true,
                    reuse: "none",
                    source: "module",
                    ownerId: "workbench.frame",
                    priority: 0,
                  } satisfies RegisteredWidgetContribution
                }
                placement={{ widgetId: regionId, contributionId: regionId, pinned: true }}
              />
            ) : null}
          </Box>
        ) : null}
        {targetSlot.id === frame.primary ? (
          <WorkbenchHeaderActions workbench={workbench} menuPath={trailingMenuPath} />
        ) : null}
        <WorkbenchHeaderBorder workbench={workbench} area={borderSlotId} />
      </Header>
    </Box>
  );
};
