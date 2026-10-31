import { Box, Flex } from "@chakra-ui/react";
import { useLayoutEffect, useRef } from "react";
import type {
  RegisteredPlaceholderContribution,
  WorkbenchCore,
  WorkbenchPanelMenuRegion,
  WorkbenchRegion as WorkbenchRegionId,
  WorkbenchWidgetPlacement,
} from "../../core";
import {
  getActiveWorkbenchSubPanel,
  getWorkbenchPanelForMenuRegion,
  isWorkbenchPanelPlacementVisible,
  matchesWorkbenchModeEligibility,
  matchesWorkbenchPanelMenuOwner,
  type WorkbenchPanelRegion,
  workbenchPanelMenuRegions,
  workbenchPanelRegions,
} from "../../core";
import { resolvePageContent } from "../../core/registries/pages/page-content";
import { useOpenPlacementIds } from "../shared/use-open-placement-ids";
import { useWorkbenchLocationPanel } from "../shared/use-workbench-location-panel";
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { getWorkbenchRegionBackground } from "../theme/workbench-theme-background";
import { ModeChromeView, useModeChrome } from "./mode-chrome";
import { PanelPlaceholder } from "./panel-placeholder";
import { usePanelViewSlot, WorkbenchPanelViewSlot } from "./panel-view-hosts";
import { RegionScrollArea } from "./region-scroll-area";
import { useRetainedViewPlacements } from "./use-retained-view-placements";
import { WorkbenchWidgetHost } from "./widget-host";

interface WorkbenchRegionProps {
  workbench: WorkbenchCore;
  region: WorkbenchRegionId;
  title?: string;
  pointerEvents?: "auto" | "none";
  transparent?: boolean;
}

// Header bars and the status bar lay their content out in a row, so they
// scroll on the X axis; every other region scrolls vertically.
const horizontalScrollRegions = new Set<WorkbenchRegionId>([
  "nav",
  "main-header",
  "secondary-header",
  "side-header",
  "status",
]);

const panelMenuRegionIds = new Set<WorkbenchRegionId>(
  Object.values(workbenchPanelMenuRegions).flatMap((regions) => Object.values(regions)),
);
const sidePanelRegionIds = new Set<WorkbenchRegionId>(["side", "side-header", "side-left-menu", "side-right-menu"]);

const getActivePlacement = (
  widgets: WorkbenchWidgetPlacement[],
  activeWidgetId?: string,
  content?: WorkbenchWidgetPlacement,
) => content ?? widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

export const resolveRenderedRegionPlacements = (
  widgets: WorkbenchWidgetPlacement[],
  activeWidgetId?: string,
  region?: WorkbenchRegionId,
): WorkbenchWidgetPlacement[] => {
  if (region === "sidenav") return widgets;
  const activePlacement = getActivePlacement(widgets, activeWidgetId);
  if (!activePlacement) return [];
  return widgets.filter(
    (placement) => placement.widgetId === activePlacement.widgetId || placement.mountStrategy === "keep-mounted",
  );
};

export const resolveRegionPlacementRenderState = (
  placement: WorkbenchWidgetPlacement,
  activeWidgetId: string | undefined,
  region?: WorkbenchRegionId,
) => {
  const active = placement.widgetId === activeWidgetId;
  const additive = region === "sidenav";
  return {
    active,
    display: "flex",
    pointerEvents: active || additive ? "auto" : "none",
    position: active || additive ? "relative" : "absolute",
    visibility: active || additive ? "visible" : "hidden",
  } as const;
};

const createPlaceholderPlacement = (placeholder: RegisteredPlaceholderContribution): WorkbenchWidgetPlacement => ({
  widgetId: placeholder.id,
  contributionId: placeholder.id,
  title: placeholder.title,
  closable: false,
});

interface WorkbenchRegionPlacementProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  activeWidgetId?: string;
  globalActiveWidgetId?: string;
  region: WorkbenchRegionId;
  visible: boolean;
  order: number;
}

