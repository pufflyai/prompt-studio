import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout } from "../../registries/layout/layout-types";
import { migrateCollectionMain } from "./collection-main-migration";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";

const collection = {
  id: "collection",
  ref: pageRef("collection"),
  path: "collection",
  modeId: "alpha",
  main: { kind: "panels" },
  slots: [],
} as const;
const detail = {
  id: "detail",
  ref: pageRef("detail"),
  path: "detail",
  modeId: "alpha",
  parentId: "collection",
  main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
  resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
  slots: [],
} as const;
const oldScope = (id: string) => `workbench-main:${JSON.stringify(["project", "alpha", "detail", id])}`;

for (const enumerate of [false, true]) {
  test(`migration keeps the requested tray's order and state, enumeration=${enumerate}`, () => {
    const fixture = modePanelFixture(undefined, true, [collection, detail], "collection");
    fixture.navigate("detail", "a");
    fixture.open("tool", "main", "pin");
    const preferred = structuredClone(fixture.w.layout.getLayout());
    const tool = preferred.regions.main.widgets[1]!;
    preferred.regions.main.widgets = [
      { ...tool, tabRetention: "preview", pinned: false },
      preferred.regions.main.widgets[0]!,
    ];
    preferred.regions.main.activeWidgetId = tool.widgetId;
    const stale = structuredClone(preferred);
    stale.regions.main.widgets = [
      stale.regions.main.widgets[1]!,
      { ...tool, tabRetention: "persistent", pinned: true },
    ];
    const saved = new Map([
      [oldScope("a"), preferred],
      [oldScope("b"), stale],
    ]);
    migrateCollectionMain({
      context: { projectId: "project", modeId: "alpha", pageId: "collection" },
      page: collection,
      pages: [collection, detail],
      scope: "canonical",
      preferredScope: oldScope("a"),
      layouts: enumerate ? [...saved].map(([scope, layout]) => ({ scope, layout })) : [],
      read: (scope) => saved.get(scope),
      write: (layout, scope) => {
        saved.set(scope, layout);
        return true;
      },
      clear: (scope) => {
        saved.delete(scope);
      },
    });
    expect(saved.get("canonical")?.regions.main.widgets).toEqual(preferred.regions.main.widgets);
    expect(saved.get("canonical")?.regions.main.activeWidgetId).toBe(tool.widgetId);
    expect(saved.has(oldScope("a"))).toBe(false);
  });
}

test("a canonical empty tray consumes the known old route without enumeration", () => {
  const layout = createDefaultWorkbenchLayout();
  const fixture = modePanelFixture();
  const saved = new Map([
    ["canonical", layout],
    [oldScope("a"), fixture.w.layout.getLayout()],
  ]);
  migrateCollectionMain({
    context: { projectId: "project", modeId: "alpha", pageId: "collection" },
    page: collection,
    pages: [collection, detail],
    scope: "canonical",
    preferredScope: oldScope("a"),
    layouts: [],
    read: (scope) => saved.get(scope),
    write: () => {
      throw new Error("must keep the canonical snapshot");
    },
    clear: (scope) => {
      saved.delete(scope);
    },
  });
  expect(saved.get("canonical")).toBe(layout);
  expect(saved.has(oldScope("a"))).toBe(false);
});
