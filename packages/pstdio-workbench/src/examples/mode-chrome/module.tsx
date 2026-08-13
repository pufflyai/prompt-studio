import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "../../core";
import {
  ChromeActivityRail,
  ChromeExtraPanel,
  ChromeItemInspector,
  ChromeLibraryPage,
  ChromeNotes,
  ChromeOverview,
  ChromeStatusStrip,
} from "./components";
import { chromeItemKind, chromeItemResource, chromeItems, chromeModes, chromeWidgetIds } from "./data";

const catalogQueryDelayMs = 700;

const viewKind = "mode-chrome.view";

const viewResource = (id: string, label: string, icon: string) => ({
  kind: viewKind,
  uri: `mode-chrome://view/${id}`,
  id,
  label,
  icon,
});

const registerWidgets = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel({
    closable: false,
    id: chromeWidgetIds.rail,
    title: "Activity rail",
    region: "activity",
    singleton: true,
    rendererId: chromeWidgetIds.rail,
  });
  ctx.renderers.registerRenderer({
    id: chromeWidgetIds.rail,
    render: (input) => <ChromeActivityRail input={input} />,
  });
  ctx.layout.registerPanel({
    closable: false,
    id: chromeWidgetIds.status,
    title: "Status strip",
    region: "status",
    singleton: true,
    rendererId: chromeWidgetIds.status,
  });
  ctx.renderers.registerRenderer({
    id: chromeWidgetIds.status,
    render: (input) => <ChromeStatusStrip input={input} />,
  });

  ctx.layout.registerPanel({
    closable: false,
    id: chromeWidgetIds.overview,
    title: "Overview",
    region: "main",
    singleton: true,
    rendererId: chromeWidgetIds.overview,
  });
  ctx.renderers.registerRenderer({ id: chromeWidgetIds.overview, render: () => <ChromeOverview /> });

  // A deliberately slow query: the first visit shows the loading state, revisits
  // render the cached rows instantly while the refresh runs.
  ctx.renderers.registerDataTableRenderer({
    id: chromeWidgetIds.catalog,
    title: "Catalog",
    columns: [
      { id: "label", label: "Item" },
      { id: "role", label: "Role" },
      { id: "trust", label: "Trust" },
    ],
    executeQuery: async () => {
      await new Promise((resolve) => setTimeout(resolve, catalogQueryDelayMs));
      return {
        rows: chromeItems.map((item) => ({
          id: item.id,
          values: { label: item.label, role: item.role, trust: item.trust },
          resource: chromeItemResource(item),
        })),
      };
    },
  });
  ctx.layout.registerPanel({
    closable: false,
    id: chromeWidgetIds.catalog,
    title: "Catalog",
    region: "main",
    eligibleLocations: {},
    resourceKinds: [viewKind],
    rendererId: chromeWidgetIds.catalog,
  });

  ctx.layout.registerPanel({
    closable: false,
    id: chromeWidgetIds.notes,
    title: "Notes",
    region: "main",
    eligibleLocations: {},
    resourceKinds: [viewKind],
    rendererId: chromeWidgetIds.notes,
  });
  ctx.renderers.registerRenderer({ id: chromeWidgetIds.notes, render: () => <ChromeNotes /> });

  // Addable Sub Panels: registered but not opened by the seed, so they appear in
  // the header's "+" menu and each add must create a tab with its own title.
  for (const extra of ["Timeline", "Metrics", "Console"]) {
    const id = `mode-chrome.extra-${extra.toLowerCase()}`;
    ctx.layout.registerPanel({
      closable: true,
      id,
      title: extra,
      region: "main",
      singleton: true,
      eligibleLocations: {},
      resourceKinds: [viewKind],
      rendererId: id,
    });
    ctx.renderers.registerRenderer({ id, render: () => <ChromeExtraPanel name={extra} /> });
  }

  ctx.layout.registerPanel({
    closable: true,
    id: chromeWidgetIds.inspector,
    title: "Item",
    region: "side",
    singleton: true,
    rendererId: chromeWidgetIds.inspector,
  });
  ctx.renderers.registerRenderer({
    id: chromeWidgetIds.inspector,
    render: (input) => <ChromeItemInspector input={input} />,
  });

  ctx.layout.registerPanel({
    closable: false,
    id: chromeWidgetIds.libraryPage,
    title: "Library",
    region: "main",
    singleton: true,
    rendererId: chromeWidgetIds.libraryPage,
  });
  ctx.renderers.registerRenderer({ id: chromeWidgetIds.libraryPage, render: () => <ChromeLibraryPage /> });

  // Selecting a catalog row opens the item in the Side Panel as an inspector: no
  // Location switch, the table keeps its tab and selection context.
  ctx.resources.registerKind({ kind: viewKind, label: "View" });
  ctx.resources.registerKind({ kind: chromeItemKind, label: "Catalog item", icon: "package-search" });
  ctx.resources.registerPresenter({
    id: "mode-chrome.item-inspector",
    canOpen: (resource) => resource.kind === chromeItemKind,
    open: (resource) => {
      ctx.panels.setOpen("side", true);
      ctx.layout.setRegionVisible("side", true);
      ctx.sidePanel.setMode("attached");
      const placement = ctx.layout.openPanel(chromeWidgetIds.inspector, {
        resource,
        strategy: { kind: "persistent" },
      });
      ctx.layout.activatePanel(placement.instanceId);
      return placement;
    },
  });
};