const WorkbenchRegionPlacement = (props: WorkbenchRegionPlacementProps) => {
  const { workbench, placement, activeWidgetId, globalActiveWidgetId, region, visible, order } = props;
  const renderState = resolveRegionPlacementRenderState(placement, activeWidgetId, region);
  const additive = region === "sidenav";
  const overlaysActivePlacement = !renderState.active && !additive;
  let flex: string | undefined;
  if (additive) flex = "1 1 0";
  else if (renderState.active) flex = "1 0 auto";

  const activatePlacement = () => {
    if (placement.widgetId !== globalActiveWidgetId) workbench.layout.activatePanel(placement.widgetId);
  };

  return (
    <Box
      display={visible ? renderState.display : "none"}
      inert={!visible || (!renderState.active && !additive)}
      order={order}
      flex={flex}
      h={overlaysActivePlacement ? "full" : undefined}
      inset={overlaysActivePlacement ? "0" : undefined}
      minH="0"
      minW="0"
      onPointerDown={additive ? activatePlacement : undefined}
      onFocusCapture={additive ? activatePlacement : undefined}
      overflow="hidden"
      pointerEvents={renderState.pointerEvents}
      position={renderState.position}
      visibility={renderState.visibility}
      w="full"
    >
      <WorkbenchWidgetHost workbench={workbench} placement={placement} />
    </Box>
  );
};

const useRegionPageContent = (workbench: WorkbenchCore, region: WorkbenchRegionId) => {
  const content = useWorkbenchStore(workbench.pages.store, resolvePageContent);
  return region === "main" ? content : undefined;
};

const RegionPageContent = (props: { workbench: WorkbenchCore; content?: WorkbenchWidgetPlacement }) => {
  const { workbench, content } = props;
  if (!content) return null;
  return <WorkbenchWidgetHost workbench={workbench} placement={content} region="main" />;
};

const activateRegionPlacement = (
  workbench: WorkbenchCore,
  content: WorkbenchWidgetPlacement | undefined,
  target: WorkbenchWidgetPlacement | undefined,
  activeWidgetId: string | undefined,
) => {
  if (content) workbench.focus.setActiveRegion("main");
  else if (target && target.widgetId !== activeWidgetId) workbench.layout.activatePanel(target.widgetId);
};

