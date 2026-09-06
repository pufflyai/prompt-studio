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
const harness = (saved: Map<string | undefined, WorkbenchLayout>) => {
  const workbench = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, layout),
    },
    resolvePagePersistenceScope: ({ projectId, resource }) => ({ scope: `${projectId}/${resource?.id ?? "home"}` }),
  });
  workbench.modes.registerMode({ id: "edit", activate() {} });
  for (const id of ["empty", "editor", "inspector"])
    workbench.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
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
        item: {
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
