import { Box } from "@chakra-ui/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { type WorkbenchCore, type WorkbenchPanelMenuRegion, workbenchPanelMenuRegions } from "../../core";
import { movePanelHost } from "../region/move-panel-host";
import { WorkbenchRegion } from "../region/region";
import { ViewActivityContext } from "../shared/view-activity-context";
import { getWorkbenchPanelMenuLabel } from "./use-panel-menu";

type Presentation = "attached" | "floating";
interface MenuHost {
  host: HTMLDivElement;
  slots: Partial<Record<Presentation, { node: HTMLDivElement; active: boolean }>>;
}

const createMenuHosts = () => {
  const entries = new Map<WorkbenchPanelMenuRegion, MenuHost>();
  if (typeof document !== "undefined") {
    for (const regions of Object.values(workbenchPanelMenuRegions)) {
      for (const region of Object.values(regions)) {
        const host = document.createElement("div");
        host.style.display = "contents";
        entries.set(region, { host, slots: {} });
      }
    }
  }
  const present = (entry: MenuHost) => {
    const { attached, floating } = entry.slots;
    if (floating?.active) movePanelHost(entry.host, floating.node);
    else if (attached?.active) movePanelHost(entry.host, attached.node);
    else if (!entry.host.isConnected) movePanelHost(entry.host, attached?.node ?? floating?.node);
    // Closed menus stay connected in their last slot, preserving iframe state.
  };
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  return {
    entries,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    active(region: WorkbenchPanelMenuRegion) {
      return Object.values(entries.get(region)?.slots ?? {}).some((slot) => slot.active);
    },
    attach(region: WorkbenchPanelMenuRegion, presentation: Presentation, node: HTMLDivElement | null) {
      const entry = entries.get(region);
      if (!entry) return;
      const previous = entry.slots[presentation];
      if (!node) {
        // Ref detachment runs before React removes the popup. Move the live host first.
        if (previous?.node === entry.host.parentElement)
          movePanelHost(entry.host, entry.slots[presentation === "attached" ? "floating" : "attached"]?.node);
        delete entry.slots[presentation];
      } else {
        entry.slots[presentation] = { node, active: false };
        present(entry);
      }
      changed();
    },
    activate(region: WorkbenchPanelMenuRegion, presentation: Presentation, active: boolean) {
      const entry = entries.get(region);
      const slot = entry?.slots[presentation];
      if (!entry || !slot || slot.active === active) return;
      slot.active = active;
      present(entry);
      changed();
    },
  };
};

const MenuHostsContext = createContext<ReturnType<typeof createMenuHosts> | null>(null);

// Key slots by region/presentation so each stable ref belongs to exactly one destination.
export const WorkbenchPanelMenuSlot = (props: {
  region: WorkbenchPanelMenuRegion;
  presentation: Presentation;
  active: boolean;
}) => {
  const { region, presentation, active } = props;
  const registry = useContext(MenuHostsContext);
  const [ref] = useState(() => (node: HTMLDivElement | null) => registry?.attach(region, presentation, node));
  useLayoutEffect(() => {
    registry?.activate(region, presentation, active);
    return () => registry?.activate(region, presentation, false);
  }, [registry, region, presentation, active]);
  return <Box ref={ref} display="flex" flexDirection="column" flex="1" minH="0" minW="0" w="full" />;
};

const MenuViewPortal = (props: {
  region: WorkbenchPanelMenuRegion;
  entry: MenuHost;
  registry: ReturnType<typeof createMenuHosts>;
  workbench: WorkbenchCore;
}) => {
  const { region, entry, registry, workbench } = props;
  const parentActive = useContext(ViewActivityContext);
  const active = useSyncExternalStore(registry.subscribe, () => registry.active(region));
  const [panel, side] = region.split("-") as ["main" | "secondary" | "side", "left" | "right"];
  return createPortal(
    <ViewActivityContext value={parentActive && active}>
      <WorkbenchRegion
        workbench={workbench}
        region={region}
        title={getWorkbenchPanelMenuLabel(panel, side)}
        transparent
      />
    </ViewActivityContext>,
    entry.host,
  );
};

export const WorkbenchPanelMenuHosts = (props: { workbench: WorkbenchCore; children: ReactNode }) => {
  const { workbench, children } = props;
  const [registry] = useState(createMenuHosts);
  useEffect(
    () => () => {
      for (const { host } of registry.entries.values()) if (!host.hasChildNodes()) host.remove();
    },
    [registry],
  );
  return (
    <MenuHostsContext value={registry}>
      {children}
      {[...registry.entries].map(([region, entry]) => (
        <MenuViewPortal key={region} region={region} entry={entry} registry={registry} workbench={workbench} />
      ))}
    </MenuHostsContext>
  );
};
