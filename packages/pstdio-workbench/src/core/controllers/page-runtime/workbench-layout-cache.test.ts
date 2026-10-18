import { expect, test } from "bun:test";
import { createLocalStorageLayoutPersistence } from "../../../storage/local-storage-layout-persistence";
import { createDefaultWorkbenchLayout } from "../../registries/layout/layout-types";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import { createWorkbenchLayoutCache } from "./workbench-layout-cache";

const fixture = (scope: string | undefined, capturedRoute = false, projectId?: string) => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const page: WorkbenchPageContribution = {
    id: "documents",
    ref: { kind: "page", id: "documents" },
    path: "documents",
    modeId: "alpha",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    document: { metadataKey: "file" },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  };
  const resource = { type: "document", id: "one", metadata: { file: "a.md" }, ...(projectId ? { projectId } : {}) };
  const layout = createDefaultWorkbenchLayout();
  layout.regions.main.widgets = [
    {
      widgetId: "foreign-pin",
      contributionId: "editor",
      pinned: true,
      tabRetention: "persistent",
      resource: { type: "note", id: "foreign" },
      placementIdentity: { kind: "page", pageId: "notes", slotId: "$main", instanceKey: "foreign" },
    },
    {
      widgetId: "document-a",
      contributionId: "editor",
      pinned: true,
      tabRetention: "persistent",
      resource,
      placementIdentity: { kind: "page", pageId: page.id, slotId: "$main", instanceKey: "one" },
    },
  ];
  layout.regions.main.activeWidgetId = "foreign-pin";
  layout.activeWidgetId = "foreign-pin";
  layout.activeLocationWidgetId = capturedRoute ? undefined : "document-a";
  values.set("upgrade:layout:" + (scope ?? "global"), JSON.stringify({ version: 5, layout }));
  const persistence = createLocalStorageLayoutPersistence({ namespace: "upgrade", storage, debounceMs: 0 });
  const create = (location = capturedRoute ? { page: page.ref, resource } : undefined) =>
    createWorkbenchLayoutCache(
      {
        layoutPersistence: persistence,
        resolvePagePersistenceScope: () => ({ scope }),
        ...(location
          ? {
              pageLocationPersistence: { load: () => ({ location }), save() {} },
            }
          : {}),
      },
      () => undefined,
      () => undefined,
      () => [page],
    );

  const context = { projectId: projectId ?? "project", modeId: "alpha", pageId: page.id, resource };
  return { create, context, page, persistence, scope };
};

test("accepted version-5 Main preserves its entire tray, order and selection after migration and reload", () => {
  const s = fixture("old/documents/one");
  const cache = s.create();
  const restored = cache.loadPageLayout(s.context, s.page)!;
  expect(restored.regions.main.widgets.map((tab) => tab.widgetId)).toEqual(["foreign-pin", "document-a"]);
  expect(restored.regions.main.activeWidgetId).toBe("foreign-pin");
  expect(restored.activeWidgetId).toBe("foreign-pin");
  expect(restored.activeLocationWidgetId).toBe("document-a");
  expect(s.persistence.getLayout(s.scope)?.regions.main.widgets).toEqual([]);
  expect(s.create().loadPageLayout(s.context, s.page)?.regions.main).toEqual(restored.regions.main);
  s.persistence.dispose?.();
});

test("a collection without a primary placement migrates under its captured document route", () => {
  const s = fixture("old/documents/one", true);
  const cache = s.create();
  const other = { ...s.context, resource: { ...s.context.resource, metadata: { file: "b.md" } } };
  expect(cache.loadPageLayout(other, s.page)?.regions.main.widgets).toEqual([]);
  expect(cache.loadPageLayout(s.context, s.page)?.regions.main.widgets.map((tab) => tab.widgetId)).toEqual([
    "foreign-pin",
    "document-a",
  ]);
  s.persistence.dispose?.();
});

test("unscoped legacy Main keeps its captured primary project when another project opens first", () => {
  const s = fixture(undefined, false, "project-a");
  const other = { ...s.context, projectId: "project-b", resource: { ...s.context.resource, projectId: "project-b" } };
  expect(s.create().loadPageLayout(other, s.page)?.regions.main.widgets).toEqual([]);
  expect(
    s
      .create()
      .loadPageLayout(s.context, s.page)
      ?.regions.main.widgets.map((tab) => tab.widgetId),
  ).toEqual(["foreign-pin", "document-a"]);
  s.persistence.dispose?.();
});

test("another project's saved route cannot claim a legacy tray captured in a shared adapter", () => {
  const s = fixture(undefined, false, "project-a");
  const other = { ...s.context, projectId: "project-b", resource: { ...s.context.resource, projectId: "project-b" } };
  const cache = s.create({ page: s.page.ref, resource: other.resource });
  expect(cache.loadPageLayout(other, s.page)?.regions.main.widgets).toEqual([]);
  expect(
    s
      .create()
      .loadPageLayout(s.context, s.page)
      ?.regions.main.widgets.map((tab) => tab.widgetId),
  ).toEqual(["foreign-pin", "document-a"]);
  s.persistence.dispose?.();
});

test("a saved empty Main entry wins over an older version-5 tray", () => {
  const s = fixture("old/documents/one");
  const cache = s.create();
  cache.savePageMain(s.context, createDefaultWorkbenchLayout(), s.page);
  expect(cache.loadPageLayout(s.context, s.page)?.regions.main.widgets).toEqual([]);
  expect(s.create().loadPageLayout(s.context, s.page)?.regions.main.widgets).toEqual([]);
  s.persistence.dispose?.();
});

test.each([
  "old/documents/one",
  undefined,
])("visiting another document first migrates the old tray to its captured owner in scope %s", (scope) => {
  const s = fixture(scope);
  const cache = s.create();
  const other = { ...s.context, resource: { ...s.context.resource, metadata: { file: "b.md" } } };
  expect(cache.loadPageLayout(other, s.page)?.regions.main.widgets).toEqual([]);
  cache.savePageMain(other, createDefaultWorkbenchLayout(), s.page);
  const restored = s.create().loadPageLayout(s.context, s.page);
  expect(restored?.regions.main.widgets.map((tab) => tab.widgetId)).toEqual(["foreign-pin", "document-a"]);
  expect(restored?.regions.main.activeWidgetId).toBe("foreign-pin");
  s.persistence.dispose?.();
});