export const WorkbenchRegion = (props: WorkbenchRegionProps) => {
  const { workbench, region, title, pointerEvents = "auto", transparent = false } = props;
  const panelRegion = workbenchPanelRegions.includes(region as WorkbenchPanelRegion)
    ? (region as WorkbenchPanelRegion)
    : undefined;
  const panelSlot = usePanelViewSlot(panelRegion);
  const sharedViews = panelSlot.enabled;
  const chrome = useModeChrome(workbench, region);
  const locationResource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const pageContent = useRegionPageContent(workbench, region);
  const currentRegionState = layout.regions[region];
  const registeredWidgets = useWorkbenchStore(workbench.layout.store, (state) => state.widgets);
  const activeSubPanel = panelMenuRegionIds.has(region)
    ? getActiveWorkbenchSubPanel(
        layout,
        getWorkbenchPanelForMenuRegion(region as WorkbenchPanelMenuRegion),
        locationResource,
        { ignoreOwnerResourceKey: sidePanelRegionIds.has(region) },
      )
    : undefined;
  const activeLocationPanel = useWorkbenchLocationPanel(
    workbench,
    panelMenuRegionIds.has(region) ? getWorkbenchPanelForMenuRegion(region as WorkbenchPanelMenuRegion) : panelRegion,
  );
  const regionState = {
    ...currentRegionState,
    widgets: currentRegionState.widgets.filter((placement) => {
      const contribution = registeredWidgets[placement.contributionId];
      return contribution
        ? (sidePanelRegionIds.has(region)
            ? matchesWorkbenchModeEligibility(contribution, modeId)
            : isWorkbenchPanelPlacementVisible(contribution, locationResource, modeId, placement, {
                location: activeLocationPanel,
              })) &&
            matchesWorkbenchPanelMenuOwner(contribution, {
              locationPanel: activeLocationPanel,
              subPanel: activeSubPanel,
            })
        : false;
    }),
  };
  const globalActiveWidgetId = useWorkbenchStore(workbench.layout.store, (state) => state.layout.activeWidgetId);
  const activePlacement = getActivePlacement(regionState.widgets, regionState.activeWidgetId, pageContent);
  const regionRef = useRef<HTMLDivElement>(null);
  const currentPresentation = useRef(activePlacement?.widgetId);
  useLayoutEffect(() => {
    currentPresentation.current = activePlacement?.widgetId;
  }, [activePlacement?.widgetId]);
  useLayoutEffect(() => {
    if (!workbenchPanelRegions.includes(region as WorkbenchPanelRegion) && !panelMenuRegionIds.has(region)) return;
    const registration = workbench.keyboard.registerVisibleRegion(region, () => {
      const element = regionRef.current;
      if (!element?.checkVisibility({ visibilityProperty: true })) return [];
      return currentPresentation.current ? [currentPresentation.current] : [];
    });
    return () => registration.dispose();
  }, [workbench, region]);
  const placeholder = activePlacement ? undefined : workbench.layout.getPlaceholder(region);
  const placement = activePlacement ?? (placeholder ? createPlaceholderPlacement(placeholder) : undefined);
  const renderedPlacements = activePlacement
    ? resolveRenderedRegionPlacements(regionState.widgets, activePlacement.widgetId, region)
    : [];
  const open = useOpenPlacementIds(workbench);

  const retainedPlacements = useRetainedViewPlacements(
    workbench,
    chrome !== undefined || sharedViews ? [] : renderedPlacements,
    open,
  );
  const visibleIds = new Set(renderedPlacements.map((entry) => entry.widgetId));

  const scrollsHorizontally = horizontalScrollRegions.has(region);

  // Interacting with a region makes its active widget the globally-active one (so clicking
  // into the Side Panel session sets it global-active) without touching the primary anchor,
  // which only follows `main`. Placeholders are not real widgets, so only activate a real
  // placement that is not already active.
  const activatePlacement = (target: WorkbenchWidgetPlacement | undefined) =>
    activateRegionPlacement(workbench, pageContent, target, globalActiveWidgetId);
  const additive = region === "sidenav";
  const hostPlaceholderView =
    placeholder && placement ? (
      <WorkbenchWidgetHost workbench={workbench} placement={placement} widget={placeholder} />
    ) : null;
  const placeholderView =
    !activePlacement && panelRegion ? (
      <PanelPlaceholder workbench={workbench} region={panelRegion} fallback={hostPlaceholderView} />
    ) : (
      hostPlaceholderView
    );

  return (
    <Flex
      ref={regionRef}
      as="section"
      display={chrome === false ? "none" : "flex"}
      direction="column"
      h="full"
      minH="0"
      minW="0"
      w="full"
      bg={transparent ? "transparent" : getWorkbenchRegionBackground(region)}
      overflow="hidden"
      pointerEvents={pointerEvents}
      aria-label={title ?? region}
      onPointerDown={additive ? undefined : () => activatePlacement(activePlacement)}
      onFocusCapture={additive ? undefined : () => activatePlacement(activePlacement)}
    >
      <ModeChromeView workbench={workbench} region={region} viewId={chrome || undefined} />
      {sharedViews ? (
        <WorkbenchPanelViewSlot slotRef={panelSlot.ref} hidden={Boolean(chrome)} placeholder={placeholderView} />
      ) : (
        <RegionScrollArea hidden={Boolean(chrome)} horizontal={scrollsHorizontally}>
          <RegionPageContent workbench={workbench} content={pageContent} />
          {placeholderView}
          {retainedPlacements.map((renderedPlacement) => (
            <WorkbenchRegionPlacement
              key={renderedPlacement.widgetId}
              visible={!chrome && visibleIds.has(renderedPlacement.widgetId)}
              order={renderedPlacements.findIndex((entry) => entry.widgetId === renderedPlacement.widgetId)}
              workbench={workbench}
              placement={renderedPlacement}
              activeWidgetId={activePlacement?.widgetId}
              globalActiveWidgetId={globalActiveWidgetId}
              region={region}
            />
          ))}
        </RegionScrollArea>
      )}
    </Flex>
  );
};
