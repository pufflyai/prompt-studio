import { Box } from "@chakra-ui/react";
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
import type { WorkbenchCore, WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../core";
import { workbenchPanelRegions } from "../../core";
import { resolvePageContent } from "../../core/registries/pages/page-content";
import { resolveResourcePreview } from "../../core/registries/resources/resource-preview";
import { useOpenPlacementIds } from "../shared/use-open-placement-ids";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { movePanelHost } from "./move-panel-host";
import { RegionScrollArea } from "./region-scroll-area";
import { isPlacementEligibleForRegion } from "./region-tabs-visibility-hooks";
import { useRetainedViewPlacements } from "./use-retained-view-placements";
import { WorkbenchWidgetHost } from "./widget-host";

interface PanelViewSlots {
  register(region: WorkbenchPanelRegion, node: HTMLDivElement | null): void;
}
const PanelViewContext = createContext<PanelViewSlots | null>(null);
export const usePanelViewSlot = (region: WorkbenchPanelRegion | undefined) => {
  const registry = useContext(PanelViewContext);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!region) return;
    registry?.register(region, node);
    return () => registry?.register(region, null);
  }, [registry, region, node]);
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
  region?: WorkbenchPanelRegion;
  active: boolean;
}) => {
  const { workbench, placement, slot, region, active } = props;
  const view = placement.viewId ? workbench.views.getView(placement.viewId) : undefined;
  const collection = view?.body.kind === "dataTable" || view?.body.kind === "kanban";
  // The portal target is stable for the life of a view. Only its DOM parent moves.
  const [host] = useState(() => {
    const node = document.createElement("div");
    node.style.display = "contents";
    const debug = window as unknown as { __releaseHosts?: Map<string, HTMLElement> };
    (debug.__releaseHosts ??= new Map()).set(placement.widgetId, node);
    return node;
  });
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
  return createPortal(
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
        if (region) workbench.focus.setActiveRegion(region);
      }}
    >
      {/* The retained view owns its viewport, so another tab cannot reset its scroll position. */}
      <RegionScrollArea>
        {/* Preserve collection state while deferring updates and reads for hidden pages. */}
        <Activity mode={active || !collection ? "visible" : "hidden"}>
          <WorkbenchWidgetHost workbench={workbench} placement={placement} region={region} />
        </Activity>
      </RegionScrollArea>
    </Box>,
    host,
  );
};

const PageContentViewHosts = (props: {
  workbench: WorkbenchCore;
  content?: WorkbenchWidgetPlacement;
  slot?: HTMLElement;
  open: ReadonlySet<string>;
}) => {
  const { workbench, content, slot, open } = props;
  const retained = useRetainedViewPlacements(workbench, content ? [content] : [], open);
  return retained.map((placement) => (
    <PanelViewPortal
      key={placement.widgetId}
      workbench={workbench}
      placement={placement}
      region="main"
      slot={slot}
      active={content?.widgetId === placement.widgetId}
    />
  ));
};

// Retained views belong to the project that opened them. Keying this host by project
// releases them on a switch, while the shell and its view slots stay mounted.
const ProjectViewHosts = (props: {
  workbench: WorkbenchCore;
  slots: Partial<Record<WorkbenchPanelRegion, HTMLDivElement>>;
}) => {
  const { workbench, slots } = props;
  const changes = useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const pageState = useWorkbenchStore(workbench.pages.store, (state) => state);
  const content = resolvePageContent(pageState);
  const open = useOpenPlacementIds(workbench);
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const current = workbenchPanelRegions.flatMap((region) => {
    const state = layout.regions[region];
    const eligible = state.widgets.filter(
      (p) =>
        (!p.resource || Boolean(resolveResourcePreview(p.resource, changes))) &&
        isPlacementEligibleForRegion(workbench, region, p),
    );
    const selected = eligible.find((p) => p.widgetId === state.activeWidgetId) ?? eligible[0];
    return eligible.filter((p) => p.widgetId === selected?.widgetId || p.mountStrategy === "keep-mounted");
  });
  const retained = useRetainedViewPlacements(workbench, current, open);
  return (
    <>
      <PageContentViewHosts workbench={workbench} content={content} slot={slots.main} open={open} />
      {retained.map((placement) => {
        const region = workbenchPanelRegions.find((id) =>
          layout.regions[id].widgets.some((p) => p.widgetId === placement.widgetId),
        );
        const peers = region
          ? layout.regions[region].widgets.filter(
              (p) =>
                (!p.resource || Boolean(resolveResourcePreview(p.resource, changes))) &&
                isPlacementEligibleForRegion(workbench, region, p),
            )
          : [];
        const selected = region
          ? (peers.find((p) => p.widgetId === layout.regions[region].activeWidgetId) ?? peers[0])
          : undefined;
        return (
          <PanelViewPortal
            key={placement.widgetId}
            workbench={workbench}
            placement={placement}
            region={region}
            slot={region ? slots[region] : undefined}
            active={selected?.widgetId === placement.widgetId}
          />
        );
      })}
    </>
  );
};

export const WorkbenchPanelViewHosts = (props: { workbench: WorkbenchCore; children: ReactNode }) => {
  const { workbench, children } = props;
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const [slots, setSlots] = useState<Partial<Record<WorkbenchPanelRegion, HTMLDivElement>>>({});
  const [registry] = useState<PanelViewSlots>(() => ({
    register: (region, node) =>
      setSlots((previous) => {
        if (previous[region] === (node ?? undefined)) return previous;
        return { ...previous, [region]: node ?? undefined };
      }),
  }));
  return (
    <PanelViewContext value={registry}>
      {children}
      <ProjectViewHosts key={projectId} workbench={workbench} slots={slots} />
    </PanelViewContext>
  );
};
