import { Box } from "@chakra-ui/react";
import { UiScopeActivity } from "@pstdio/ui";
import {
  Activity,
  createContext,
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  WorkbenchCore,
  WorkbenchPanelMenuRegion,
  WorkbenchPanelRegion,
  WorkbenchWidgetPlacement,
} from "../../core";
import { getWorkbenchPanelForMenuRegion, workbenchPanelMenuRegions, workbenchPanelRegions } from "../../core";
import {
  isRetiredViewerHost,
  releaseViewerHosts,
  reopenViewerHost,
  viewerHostKey,
} from "../../core/controllers/resource-viewers/viewer-host-continuity";
import { resolvePageContent } from "../../core/registries/pages/page-content";
import { resolveResourcePreview } from "../../core/registries/resources/resource-preview";
import { resolvePanelMenuRegionState } from "../panel-menu/panel-menu-placements";
import { useOpenPlacementIds } from "../shared/use-open-placement-ids";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { ViewActivityContext } from "../shared/view-activity-context";
import { movePanelHost } from "./move-panel-host";
import { RegionScrollArea } from "./region-scroll-area";
import { isPlacementEligibleForRegion } from "./region-tabs-visibility-hooks";
import { useRetainedViewPlacements } from "./use-retained-view-placements";
import { WorkbenchWidgetHost } from "./widget-host";

type ViewRegion = WorkbenchPanelRegion | WorkbenchPanelMenuRegion;
const viewRegions: ViewRegion[] = [
  ...workbenchPanelRegions,
  ...Object.values(workbenchPanelMenuRegions).flatMap((sides) => Object.values(sides)),
];
const isPanel = (region: ViewRegion): region is WorkbenchPanelRegion =>
  workbenchPanelRegions.includes(region as WorkbenchPanelRegion);

type HeaderSurface = "content" | "header" | "page-header";
type ViewSlot = { node: HTMLDivElement; active: boolean };
type ViewSlots = Record<HeaderSurface, Partial<Record<ViewRegion, ViewSlot>>>;
interface PanelViewSlots {
  register(region: ViewRegion, node: HTMLDivElement | null, surface: HeaderSurface, active: boolean): void;
}
const PanelViewContext = createContext<PanelViewSlots | null>(null);
export const usePanelViewSlot = (region: ViewRegion | undefined, surface: HeaderSurface = "content") => {
  const registry = useContext(PanelViewContext);
  const active = useContext(ViewActivityContext);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!region) return;
    registry?.register(region, node, surface, active);
    return () => registry?.register(region, null, surface, false);
  }, [registry, region, node, surface, active]);
  return { enabled: Boolean(registry && region), ref: setNode };
};

interface WorkbenchPanelViewSlotProps {
  slotRef: Ref<HTMLDivElement>;
  hidden: boolean;
  placeholder: ReactNode;
}

export const WorkbenchPanelViewSlot = (props: WorkbenchPanelViewSlotProps) => {
  const { slotRef, hidden, placeholder } = props;
  return (
    <>
      {placeholder ? <RegionScrollArea hidden={hidden}>{placeholder}</RegionScrollArea> : null}
      {/* Keep the slot connected when chrome or a placeholder hides retained views. */}
      <Box
        ref={slotRef}
        display={hidden || placeholder ? "none" : "flex"}
        flexDirection="column"
        flex="1"
        minH="0"
        w="full"
        minW="0"
      />
    </>
  );
};

const PanelViewPortal = (props: {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  slot?: HTMLElement;
  headerSlot?: HTMLElement;
  region?: ViewRegion;
  active: boolean;
}) => {
  const { workbench, placement, slot, headerSlot, region, active } = props;
  const view = useWorkbenchStore(workbench.views.store, () =>
    placement.viewId ? workbench.views.getView(placement.viewId) : undefined,
  );
  const headerViewId = view?.header?.viewId;
  const collection =
    view?.body.kind === "dataTable" || view?.body.kind === "kanban" || view?.body.kind === "resourceList";
  // The portal target is stable for the life of a view. Only its DOM parent moves.
  const [host] = useState(() => {
    const node = document.createElement("div");
    node.style.display = "contents";
    return node;
  });
  const [headerHost] = useState(() => {
    const node = document.createElement("div");
    node.style.display = "contents";
    return node;
  });
  useLayoutEffect(() => {
    movePanelHost(headerHost, headerSlot);
  }, [headerHost, headerSlot]);
  useEffect(
    () => () => {
      if (!headerHost.hasChildNodes()) headerHost.remove();
    },
    [headerHost],
  );
  useLayoutEffect(() => {
    // Hidden retained views stay connected to keep their iframe browsing context.
    movePanelHost(host, slot);
  }, [host, slot]);
  useEffect(
    () => () => {
      // React removes portal children before passive unmount cleanup. StrictMode
      // replays effects with those children still live, so their host must stay connected.
      if (!host.hasChildNodes()) host.remove();
    },
    [host],
  );
  const activate = () => {
    if (workbench.pages.getContent()?.widgetId === placement.widgetId) {
      workbench.focus.setActiveRegion("main");
      return;
    }
    if (workbench.layout.getLayout().activeWidgetId !== placement.widgetId)
      workbench.layout.activatePanel(placement.widgetId);
  };
  const content = createPortal(
    <Box
      data-workbench-instance={placement.widgetId}
      display={active ? "flex" : "none"}
      inert={!active}
      flex="1"
      minW="0"
      minH="0"
      w="full"
      overflow="hidden"
      onPointerDown={activate}
      onFocusCapture={(event) => {
        if (!event.currentTarget.contains(event.target)) return;
        activate();
        if (region) workbench.focus.setActiveRegion(isPanel(region) ? region : getWorkbenchPanelForMenuRegion(region));
      }}
    >
      {/* The retained view owns its viewport, so another tab cannot reset its scroll position. */}
      <ViewActivityContext value={active}>
        <UiScopeActivity active={active}>
          <RegionScrollArea>
            {/* Preserve collection state while deferring updates and reads for hidden pages. */}
            <Activity mode={active || !collection ? "visible" : "hidden"}>
              <WorkbenchWidgetHost workbench={workbench} placement={placement} region={region} visible={active} />
            </Activity>
          </RegionScrollArea>
        </UiScopeActivity>
      </ViewActivityContext>
    </Box>,
    host,
  );
  return (
    <>
      {content}
      {headerViewId
        ? createPortal(
            <Box
              data-workbench-header-for={placement.widgetId}
              display={active ? "flex" : "none"}
              inert={!active}
              flex="1"
              minW="0"
              h="full"
              onPointerDown={activate}
              onFocusCapture={(event) => {
                if (!event.currentTarget.contains(event.target)) return;
                activate();
                if (region)
                  workbench.focus.setActiveRegion(isPanel(region) ? region : getWorkbenchPanelForMenuRegion(region));
              }}
            >
              <ViewActivityContext value={active}>
                <UiScopeActivity active={active}>
                  <WorkbenchWidgetHost
                    workbench={workbench}
                    placement={placement}
                    viewId={headerViewId}
                    region={region}
                    visible={active}
                  />
                </UiScopeActivity>
              </ViewActivityContext>
            </Box>,
            headerHost,
          )
        : null}
    </>
  );
};

