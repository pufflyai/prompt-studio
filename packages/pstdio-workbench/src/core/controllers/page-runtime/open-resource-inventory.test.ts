import { expect, test } from "bun:test";
import { createLocalStorageLayoutPersistence } from "../../../storage/local-storage-layout-persistence";
import { createDefaultWorkbenchLayout, type WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbenchLayoutCache } from "./workbench-layout-cache";

const empty = createDefaultWorkbenchLayout();
const sessionLayout = (id: string): WorkbenchLayout => ({
  ...empty,
  regions: {
    ...empty.regions,
    main: {
      ...empty.regions.main,
      widgets: [{ widgetId: id, contributionId: "session", viewId: "chat", resource: { type: "session", id } }],
    },
  },
});

test("ten thousand saved sessions share one restored inventory across consumers", () => {
  const saved = new Map(Array.from({ length: 10_000 }, (_, i) => [`session-${i}`, sessionLayout(`session-${i}`)]));
  let enumerations = 0;
  const cache = createWorkbenchLayoutCache({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope ?? ""),
      setLayout: (layout, scope) => {
        saved.set(scope ?? "", layout);
      },
      listLayouts: () => {
        enumerations++;
        return [...saved].map(([scope, layout]) => ({ scope, layout }));
      },
    },
  });
  const placements = cache.listPlacements(empty);
  const resources = cache.listResources(empty);
  expect(placements).toHaveLength(10_000);
  expect(resources).toHaveLength(10_000);
  const ids = cache.placementIds(empty);
  for (let i = 0; i < 5; i++) {
    expect(cache.listPlacements(empty)).toBe(placements);
    expect(cache.listResources(empty)).toBe(resources);
    expect(cache.placementIds(empty)).toBe(ids);
    expect(ids.has("session-9999")).toBe(true);
  }
  expect(enumerations).toBe(1);
  cache.layout.setLayout(empty, "session-5000");
  expect(cache.listPlacements(empty)).toHaveLength(9_999);
  expect(cache.listResources(empty).some((resource) => resource.id === "session-5000")).toBe(false);
  expect(enumerations).toBe(1);
});

test("current inputs override saved owners and saved updates become visible when navigating away", () => {
  const saved = new Map([["first", sessionLayout("shared")]]);
  const cache = createWorkbenchLayoutCache({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope ?? ""),
      setLayout: (layout, scope) => {
        saved.set(scope ?? "", layout);
      },
      listLayouts: () => [...saved].map(([scope, layout]) => ({ scope, layout })),
    },
  });
  const live = sessionLayout("shared");
  live.regions.main.widgets[0].title = "Live";
  const ids = cache.placementIds(live);
  expect(cache.listPlacements(live)[0].title).toBe("Live");
  const updated = sessionLayout("shared");
  updated.regions.main.widgets[0].title = "Saved update";
  cache.layout.setLayout(updated, "second");
  expect(cache.listPlacements(live)[0].title).toBe("Live");
  expect(cache.listPlacements(empty)[0].title).toBe("Saved update");
  expect(cache.placementIds(empty)).toBe(ids);
});

test("closing one saved owner preserves a placement still open in another owner", () => {
  const saved = new Map([
    ["first", sessionLayout("shared")],
    ["second", sessionLayout("shared")],
  ]);
  const cache = createWorkbenchLayoutCache({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope ?? ""),
      setLayout: (layout, scope) => {
        saved.set(scope ?? "", layout);
      },
      listLayouts: () => [...saved].map(([scope, layout]) => ({ scope, layout })),
    },
  });
  expect(cache.listPlacements(empty)).toHaveLength(1);
  cache.layout.setLayout(empty, "first");
  expect(cache.listPlacements(empty)).toHaveLength(1);
  cache.layout.setLayout(empty, "second");
  expect(cache.listPlacements(empty)).toHaveLength(0);
});

test("the inventory follows adapter writes and transforms after restoration", () => {
  const values = new Map<string, string>();
  const storage = {
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const persistence = createLocalStorageLayoutPersistence({ namespace: "inventory", storage, debounceMs: 0 });
  persistence.setLayout(sessionLayout("before"), "project/one");
  const cache = createWorkbenchLayoutCache({ layoutPersistence: persistence });
  try {
    expect(cache.listResources(empty).map((resource) => resource.id)).toEqual(["before"]);
    persistence.setLayout(sessionLayout("after"), "project/one");
    expect(cache.listResources(empty).map((resource) => resource.id)).toEqual(["after"]);
    persistence.transformLayouts?.("one", () => empty);
    expect(cache.listResources(empty)).toEqual([]);
  } finally {
    cache.layout.dispose?.();
  }
});