const registerModes = (ctx: WorkbenchModuleContext) => {
  ctx.modes.registerMode({
    id: chromeModes.studio.id,
    label: chromeModes.studio.label,
    panels: ["main", "side"],
    activate: () => undefined,
    seed(modeCtx) {
      modeCtx.layout.openPanel(chromeWidgetIds.rail, { pinned: true });
      modeCtx.layout.openPanel(chromeWidgetIds.status, { pinned: true });
      // The Location opens first: Sub Panels bind to the Location active when
      // they open. Re-opening the overview at the end re-activates its tab.
      modeCtx.layout.openPanel(chromeWidgetIds.overview, {
        resource: viewResource("overview", "Overview", "layout-dashboard"),
        strategy: { kind: "persistent" },
      });
      modeCtx.layout.openPanel(chromeWidgetIds.catalog, {
        resource: viewResource("catalog", "Catalog", "package-search"),
        strategy: { kind: "persistent" },
      });
      modeCtx.layout.openPanel(chromeWidgetIds.notes, {
        resource: viewResource("notes", "Notes", "notebook-pen"),
        strategy: { kind: "persistent" },
      });
      modeCtx.layout.openPanel(chromeWidgetIds.overview, {
        resource: viewResource("overview", "Overview", "layout-dashboard"),
        strategy: { kind: "persistent" },
      });
    },
  });
  ctx.modes.registerMode({
    id: chromeModes.library.id,
    label: chromeModes.library.label,
    panels: ["main"],
    activate: () => undefined,
    seed(modeCtx) {
      // The library declares no activity or status chrome, so entering it sweeps
      // both regions — the studio re-stages them on its next entry.
      modeCtx.layout.clearRegion("activity");
      modeCtx.layout.clearRegion("status");
      modeCtx.layout.openPanel(chromeWidgetIds.libraryPage, {
        resource: viewResource("library", "Library", "book-open"),
        strategy: { kind: "persistent" },
      });
    },
    enter(modeCtx) {
      modeCtx.layout.clearRegion("activity");
      modeCtx.layout.clearRegion("status");
      return undefined;
    },
  });
};

// Demonstrates the mode-chrome foundations: an activity rail and a status strip
// staged per mode, one Location with Sub Panel tabs beside it, a cached slow data
// table, and a Side Panel inspector opened from row selection.
export const createModeChromeExampleModule = (): WorkbenchModuleContribution => ({
  id: "mode-chrome-example",
  activate(ctx) {
    registerWidgets(ctx);
    registerModes(ctx);
    ctx.modes.setActiveMode(chromeModes.studio.id);
    return undefined;
  },
});
