import { describe, expect, test } from "bun:test";
import type { OpenWorkbenchPanelInput } from "../../registries/layout/layout-types";
import { createWorkbenchPageRegistry } from "../../registries/pages/page-registry";
import { createPageController } from "./page-controller";

// The page engine composes over the live region state, so these tests drive the
// controller against a minimal in-memory layout with the same placement shape.

interface StubWidget {
  widgetId: string;
  contributionId: string;
  resourceUri?: string;
  resource?: { kind: string; uri: string; label?: string };
  role?: string;
}

const createLayoutStub = (initial: Record<string, StubWidget[]>, onOpenPanel?: () => void) => {
  const regions = new Map(Object.entries(initial));
  let counter = 0;
  let activeWidgetId: string | undefined;
  let activeLocationWidgetId: string | undefined;
  const registeredPanels = new Set(["board", "files", "chrome"]);

  const api = {
    getLayout: () => ({
      regions: Object.fromEntries([...regions].map(([id, widgets]) => [id, { widgets }])),
      activeWidgetId,
      activeLocationWidgetId,
    }),
    getPanel: (id: string) => (registeredPanels.has(id) ? { id } : undefined),
    closePanel: (instanceId: string) => {
      for (const [id, widgets] of regions) {
        regions.set(
          id,
          widgets.filter((widget) => widget.widgetId !== instanceId),
        );
      }
    },
  };

  const openPanel = (panelId: string, input?: OpenWorkbenchPanelInput) => {
    onOpenPanel?.();
    counter += 1;
    const widget: StubWidget = {
      widgetId: `${panelId}#${counter}`,
      contributionId: panelId,
      resource: input?.resource ?? undefined,
      resourceUri: input?.resource?.uri,
      role: input?.role ?? "content",
    };
    const region = input?.region ?? "main";
    regions.set(region, [...(regions.get(region) ?? []), widget]);
    return { instanceId: widget.widgetId };
  };

  return {
    api,
    openPanel,
    widgetsIn: (region: string) => regions.get(region) ?? [],
    // The bench's focus moves to any widget the user selects; the Location it shows
    // only changes when a Location tab is selected.
    focus: (widgetId: string) => {
      activeWidgetId = widgetId;
    },
    showLocation: (widgetId: string) => {
      activeWidgetId = widgetId;
      activeLocationWidgetId = widgetId;
    },
  };
};

const createController = (layout: ReturnType<typeof createLayoutStub>, options: { restored?: boolean } = {}) => {
  const pages = createWorkbenchPageRegistry();
  pages.registerPage({
    id: "tickets",
    title: "Tickets",
    slots: [
      { id: "board", region: "main", panelId: "board", closable: false },
      { id: "files", region: "sidenav", cardinality: "many" },
    ],
    bindings: [{ kind: "ticket", panelId: "files", slot: "files" }],
  });
  return createPageController({
    pages,
    layout: layout.api as never,
    openPanel: layout.openPanel,
    applyPageScope: () => options.restored ?? false,
  });
};

