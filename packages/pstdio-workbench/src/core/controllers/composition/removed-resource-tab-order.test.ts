import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";

const page = { kind: "page", extensionId: "test", id: "workspace" } as const;
const panel = { kind: "placement", extensionId: "test", id: "sessions" } as const;
const file = (id: string) => ({ type: "file", id });
const location = (id: string) => ({ kind: "page" as const, page, resource: { type: "workspace", id } });
const setup = (saved: Map<string | undefined, WorkbenchLayout>) => {
  const core = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, layout),
      listScopes: (project) =>
        [...saved.keys()].filter((scope): scope is string => !!scope?.startsWith(`project/${project}/`)),
    },
  });
  core.modes.registerMode({ id: "edit", activate() {} });
  core.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  core.pages.registerPage({
    id: "workspace",
    ref: page,
    path: "workspace",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "editor" } },
    slots: [
      {
        id: "files",
        region: "side",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "file" }],
            view: { kind: "view", id: "editor" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  core.modePlacements.registerPlacement({
    id: "sessions",
    ref: panel,
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
  core.pageLocations.setProject("project");
  return core;
};

const order = (core: ReturnType<typeof createWorkbench>) =>
  core.layout.getLayout().regions.side.widgets.map((tab) => tab.resource?.id);

test("removing an inactive page tab preserves shared tab order through cache restore and reload", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const core = setup(saved);
  try {
    await core.navigation.openTarget(location("alpha"));
    for (const id of ["remove", "keep"])
      await core.navigation.openTarget({
        kind: "panel",
        panel: { kind: "page-slot", page, id: "files" },
        resource: file(id),
        open: "pin",
      });
    await core.navigation.openTarget({ kind: "panel", panel, resource: file("session"), open: "pin" });
    const tabs = core.layout.getLayout().regions.side.widgets;
    core.layout.reorderPanel(tabs.find((tab) => tab.resource?.id === "session")!.widgetId, {
      beforeWidgetId: tabs.find((tab) => tab.resource?.id === "keep")!.widgetId,
    });
    expect(order(core)).toEqual(["remove", "session", "keep"]);
    await core.navigation.openTarget(location("beta"));
    core.resources.removed(file("remove"));
    await core.navigation.openTarget(location("alpha"));
    expect(order(core)).toEqual(["session", "keep"]);
    const restored = setup(saved);
    try {
      await restored.navigation.openTarget(location("alpha"));
      expect(order(restored)).toEqual(["session", "keep"]);
    } finally {
      await restored.dispose();
    }
  } finally {
    await core.dispose();
  }
});
