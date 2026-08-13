import type { WorkbenchModeActivationContext, WorkbenchModuleContext, WorkbenchModuleContribution } from "../../core";
import {
  ChromeActivityRail,
  ChromeBoardHost,
  ChromeBoardView,
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
    icon: "layout-dashboard",
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
    icon: "package-search",
    region: "main",
    eligibleLocations: {},
    resourceKinds: [viewKind],
    rendererId: chromeWidgetIds.catalog,
  });

  ctx.layout.registerPanel({
    closable: false,
    id: chromeWidgetIds.notes,
    title: "Notes",
    icon: "notebook-pen",
    region: "main",
    eligibleLocations: {},
    resourceKinds: [viewKind],
    rendererId: chromeWidgetIds.notes,
  });
  ctx.renderers.registerRenderer({ id: chromeWidgetIds.notes, render: () => <ChromeNotes /> });

  // Addable Sub Panels: registered but not opened by the seed, so they appear in
  // the header's "+" menu and each add must create a tab with its own title.
  const extraPanels = [
    { title: "Timeline", icon: "chart-gantt" },
    { title: "Metrics", icon: "chart-line" },
    { title: "Console", icon: "square-terminal" },
  ];
  for (const { title: extra, icon } of extraPanels) {
    const id = `mode-chrome.extra-${extra.toLowerCase()}`;
    ctx.layout.registerPanel({
      closable: true,
      id,
      title: extra,
      icon,
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
    icon: "package-search",
    region: "side",
    singleton: true,
    rendererId: chromeWidgetIds.inspector,
  });
  ctx.renderers.registerRenderer({
    id: chromeWidgetIds.inspector,
    render: (input) => <ChromeItemInspector input={input} />,
  });

  // A sub-panels-only Location: it anchors the resource but renders no tab and
  // no content of its own — its Sub Panels are the content.
  ctx.layout.registerPanel({
    closable: false,
    id: chromeWidgetIds.boardHost,
    title: "Board",
    region: "main",
    singleton: true,
    subPanelsOnly: true,
    rendererId: chromeWidgetIds.boardHost,
  });
  ctx.renderers.registerRenderer({ id: chromeWidgetIds.boardHost, render: () => <ChromeBoardHost /> });
  ctx.layout.registerPanel({
    closable: true,
    id: chromeWidgetIds.boardColumns,
    title: "Columns",
    icon: "columns-3",
    region: "main",
    singleton: true,
    eligibleLocations: {},
    resourceKinds: [viewKind],
    rendererId: chromeWidgetIds.boardColumns,
  });
  ctx.renderers.registerRenderer({
    id: chromeWidgetIds.boardColumns,
    render: () => (
      <ChromeBoardView
        name="Columns"
        hint="The first Sub Panel activates automatically: the Board Location never shows its own tab or content."
      />
    ),
  });
  ctx.layout.registerPanel({
    closable: true,
    id: chromeWidgetIds.boardSwimlanes,
    title: "Swimlanes",
    icon: "rows-3",
    region: "main",
    singleton: true,
    eligibleLocations: {},
    resourceKinds: [viewKind],
    rendererId: chromeWidgetIds.boardSwimlanes,
  });
  ctx.renderers.registerRenderer({
    id: chromeWidgetIds.boardSwimlanes,
    render: () => (
      <ChromeBoardView
        name="Swimlanes"
        hint="A second Sub Panel beside Columns; the tab strip shows only the Sub Panels."
      />
    ),
  });

  ctx.layout.registerPanel({
    closable: false,
    id: chromeWidgetIds.libraryPage,
    title: "Library",
    icon: "book-open",
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
  // The rail and strip live in mode-agnostic regions, so every chrome-owning
  // mode re-stages them on entry — a mode that cleared them may have run since.
  const stageChrome = (modeCtx: WorkbenchModeActivationContext) => {
    modeCtx.layout.openPanel(chromeWidgetIds.rail, { pinned: true });
    modeCtx.layout.openPanel(chromeWidgetIds.status, { pinned: true });
    return undefined;
  };

  ctx.modes.registerMode({
    id: chromeModes.studio.id,
    label: chromeModes.studio.label,
    panels: ["main", "side"],
    activate: () => undefined,
    enter: stageChrome,
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
    id: chromeModes.board.id,
    label: chromeModes.board.label,
    panels: ["main"],
    activate: () => undefined,
    enter: stageChrome,
    seed(modeCtx) {
      // Each mode stages its own Main content; without this the previous mode's
      // Location would carry over as an extra document tab.
      modeCtx.layout.clearRegion("main");
      modeCtx.layout.openPanel(chromeWidgetIds.rail, { pinned: true });
      modeCtx.layout.openPanel(chromeWidgetIds.status, { pinned: true });
      const boardResource = viewResource("board", "Board", "kanban");
      modeCtx.layout.openPanel(chromeWidgetIds.boardHost, {
        resource: boardResource,
        strategy: { kind: "persistent" },
      });
      modeCtx.layout.openPanel(chromeWidgetIds.boardColumns, {
        resource: boardResource,
        title: "Columns",
        strategy: { kind: "persistent" },
      });
      modeCtx.layout.openPanel(chromeWidgetIds.boardSwimlanes, {
        resource: boardResource,
        title: "Swimlanes",
        strategy: { kind: "persistent" },
      });
      modeCtx.layout.openPanel(chromeWidgetIds.boardHost, {
        resource: boardResource,
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
      modeCtx.layout.clearRegion("main");
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