describe("page composition and workbench chrome", () => {
  test("seeding a declared region keeps chrome and drops stale page content", async () => {
    const layout = createLayoutStub({
      sidenav: [
        { widgetId: "sidenav-tree", contributionId: "chrome", role: "content" },
        { widgetId: "stale-tab", contributionId: "old-view", role: "sub-panel" },
      ],
      main: [{ widgetId: "old-location", contributionId: "old-view", role: "location" }],
    });
    const controller = createController(layout);

    await controller.activatePage("tickets");

    expect(layout.widgetsIn("sidenav").map((widget) => widget.widgetId)).toEqual(["sidenav-tree"]);
    expect(layout.widgetsIn("main").map((widget) => widget.contributionId)).toEqual(["board"]);
  });

  test("deactivating releases the page's panels so the incoming mode composes a clean bench", async () => {
    const layout = createLayoutStub({
      sidenav: [{ widgetId: "sidenav-tree", contributionId: "chrome", role: "content" }],
      main: [],
    });
    const controller = createController(layout);

    await controller.activatePage("tickets");
    expect(layout.widgetsIn("main").map((widget) => widget.contributionId)).toEqual(["board"]);

    controller.deactivate();

    expect(layout.widgetsIn("main")).toEqual([]);
    expect(layout.widgetsIn("sidenav").map((widget) => widget.widgetId)).toEqual(["sidenav-tree"]);
    expect(controller.getActivePage()).toBeUndefined();
  });

  test("reconciling reopens an unclosable slot whose panel was re-registered", async () => {
    const layout = createLayoutStub({ sidenav: [], main: [] });
    const controller = createController(layout);

    await controller.activatePage("tickets");
    // A contribution refresh disposes the composed panels.
    for (const widget of [...layout.widgetsIn("main")]) layout.api.closePanel(widget.widgetId);
    expect(layout.widgetsIn("main")).toEqual([]);

    controller.reconcile();

    expect(layout.widgetsIn("main").map((widget) => widget.contributionId)).toEqual(["board"]);
  });

  test("re-activating the page it is already on takes back a region a native view claimed", async () => {
    const layout = createLayoutStub({ sidenav: [], main: [] });
    const controller = createController(layout);

    await controller.activatePage("tickets");
    // A native view route opens its own Location in the page's region.
    layout.openPanel("native-view", { region: "main", role: "location" });
    expect(layout.widgetsIn("main")).toHaveLength(2);

    await controller.activatePage("tickets");

    expect(layout.widgetsIn("main").map((widget) => widget.contributionId)).toEqual(["board"]);
  });

  test("a preview activation replaces the location, an activation without one pushes", async () => {
    const layout = createLayoutStub({ sidenav: [], main: [] });
    const controller = createController(layout);
    const ticket = (id: string) => ({ kind: "ticket", uri: `pstdio://ticket/${id}`, label: id });

    await controller.activatePage("tickets");
    // The page's own bare location is a place of its own, so the first resource pushes.
    expect(controller.getLastReason()).toBe("activate");

    await controller.activatePage("tickets", { resource: ticket("a") });
    expect(controller.getLastReason()).toBe("activate");

    // Swapping the previewed resource replaces the entry it swaps out.
    await controller.activatePage("tickets", { resource: ticket("b") });
    expect(controller.getLastReason()).toBe("preview");

    await controller.activatePage("tickets", { resource: ticket("c"), open: "pin" });
    expect(controller.getLastReason()).toBe("pin");
  });

  test("reconciling a restored arrangement keeps chrome and the page's own instances", async () => {
    const layout = createLayoutStub({
      sidenav: [
        { widgetId: "sidenav-tree", contributionId: "chrome", role: "content" },
        {
          widgetId: "files#0",
          contributionId: "files",
          role: "sub-panel",
          resource: { kind: "ticket", uri: "pstdio://ticket/1" },
          resourceUri: "pstdio://ticket/1",
        },
        { widgetId: "foreign", contributionId: "other", role: "sub-panel" },
      ],
      main: [{ widgetId: "board#0", contributionId: "board", role: "location" }],
    });
    const controller = createController(layout, { restored: true });

    await controller.activatePage("tickets");

    expect(layout.widgetsIn("sidenav").map((widget) => widget.widgetId)).toEqual(["sidenav-tree", "files#0"]);
    expect(layout.widgetsIn("main").map((widget) => widget.widgetId)).toEqual(["board#0"]);
  });
});

const workspace = { kind: "workspace", uri: "pstdio://workspace/1" };

const registerHostPage = (controller: ReturnType<typeof createController>, activate: () => void = () => undefined) =>
  controller.registry.registerPage({
    id: "workspaces",
    title: "Workspaces",
    binds: ["workspace"],
    activate,
  });

describe("the navigable location a page publishes", () => {
  test("a host page's location follows the Location the bench shows, not the focused widget", async () => {
    const layout = createLayoutStub({
      main: [{ widgetId: "workspace#1", contributionId: "workspace", role: "location", resource: workspace }],
      secondary: [{ widgetId: "terminal#1", contributionId: "terminal", role: "sub-panel" }],
    });
    const controller = createController(layout);
    registerHostPage(controller);
    layout.showLocation("workspace#1");

    await controller.activatePage("workspaces");
    // Opening a terminal or selecting the sidenav moves the focus off the Location while
    // the bench still shows the workspace; the URL must keep it.
    layout.focus("terminal#1");

    expect(controller.getActiveLocation()?.resource?.uri).toBe(workspace.uri);
  });

  test("a page is on the bench before it composes", async () => {
    let composing: string | undefined;
    let controller: ReturnType<typeof createController>;
    const layout = createLayoutStub({ sidenav: [], main: [] }, () => {
      composing ??= controller.getActivePage()?.id;
    });
    controller = createController(layout);

    await controller.activatePage("tickets");

    expect(composing).toBe("tickets");
  });

  test("a host page is on the bench before its own machinery composes", async () => {
    const layout = createLayoutStub({ sidenav: [], main: [] });
    let activating: string | undefined;
    const controller = createController(layout);
    registerHostPage(controller, () => {
      activating = controller.getActivePage()?.id;
    });

    await controller.activatePage("tickets");
    await controller.activatePage("workspaces");

    expect(activating).toBe("workspaces");
  });

  test("the page's first resource pushes and a later swap replaces", async () => {
    const layout = createLayoutStub({ sidenav: [], main: [] });
    const controller = createController(layout);

    await controller.activatePage("tickets");
    await controller.emitResource({ kind: "ticket", uri: "pstdio://ticket/1" });
    expect(controller.getLastReason()).toBe("activate");

    await controller.emitResource({ kind: "ticket", uri: "pstdio://ticket/2" });
    expect(controller.getLastReason()).toBe("preview");

    await controller.emitResource({ kind: "ticket", uri: "pstdio://ticket/3" }, { open: "pin" });
    expect(controller.getLastReason()).toBe("pin");
  });
});