// Retained views belong to the project that opened them. Keying this host by project
// releases them on a switch, while the shell and its view slots stay mounted.
const ProjectViewHosts = (props: { workbench: WorkbenchCore; slots: ViewSlots }) => {
  "use no memo";
  const { workbench, slots } = props;
  const changes = useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const pageState = useWorkbenchStore(workbench.pages.store, (state) => state);
  const content = resolvePageContent(pageState);
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  const open = useOpenPlacementIds(workbench);
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const eligibleIn = (region: ViewRegion) => {
    if (!isPanel(region)) return resolvePanelMenuRegionState(workbench, region).widgets;
    return layout.regions[region].widgets.filter(
      (placement) =>
        (!placement.resource || Boolean(resolveResourcePreview(placement.resource, changes))) &&
        isPlacementEligibleForRegion(workbench, region, placement),
    );
  };
  const current = [
    ...(content ? [content] : []),
    ...viewRegions.flatMap((region) => {
      const eligible = eligibleIn(region);
      const selected =
        eligible.find((placement) => placement.widgetId === layout.regions[region].activeWidgetId) ?? eligible[0];
      return eligible.filter(
        (placement) => placement.widgetId === selected?.widgetId || placement.mountStrategy === "keep-mounted",
      );
    }),
  ];
  for (const placement of current) reopenViewerHost(workbench, placement.widgetId);
  const retained = useRetainedViewPlacements(workbench, current, open);
  const hosts = new Map(
    retained
      .filter((placement) => !isRetiredViewerHost(workbench, placement.widgetId))
      .map((placement) => [viewerHostKey(workbench, placement.widgetId), placement]),
  );
  useEffect(
    () => releaseViewerHosts(workbench, new Set(retained.map((placement) => placement.widgetId))),
    [workbench, retained],
  );
  return (
    <>
      {[...hosts].map(([key, placement]) => {
        const region =
          content?.widgetId === placement.widgetId
            ? "main"
            : viewRegions.find((id) => layout.regions[id].widgets.some((p) => p.widgetId === placement.widgetId));
        const peers = region ? eligibleIn(region) : [];
        const selected = region
          ? (peers.find((p) => p.widgetId === layout.regions[region].activeWidgetId) ?? peers[0])
          : undefined;
        const headerSurface = content?.widgetId === placement.widgetId && !fullscreen ? "page-header" : "header";
        return (
          <PanelViewPortal
            key={key}
            workbench={workbench}
            placement={placement}
            region={region}
            slot={region ? slots.content[region]?.node : undefined}
            headerSlot={region && isPanel(region) ? slots[headerSurface][region]?.node : undefined}
            active={
              (content?.widgetId === placement.widgetId || selected?.widgetId === placement.widgetId) &&
              (!region || slots.content[region]?.active !== false)
            }
          />
        );
      })}
    </>
  );
};

export const WorkbenchPanelViewHosts = (props: { workbench: WorkbenchCore; children: ReactNode }) => {
  const { workbench, children } = props;
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const [slots, setSlots] = useState<ViewSlots>({ content: {}, header: {}, "page-header": {} });
  const [registry] = useState<PanelViewSlots>(() => ({
    register: (region, node, surface, active) =>
      setSlots((previous) => {
        const current = previous[surface][region];
        if (current?.node === (node ?? undefined) && (!node || current?.active === active)) return previous;
        return { ...previous, [surface]: { ...previous[surface], [region]: node ? { node, active } : undefined } };
      }),
  }));
  return (
    <PanelViewContext value={registry}>
      {children}
      <ProjectViewHosts key={projectId} workbench={workbench} slots={slots} />
    </PanelViewContext>
  );
};
