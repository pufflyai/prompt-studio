import { expect, test } from "bun:test";
import { createPageLocationHarness, pageRef } from "./page-location-controller.test-support";

const ref = pageRef("acme", "board");
const createHarness = (url?: string) => {
  const harness = createPageLocationHarness(url);
  harness.registry.registerPage({
    ...harness.registry.getPage("tickets")!,
    id: "board",
    ref,
    path: "board",
    params: { range: { type: "string", default: "now-1h" }, refresh: { type: "number", default: 30 } },
  });
  harness.controller.boot("p1");
  return harness;
};

test("page params push for navigation and replace for updates without forking page state", () => {
  const h = createHarness();
  h.controller.navigate({ kind: "page", page: ref, params: { range: "now-6h" } });
  const before = h.registry.store.getState();
  h.controller.navigate({ kind: "page", page: ref, params: { range: "now-7d" } });
  expect(h.browser.pushes).toHaveLength(2);
  expect(h.registry.store.getState().pageStates).toEqual(before.pageStates);
  expect(h.registry.store.getState().placements).toEqual(before.placements);
  h.browser.pop(h.browser.pushes[0]!);
  expect(h.registry.store.getState().location?.params).toEqual({ range: "now-6h" });
  h.controller.updateParams({ range: "now-24h", refresh: 60 });
  expect(h.browser.pushes).toHaveLength(2);
  expect(h.browser.current().url).toContain("range=now-24h&refresh=60");
  h.controller.updateParams({ refresh: null });
  expect(h.registry.store.getState().location?.params).toEqual({ range: "now-24h" });
  expect(h.persistence.values.get("p1")?.location.params).toEqual({ range: "now-24h" });
});

test("invalid param navigation and patches leave the location and history untouched", () => {
  const h = createHarness();
  h.controller.navigate({ kind: "page", page: ref });
  const before = h.registry.store.getState();
  const url = h.browser.current();
  expect(h.controller.navigate({ kind: "page", page: ref, params: { unknown: "a" } }).ok).toBe(false);
  expect(() => h.controller.updateParams({ refresh: "bad" })).toThrow("page_param_invalid");
  expect(h.registry.store.getState()).toBe(before);
  expect(h.browser.current()).toEqual(url);
});

test("page URL params override history params while keeping contextual parents", () => {
  const h = createHarness("/projects/p1/extensions/acme/board?range=now-6h&refresh=bad&unknown=1");
  expect(h.registry.store.getState().location?.params).toEqual({ range: "now-6h" });
  h.controller.navigate({ kind: "page", page: ref, params: { range: "now-7d" } });
  const entry = h.browser.current();
  h.browser.pop({ ...entry, url: entry.url.replace("now-7d", "now-12h") });
  expect(h.registry.store.getState().location?.params).toEqual({ range: "now-12h" });
  expect(h.registry.store.getState().location?.parent).toEqual({ page: pageRef("pstdio", "start") });
  h.controller.switchProject("p2");
  h.controller.switchProject("p1");
  expect(h.registry.store.getState().location?.params).toEqual({ range: "now-12h" });
});

test("contextual parents restore their own params", () => {
  const h = createHarness();
  const child = pageRef("acme", "details");
  h.registry.registerPage({ ...h.registry.getPage("board")!, id: "details", ref: child, path: "details" });
  h.controller.navigate({
    kind: "page",
    page: child,
    params: { range: "now-7d" },
    parent: { kind: "page", page: ref, params: { range: "now-6h" } },
  });
  h.controller.navigateToParent();
  expect(h.registry.store.getState().location?.page).toEqual(ref);
  expect(h.registry.store.getState().location?.params).toEqual({ range: "now-6h" });
});
