import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const page = { kind: "page" as const, extensionId: "test", id: "shared" };
const resource = { type: "document", id: "first", projectId: "project" };
const harness = () => {
  const home = { ...page, id: "home" };
  const workbench = createWorkbench({ startPage: home });
  for (const id of ["edit", "review"]) workbench.modes.registerMode({ id, activate() {} });
  workbench.views.registerView({
    id: "editor",
    title: "Editor",
    instancePolicy: "per-resource",
    body: { kind: "react", render: () => null },
  });
  workbench.pages.registerPage({
    id: "home",
    ref: home,
    path: "home",
    modeId: "edit",
    modeIds: ["edit", "review"],
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "shared",
    parentId: "home",
    ref: page,
    path: "shared",
    modeId: "edit",
    modeIds: ["edit", "review"],
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.setProject("project");
  workbench.pageLocations.navigate({ kind: "page", page, resource, mode: { kind: "mode", id: "edit" } });
  return workbench;
};

test.each([
  "direct",
  "compound",
])("%s reopening an existing resource editor uses the explicit allowed page mode", async (path) => {
  const workbench = harness();
  const instance = workbench.layout.getLayout().regions.main.widgets[0]!.widgetId;
  const target = { kind: "page" as const, page, resource, mode: { kind: "mode" as const, id: "review" } };
  if (path === "direct") expect(workbench.pageLocations.navigate(target).ok).toBe(true);
  else await workbench.navigation.openTarget({ kind: "compound", targets: [target] });
  expect(workbench.modes.getActiveModeId()).toBe("review");
  expect(workbench.pages.store.getState().location?.mode?.id).toBe(target.mode.id);
  expect(workbench.layout.getLayout().regions.main.widgets.map((tab) => tab.widgetId)).toEqual([instance]);
});

test("history replay through a reused resource editor preserves Forward navigation", () => {
  const workbench = harness();
  workbench.pageLocations.navigate({ kind: "page", page, resource: { ...resource, id: "second" } });
  workbench.pageLocations.navigate({ kind: "page", page: { ...page, id: "home" } });
  workbench.pageLocations.goBack();
  expect(workbench.pages.store.getState().location?.resource?.id).toBe("second");
  expect(workbench.pageLocations.historyStore.getState().canGoForward).toBe(true);
});

test("reopening a mode-owned resource editor can return to its shared base page", async () => {
  const workbench = harness();
  const home = { ...page, id: "home" };
  for (const id of ["edit", "review"]) {
    workbench.modePlacements.registerPlacement({
      id: `test.${id}`,
      ref: { kind: "placement", extensionId: "test", id },
      modeId: id,
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "document" }],
          view: { kind: "view", id: "editor" },
          cardinality: "many",
        },
      },
    });
  }
  const foreign = { ...resource, id: "mode-owned" };
  workbench.pageLocations.navigate({ kind: "page", page: home, mode: { kind: "mode", id: "review" } });
  await workbench.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: "test", id: "review" },
    resource: foreign,
    open: "pin",
  });
  const instance = workbench.layout.getLayout().regions.side.widgets[0]!.widgetId;
  workbench.pageLocations.navigate({ kind: "page", page: home, mode: { kind: "mode", id: "edit" } });
  await workbench.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: "test", id: "edit" },
    resource: foreign,
  });
  expect(workbench.modes.getActiveModeId()).toBe("review");
  expect(workbench.pages.store.getState().location?.mode?.id).toBe("review");
  expect(workbench.layout.getLayout().regions.side.widgets.map((tab) => tab.widgetId)).toEqual([instance]);
});
