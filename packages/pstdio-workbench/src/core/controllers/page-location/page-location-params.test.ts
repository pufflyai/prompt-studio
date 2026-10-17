import { expect, test } from "bun:test";
import { resolvePageParams } from "pstdio-api-contracts";
import { createWorkbenchPageBreadcrumbItems } from "./page-breadcrumbs";
import { createPageLocationHarness, pageRef } from "./page-location-controller.test-support";

const ref = pageRef("acme", "board");
const createHarness = (url?: string) => {
  const harness = createPageLocationHarness(url);
  harness.registry.registerPage({
    ...harness.registry.getPage("tickets")!,
    id: "board",
    title: "Board",
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

test("closing auxiliary and inactive primary panels preserves current page params", () => {
  const h = createHarness();
  const board = h.registry.getPage("board")!;
  h.registry.registerPage({
    ...board,
    id: "closable",
    ref: pageRef("acme", "closable"),
    path: "closable",
    slots: [
      { id: "rows", region: "side", item: { kind: "view", view: { kind: "view", id: "rows" }, presence: "open" } },
    ],
  });
  h.controller.navigate({ kind: "page", page: pageRef("acme", "closable"), params: { range: "now-6h" } });
  const side = h.registry.store
    .getState()
    .placements.find((p) => p.identity.kind === "page" && p.identity.slotId === "rows")!;
  const url = h.browser.current().url;
  expect(h.controller.closePlacement(side.identity).ok).toBe(true);
  expect(h.registry.store.getState().location?.params).toEqual({ range: "now-6h" });
  expect(resolvePageParams(board.params, h.registry.store.getState().location?.params).range).toBe("now-6h");
  expect(h.persistence.values.get("p1")?.location.params).toEqual({ range: "now-6h" });
  expect(h.browser.current().url).toBe(url);

  const resourceRef = pageRef("acme", "resource-board");
  h.registry.registerPage({
    ...h.registry.getPage("ticket")!,
    id: "resource-board",
    ref: resourceRef,
    path: "resource-board",
    params: board.params,
  });
  for (const [id, range] of [
    ["PS-1", "now-6h"],
    ["PS-2", "now-24h"],
  ]) {
    h.controller.navigate({
      kind: "page",
      page: resourceRef,
      resource: { type: "ticket", id: id! },
      open: "pin",
      params: { range: range! },
    });
  }
  const resourceUrl = h.browser.current().url;
  expect(
    h.controller.closePlacement({
      kind: "page",
      pageId: "resource-board",
      slotId: "$main",
      instanceKey: "pstdio://ticket/PS-1",
    }).ok,
  ).toBe(true);
  expect(h.registry.store.getState().location?.resource?.id).toBe("PS-2");
  expect(h.registry.store.getState().location?.params).toEqual({ range: "now-24h" });
  expect(h.persistence.values.get("p1")?.location.params).toEqual({ range: "now-24h" });
  expect(h.browser.current().url).toBe(resourceUrl);
});

test("breadcrumb clicks restore parent params and preserve every ancestor", () => {
  const h = createHarness();
  const middle = pageRef("acme", "middle");
  const child = pageRef("acme", "details");
  for (const page of [middle, child])
    h.registry.registerPage({ ...h.registry.getPage("board")!, id: page.id, title: page.id, ref: page, path: page.id });
  h.controller.navigate({
    kind: "page",
    page: child,
    params: { range: "now-7d" },
    parent: {
      kind: "page",
      page: middle,
      params: { range: "now-12h" },
      parent: { kind: "page", page: ref, params: { range: "now-6h" } },
    },
  });
  const crumbs = createWorkbenchPageBreadcrumbItems({
    location: h.registry.store.getState().location!,
    pages: Object.values(h.registry.store.getState().pages),
    navigationTrees: h.navigationTrees,
    modes: { getMode: () => undefined },
    resources: { normalize: (r) => r, toUri: (r) => `${r.type}:${r.id}`, fromUri: () => undefined },
    navigate: (target) => {
      h.controller.navigate(target);
    },
  });
  crumbs.find((crumb) => crumb.title === "middle")!.onClick!();
  expect(h.registry.store.getState().location?.params).toEqual({ range: "now-12h" });
  expect(h.registry.store.getState().location?.parent?.params).toEqual({ range: "now-6h" });
  expect(h.browser.current().url).toContain("range=now-12h");
  crumbs.find((crumb) => crumb.title === "Board")!.onClick!();
  expect(h.registry.store.getState().location?.params).toEqual({ range: "now-6h" });
  expect(h.browser.current().url).toContain("range=now-6h");
});

test("removing a contextual parent preserves the active page params", () => {
  const h = createHarness();
  const parentRef = pageRef("other", "temporary-parent");
  const parent = h.registry.registerPage({
    ...h.registry.getPage("board")!,
    id: "temporary-parent",
    ref: parentRef,
    path: "temporary-parent",
  });
  h.controller.navigate({
    kind: "page",
    page: ref,
    params: { range: "now-6h" },
    parent: { kind: "page", page: parentRef },
  });
  parent.dispose();
  expect(h.registry.store.getState().location?.params).toEqual({ range: "now-6h" });
  expect(h.persistence.values.get("p1")?.location.params).toEqual({ range: "now-6h" });
  expect(h.browser.current().url).toContain("range=now-6h");
});
