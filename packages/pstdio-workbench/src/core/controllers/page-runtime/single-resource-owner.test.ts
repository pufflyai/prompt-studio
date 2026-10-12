import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import type { WorkbenchPageSlot } from "../../registries/pages/page-registry";
import { createWorkbench } from "../../workbench-core";
import { registerResourcePage } from "./page-runtime-test-support";

const create = (saved = new Map<string | undefined, WorkbenchLayout>(), slots: readonly WorkbenchPageSlot[] = []) => {
  const w = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, layout),
    },
  });
  w.modes.registerMode({ id: "edit", activate() {} });
  w.views.registerView({ id: "player", title: "Player", body: { kind: "react", render: () => null } });
  registerResourcePage(w, {
    id: "track",
    ref: { kind: "page", extensionId: "test", id: "track" },
    modeId: "edit",
    path: "track",
    resource: { kinds: [{ kind: "resource-kind", id: "track" }] },
    main: { kind: "view", view: { kind: "view", id: "player" }, cardinality: "one" },
    slots,
  });
  w.pageLocations.setProject("project");
  return w;
};

const open = (w: ReturnType<typeof create>, id: string) =>
  w.navigation.openTarget({
    kind: "page",
    page: { kind: "page", extensionId: "test", id: "track" },
    resource: { type: "track", id },
  });

test("a single-resource page rebinds its existing widget until that widget transfers to another owner", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const w = create(saved);
  await open(w, "alpha");
  const original = w.layout.getLayout().regions.main.widgets[0]!;
  await open(w, "beta");
  expect(w.layout.getLayout().regions.main.widgets[0]?.widgetId).toBe(original.widgetId);
  expect(w.layout.getLayout().regions.main.widgets[0]?.resource?.id).toBe("beta");
  w.movePanel(original.widgetId, "side");
  await open(w, "alpha");
  const replacement = w.layout.getLayout().regions.main.widgets[0]!;
  expect(replacement.widgetId).not.toBe(original.widgetId);
  expect(replacement.resource?.id).toBe("alpha");
  expect(w.layout.getLayout().regions.side.widgets[0]?.widgetId).toBe(original.widgetId);
  expect(w.layout.getLayout().regions.side.widgets[0]?.resource?.id).toBe("beta");
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const restored = create(saved);
  await open(restored, "alpha");
  expect(restored.layout.getLayout().regions.main.widgets[0]?.widgetId).toBe(replacement.widgetId);
  expect(restored.layout.getLayout().regions.side.widgets[0]?.widgetId).toBe(original.widgetId);
});

test("an inactive page cannot restore a widget transferred into another page instance", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const w = create(saved);
  await open(w, "alpha");
  const original = w.layout.getLayout().regions.main.widgets[0]!.widgetId;
  await open(w, "beta");
  w.movePanel(original, "side");
  await open(w, "gamma");
  w.movePanel(original, "main");
  await open(w, "alpha");
  expect(w.layout.getLayout().regions.main.widgets[0]?.widgetId).not.toBe(original);
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const restored = create(saved);
  await open(restored, "alpha");
  expect(restored.layout.getLayout().regions.main.widgets[0]?.widgetId).not.toBe(original);
  await open(restored, "gamma");
  expect(restored.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === original)?.resource?.id).toBe(
    "beta",
  );
});

test("an inactive owner keeps its selected single-resource sub-panel when its widget identity is retired", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const w = create(saved, [
    {
      id: "inspector",
      region: "main",
      openOn: "page-resource",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "track" }],
          view: { kind: "view", id: "player" },
          cardinality: "one",
        },
      },
    },
  ]);
  await open(w, "alpha");
  const inspector = w.layout.getLayout().regions.main.widgets.find((p) => p.role === "sub-panel")!;
  w.layout.activateWidget(inspector.widgetId);
  await open(w, "beta");
  const cached = [...saved.values()].find((layout) =>
    layout.regions.main.widgets.some((p) => p.resource?.id === "alpha" && p.role === "sub-panel"),
  )!;
  const cachedInspector = cached.regions.main.widgets.find((p) => p.role === "sub-panel")!;
  expect(
    Object.values(cached.locationSubPanelSelections ?? {}).some(
      (selection) => selection.main === cachedInspector.widgetId,
    ),
  ).toBe(true);
});

test("single-resource page instances restore their own optional tab choices while the main view rebinds", async () => {
  const w = create(new Map(), [
    { id: "tools", region: "bottom", item: { kind: "view", view: { kind: "view", id: "player" }, presence: "open" } },
  ]);
  await open(w, "alpha");
  const main = w.layout.getLayout().regions.main.widgets[0]!.widgetId;
  w.closePlacement(w.layout.getLayout().regions.bottom.widgets[0]!.placementIdentity!);
  await open(w, "beta");
  expect(w.layout.getLayout().regions.bottom.widgets).toHaveLength(1);
  expect(w.layout.getLayout().regions.main.widgets[0]!.widgetId).toBe(main);
  await open(w, "alpha");
  expect(w.layout.getLayout().regions.bottom.widgets).toHaveLength(0);
  expect(w.layout.getLayout().regions.main.widgets[0]!.widgetId).toBe(main);
});
