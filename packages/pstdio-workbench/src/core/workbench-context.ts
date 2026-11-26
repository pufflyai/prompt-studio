import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchContext } from "pstdio-api-contracts";
import type { WorkbenchWidgetPlacement } from "./registries/layout/layout-types";
import type { WorkbenchCore } from "./workbench-core-types";
import { registerWorkbenchRequiredWork } from "./workbench-required-work";

type Selection = Exclude<WorkbenchContext["selection"], { kind: "unsupported" }>;
type SelectionValue = Selection extends infer Entry ? (Entry extends Selection ? Omit<Entry, "owner"> : never) : never;
const states = new WeakMap<
  WorkbenchCore,
  {
    selections: Map<string, SelectionValue>;
    last?: string;
    listeners: Set<() => void>;
  }
>();
const stateFor = (core: WorkbenchCore) => {
  let state = states.get(core);
  if (!state) {
    state = { selections: new Map(), listeners: new Set() };
    states.set(core, state);
  }
  return state;
};

export const setWorkbenchSelection = (core: WorkbenchCore, owner: string, selection?: SelectionValue) => {
  const state = stateFor(core);
  if (JSON.stringify(state.selections.get(owner)) === JSON.stringify(selection)) return;
  if (!selection) {
    state.selections.delete(owner);
    if (state.last === owner) state.last = undefined;
  } else {
    state.selections.set(owner, selection);
    if (selection.kind !== "none") state.last = owner;
  }
  for (const listener of state.listeners) listener();
};

export const subscribeWorkbenchContext = (core: WorkbenchCore, listener: () => void, closed: () => void) => {
  const state = stateFor(core);
  const stop = [core.pages.store, core.layout.store, core.focus.store].map((store) => store.subscribe(listener));
  state.listeners.add(listener);
  const release = registerWorkbenchRequiredWork(core, closed);
  return () => {
    release();
    state.listeners.delete(listener);
    for (const unsubscribe of stop) unsubscribe();
  };
};

export const boundedResource = (resource: ResourceRef | undefined, projectId: string) =>
  resource && (!resource.projectId || resource.projectId === projectId)
    ? {
        id: resource.id,
        type: resource.type,
        extensionId: resource.extensionId ?? "pstdio",
        projectId,
        label: resource.label?.slice(0, 200),
        shorthand: resource.shorthand?.slice(0, 200),
      }
    : undefined;

const label = (value: unknown) => {
  if (typeof value === "string") return value.slice(0, 200);
  if (value && typeof value === "object" && "default" in value && typeof value.default === "string")
    return value.default.slice(0, 200);
};

const visiblePanels = (core: WorkbenchCore, projectId: string) => {
  const layout = core.layout.getLayout();
  const asPanel = (
    region: WorkbenchContext["panels"][number]["region"],
    widget: WorkbenchWidgetPlacement | undefined,
  ) =>
    widget
      ? {
          region,
          instanceId: widget.widgetId,
          viewId: widget.viewId ?? widget.contributionId,
          label: label(widget.title),
          resource: boundedResource(widget.resource, projectId),
        }
      : undefined;
  const panels = [];
  for (const region of ["main", "side", "secondary", "sidenav", "overlay"] as const) {
    if (
      region !== "main" &&
      !layout.regions[region].visible &&
      !(region === "side" && core.sidePanel.getMode() === "floating")
    )
      continue;
    const tray = layout.regions[region];
    const widget =
      (region === "main" ? core.pages.getContent() : undefined) ??
      tray.widgets.find((entry) => entry.widgetId === tray.activeWidgetId);
    const panel = asPanel(region, widget);
    if (panel) panels.push(panel);
  }
  return panels;
};

export const readWorkbenchContext = (
  core: WorkbenchCore,
  project: WorkbenchContext["project"],
  composer?: string,
): WorkbenchContext | undefined => {
  const { projectId, activeModeId, activePageId, location, pages } = core.pages.store.getState();
  if (projectId !== project.id) return;
  const panels = visiblePanels(core, projectId);
  const activeRegion = core.focus.getActiveRegion();
  const focused =
    (composer && panels.find((panel) => panel.instanceId === composer)) ||
    panels.find((panel) => panel.region === activeRegion);
  const inComposer = Boolean(
    focused &&
      (focused.instanceId === composer ||
        (typeof document !== "undefined" &&
          document.activeElement
            ?.closest("[data-workbench-composer]")
            ?.closest("[data-workbench-instance]")
            ?.getAttribute("data-workbench-instance") === focused.instanceId)),
  );
  const state = stateFor(core);
  const selected = inComposer ? state.last : focused?.instanceId;
  const current = selected && panels.some((panel) => panel.instanceId === selected) && state.selections.get(selected);
  const page = activePageId ? pages[activePageId] : undefined;
  return {
    observedAt: new Date().toISOString(),
    project,
    mode: activeModeId ? { id: activeModeId, label: label(core.modes.getMode(activeModeId)?.label) } : undefined,
    main: {
      page: page
        ? { id: page.ref.id, extensionId: page.ref.extensionId ?? "pstdio", label: label(page.title) }
        : undefined,
      resource: boundedResource(location?.resource, project.id),
    },
    panels,
    focus: focused ? { region: focused.region, instanceId: focused.instanceId, composer: inComposer } : undefined,
    selection: current && selected ? ({ ...current, owner: selected } as Selection) : { kind: "unsupported" },
  };
};
