import { expect, test } from "bun:test";
import type { PageRef } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";

const page: PageRef = { kind: "page", extensionId: "test", id: "workspace" };
const target = (id: string) => ({ kind: "page" as const, page, resource: { type: "workspace", id } });
const file = (id: string, open: "pin" | "preview" = "pin") => ({
  kind: "panel" as const,
  panel: { kind: "page-slot" as const, page, id: "files" },
  resource: { type: "file", id, label: id },
  open,
});
const harness = (saved: Map<string | undefined, WorkbenchLayout>, fixedFiles = false, withoutSide = false) => {
  const workbench = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, layout),
    },
  });
  workbench.modes.registerMode({ id: "edit", panels: withoutSide ? ["main", "secondary"] : undefined, activate() {} });
  for (const id of ["empty", "editor", "inspector"])
    workbench.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    tabLocks: fixedFiles ? "legacy" : undefined,
    id: "workspace",
    ref: page,
    path: "workspace",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [
      {
        id: "files",
        region: "main",
        item: fixedFiles
          ? { kind: "view", view: { kind: "view", id: "editor" }, presence: "fixed" }
          : {
              kind: "binding",
              binding: {
                kinds: [{ kind: "resource-kind", id: "file" }],
                view: { kind: "view", id: "editor" },
                cardinality: "many",
              },
            },
      },
      {
        id: "inspector",
        region: "side",
        item: { kind: "view", view: { kind: "view", id: "inspector" }, presence: "open" },
      },
    ],
  });
  workbench.pageLocations.setProject("project");
  return workbench;
};

test("reload restores editor collections and closed panels from each location's layout", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const first = harness(saved);
  await first.navigation.openTarget(target("alpha"));
  await first.navigation.openTarget(file("readme"));
  await first.navigation.openTarget(file("notes", "preview"));
  const inspector = first.pages.store
    .getState()
    .placements.find((placement) => placement.identity.kind === "page" && placement.identity.slotId === "inspector")!;
  first.pageLocations.closePlacement(inspector.identity);
  await first.navigation.openTarget(target("beta"));
  await first.navigation.openTarget(file("beta-file"));
  first.pageLocations.dispose();

  const restored = harness(saved);
  await restored.navigation.openTarget(target("alpha"));
  expect(
    restored.layout.getLayout().regions.main.widgets.map((item) => [item.resource?.id, item.tabRetention]),
  ).toEqual([
    ["readme", "persistent"],
    ["notes", "preview"],
  ]);
  expect(restored.layout.getLayout().regions.side.widgets).toHaveLength(0);
  await restored.navigation.openTarget(file("replacement", "preview"));
  expect(restored.layout.getLayout().regions.main.widgets.map((item) => item.resource?.id)).toEqual([
    "readme",
    "replacement",
  ]);
  await restored.navigation.openTarget(target("beta"));
  expect(restored.layout.getLayout().regions.main.widgets.map((item) => item.resource?.id)).toEqual(["beta-file"]);
  restored.pageLocations.dispose();
});

test("legacy restoration applies fixed panel declarations to its cached layout", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const first = harness(saved);
  await first.navigation.openTarget(target("alpha"));
  await first.navigation.openTarget(file("readme"));
  first.pageLocations.dispose();

  const restored = harness(saved, true);
  await restored.navigation.openTarget(target("alpha"));
  expect(restored.layout.getLayout().regions.main.widgets).toEqual([
    expect.objectContaining({
      viewId: "editor",
      closable: false,
      resource: { type: "workspace", id: "alpha" },
      placementIdentity: { kind: "page", pageId: "workspace", slotId: "files", instanceKey: "default" },
    }),
  ]);
  restored.pageLocations.dispose();
});

test("reload corrects a saved tab region that no longer allows the declaration", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const create = (restricted: boolean) => {
    const core = harness(saved);
    core.modePlacements.registerPlacement({
      id: "player",
      ref: { kind: "placement", extensionId: "test", id: "player" },
      modeId: "edit",
      region: "secondary",
      tabLocks: "legacy",
      movableTo: restricted ? ["secondary"] : ["secondary", "side"],
      item: { kind: "view", presence: "open", view: { kind: "view", id: "editor" } },
    });
    return core;
  };
  const first = create(false);
  await first.navigation.openTarget(target("alpha"));
  const tab = first.layout.getLayout().regions.secondary.widgets[0]!;
  first.movePanel(tab.widgetId, "side");
  await first.dispose();
  const restored = create(true);
  await restored.navigation.openTarget(target("alpha"));
  expect(restored.layout.getLayout().regions.secondary.widgets.map((t) => t.widgetId)).toContain(tab.widgetId);
  expect(restored.layout.getLayout().regions.side.widgets.map((t) => t.widgetId)).not.toContain(tab.widgetId);
  await restored.dispose();
});

test("reload relocates a tab from an unavailable panel without losing its binding", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const first = harness(saved);
  await first.navigation.openTarget(target("alpha"));
  const inspector = first.layout.getLayout().regions.side.widgets[0]!;
  await first.dispose();
  const restored = harness(saved, false, true);
  await restored.navigation.openTarget(target("alpha"));
  expect(restored.layout.getLayout().regions.side.widgets).toEqual([]);
  expect(restored.layout.getLayout().regions.main.widgets).toContainEqual(
    expect.objectContaining({ widgetId: inspector.widgetId, resource: inspector.resource }),
  );
  await restored.dispose();
});
