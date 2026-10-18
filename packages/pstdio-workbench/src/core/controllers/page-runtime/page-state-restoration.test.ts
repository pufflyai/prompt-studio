import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createDefaultWorkbenchLayout } from "../../registries/layout/layout-types";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import { openResourceSlot, primarySlot } from "../../registries/pages/page-slot-lifecycle";
import { createWorkbench } from "../../workbench-core";
import { createMemoryWorkbenchPageLocationBrowser } from "../page-location/page-location-memory";
import type { PersistedWorkbenchPageLocation } from "../page-location/page-location-types";
import { pageStateFromLayout } from "./page-state-restoration";

test("restores the selected primary instance after its presentation moves to Side", () => {
  const page: WorkbenchPageContribution = {
    id: "files",
    ref: { kind: "page", extensionId: "test", id: "files" },
    path: "files",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  };
  const layout = createDefaultWorkbenchLayout();
  layout.regions.side.widgets = ["one", "two"].map((id) => ({
    widgetId: id,
    contributionId: "files",
    role: "location",
    placementIdentity: { kind: "page", pageId: "files", slotId: "$main", instanceKey: id },
    resource: { type: "file", id },
    tabRetention: "persistent",
  }));
  layout.regions.side.activeWidgetId = "one";
  layout.activeLocationWidgetId = "one";
  expect(pageStateFromLayout(page, layout, undefined).activePrimaryInstanceKey).toBe("one");
});

test("restored single-resource pages give another resource its own placement", () => {
  const page: WorkbenchPageContribution = {
    id: "preview",
    ref: { kind: "page", extensionId: "test", id: "preview" },
    path: "preview",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "animation" }] },
    main: { kind: "view", view: { kind: "view", id: "preview" }, cardinality: "one" },
    slots: [],
  };
  const layout = createDefaultWorkbenchLayout();
  layout.regions.main.widgets = [
    {
      widgetId: "preview",
      contributionId: "preview",
      placementIdentity: { kind: "page", pageId: "preview", slotId: "$main", instanceKey: "first" },
      resource: { type: "animation", id: "first" },
    },
  ];
  layout.activeLocationWidgetId = "preview";
  const restored = pageStateFromLayout(page, layout, undefined);
  const next = openResourceSlot({
    slot: primarySlot(page)!,
    state: restored,
    target: { pageId: page.id, resource: { type: "animation", id: "next" } },
    resourceKey: (resource) => resource.id,
  });
  expect(next.activePrimaryInstanceKey).toBe("next");
  expect(next.activePrimaryInstanceKey).not.toBe(restored.activePrimaryInstanceKey);
});

test("restoring a saved route preserves the replacement after its last primary preview closed", async () => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const locations = new Map<string, PersistedWorkbenchPageLocation>();
  const setup = () => {
    const w = createWorkbench({
      layoutPersistence: {
        getLayout: (scope) => layouts.get(scope),
        setLayout: (value, scope) => {
          layouts.set(scope, value);
        },
      },
      pageLocationPersistence: {
        load: (id) => locations.get(id),
        save: (id, value) => {
          locations.set(id, value);
        },
      },
      resolvePagePersistenceScope: ({ projectId, resource }) => ({ scope: `${projectId}/${resource?.id ?? "home"}` }),
    });
    w.modes.registerMode({ id: "edit", activate() {} });
    w.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
    w.pages.registerPage({
      id: "home",
      ref: home,
      path: "",
      modeId: "edit",
      main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
      slots: [],
    });
    w.pages.registerPage({
      id: "docs",
      ref: docs,
      parentId: "home",
      path: "docs",
      modeId: "edit",
      resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
      main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
      slots: [],
    });
    w.modePlacements.registerPlacement({
      id: "related",
      ref: related,
      modeId: "edit",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "file" }],
          view: { kind: "view", id: "editor" },
          cardinality: "many",
        },
      },
    });
    return w;
  };
  const w = setup();
  w.pageLocations.setProject("project");
  await w.navigation.openTarget({
    kind: "page",
    page: docs,
    resource: { type: "file", id: "routed" },
    open: "preview",
  });
  await w.navigation.openTarget({
    kind: "panel",
    panel: related,
    resource: { type: "file", id: "incoming" },
    open: "preview",
  });
  w.movePanel(w.layout.listPanelInstances("side")[0]!.instanceId, "main");
  w.pinPlacement(
    w.layout.listPanelInstances("main").find((panel) => panel.resource?.id === "incoming")!.placementIdentity!,
    false,
  );
  const restored = setup();
  expect(restored.pageLocations.boot("project").ok).toBe(true);
  expect(restored.layout.listPanelInstances("main").map((panel) => panel.resource?.id)).toEqual(["incoming"]);
  expect(restored.getPrimaryResource()?.id).toBe("routed");
  await restored.navigation.openTarget({
    kind: "page",
    page: docs,
    resource: { type: "file", id: "routed" },
    open: "preview",
  });
  expect(restored.layout.listPanelInstances("main").map((panel) => panel.resource?.id)).toEqual(["routed"]);
});

const home = { kind: "page", extensionId: "test", id: "home" } as const;
const docs = { kind: "page", extensionId: "test", id: "docs" } as const;
const related = { kind: "placement", extensionId: "test", id: "related" } as const;

test("booting a different direct URL selects its resource over the saved tab", async () => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const locations = new Map<string, PersistedWorkbenchPageLocation>();
  const setup = (url = "/") => {
    const browser = createMemoryWorkbenchPageLocationBrowser();
    browser.replace({ url });
    const w = createWorkbench({
      layoutPersistence: {
        getLayout: (scope) => layouts.get(scope),
        setLayout: (value, scope) => {
          layouts.set(scope, value);
        },
      },
      pageLocationPersistence: {
        load: (id) => locations.get(id),
        save: (id, value) => {
          locations.set(id, value);
        },
      },
      pageLocationBrowser: browser,
    });
    w.modes.registerMode({ id: "edit", activate() {} });
    w.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
    w.pages.registerPage({
      id: "home",
      ref: home,
      path: "",
      modeId: "edit",
      main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
      slots: [],
    });
    w.pages.registerPage({
      id: "docs",
      ref: docs,
      parentId: "home",
      path: "docs",
      modeId: "edit",
      resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
      main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
      slots: [],
    });
    return { w, browser };
  };
  const first = setup();
  first.w.pageLocations.setProject("project");
  const target = (id: string) => ({ kind: "page", page: docs, resource: { type: "file", id }, open: "pin" }) as const;
  await first.w.navigation.openTarget(target("a"));
  await first.w.navigation.openTarget(target("b"));
  const url = first.browser.current().url;
  await first.w.navigation.openTarget(target("a"));
  const { w } = setup(url);
  expect(w.pageLocations.boot("project").ok).toBe(true);
  expect(w.getPrimaryResource()?.id).toBe("b");
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("b");
  expect(w.layout.getActivePanel()?.resource?.id).toBe("b");
});
