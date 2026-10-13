import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";
import { registerResourcePage } from "./page-runtime-test-support";

const track = { kind: "page", extensionId: "test", id: "track" } as const;
const create = (saved: Map<string | undefined, WorkbenchLayout>) => {
  const w = createWorkbench({
    layoutPersistence: { getLayout: (s) => saved.get(s), setLayout: (l, s) => saved.set(s, l) },
  });
  w.modes.registerMode({ id: "edit", activate() {} });
  w.views.registerView({ id: "player", title: "Player", body: { kind: "react", render: () => null } });
  registerResourcePage(w, {
    id: "track",
    ref: track,
    modeId: "edit",
    path: "track",
    resource: { kinds: [{ kind: "resource-kind", id: "track" }] },
    main: { kind: "view", view: { kind: "view", id: "player" }, cardinality: "many" },
    slots: [],
  });
  w.pageLocations.setProject("project");
  return w;
};
const open = (w: ReturnType<typeof create>, id: string) =>
  w.navigation.openTarget({ kind: "page", page: track, resource: { type: "track", id }, open: "pin" });
const leave = (w: ReturnType<typeof create>) =>
  w.navigation.openTarget({ kind: "page", page: { ...track, id: "track-collection" } });

test("a many-resource page restores its pinned collection when returning and reloading", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const w = create(saved);
  await open(w, "alpha");
  const alpha = w.layout.getLayout().regions.main.widgets[0]!.widgetId;
  await open(w, "beta");
  expect(w.layout.getLayout().regions.main.widgets.find((p) => p.resource?.id === "alpha")!.widgetId).toBe(alpha);
  await leave(w);
  await open(w, "alpha");
  expect(w.layout.getLayout().regions.main.widgets.map((p) => p.resource?.id)).toEqual(["alpha", "beta"]);
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const restored = create(saved);
  await open(restored, "alpha");
  expect(restored.layout.getLayout().regions.main.widgets.map((p) => p.resource?.id)).toEqual(["alpha", "beta"]);
  await leave(restored);
  for (const [scope, layout] of saved)
    if (layout.regions.main.widgets.some((p) => p.resource?.id === "beta")) saved.delete(scope);
  await open(restored, "alpha");
  expect(restored.layout.getLayout().regions.main.widgets.map((p) => p.resource?.id)).toEqual(["alpha"]);
});
