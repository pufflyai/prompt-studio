import { expect, test } from "bun:test";
import type { PageLocation } from "@pstdio/sdk/extensions";
import { defaultPageResourceCodec } from "pstdio-api-contracts";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import { createPageNavigationMemory } from "./page-navigation-memory";

const ref = (id: string) => ({ kind: "page" as const, extensionId: "example", id });
const reader = (id: string): WorkbenchPageContribution => ({
  id,
  ref: ref(id),
  path: id,
  modeId: "project",
  resource: { kinds: [{ kind: "resource-kind", id: "record" }] },
  main: { kind: "view", view: { kind: "view", id: "reader" }, cardinality: "one", presentation: "page" },
  slots: [],
});
const pages = [reader("reader"), { ...reader("workspace"), main: { kind: "panels" as const } }];
const workspace = (id: string): PageLocation => ({ page: ref("workspace"), resource: { type: "workspace", id } });
const document = (id: string, parent: PageLocation): PageLocation => ({
  page: ref("reader"),
  resource: { type: "record", id },
  parent,
});
const fixture = () => {
  const memory = createPageNavigationMemory({ pages: () => pages, resources: defaultPageResourceCodec });
  memory.load("project");
  return memory;
};

test("remembered locations separate complete ancestor resource contexts", () => {
  const memory = fixture();
  const a = document("x", workspace("a"));
  const b = document("y", workspace("b"));
  memory.remember(a);
  memory.remember(b);
  expect(memory.find({ page: ref("reader"), parent: workspace("a") })).toBe(a);
  expect(memory.find({ page: ref("reader"), parent: workspace("b") })).toBe(b);
  expect(memory.find(workspace("a"))).toBe(a);
  expect(memory.find(workspace("b"))).toBe(b);
});

test("consuming a skipped location retires each remembered entry pointing at that exact context", () => {
  const memory = fixture();
  const a = document("x", workspace("a"));
  const b = document("x", workspace("b"));
  memory.remember(a);
  memory.remember(b);
  memory.consume(a);
  expect(memory.find(workspace("a"))).toBeUndefined();
  expect(memory.find(workspace("b"))).toBe(b);
});

test("memory loads before page registration and still resolves after contributions arrive", () => {
  const first = fixture();
  const location = document("x", workspace("a"));
  const saved = first.remember(location);
  let declarations: WorkbenchPageContribution[] = [];
  const next = createPageNavigationMemory({ pages: () => declarations, resources: defaultPageResourceCodec });
  next.load("project", saved);
  declarations = pages;
  expect(next.find(workspace("a"))).toEqual(location);
});

test("deletion removes remembered resource and ancestor references without reserving a viewer", () => {
  const memory = fixture();
  const a = document("x", workspace("a"));
  const b = document("y", workspace("b"));
  memory.remember(a);
  memory.remember(b);
  memory.forgetResource({ type: "workspace", id: "a" });
  expect(memory.find(workspace("a"))).toBeUndefined();
  expect(memory.find(workspace("b"))).toBe(b);
  memory.load("another-project");
  expect(memory.find(workspace("b"))).toBeUndefined();
});

test("an archive snapshot resolves saved navigation references once across unrelated removals", () => {
  let historyReads = 0;
  const resources = {
    ...defaultPageResourceCodec,
    toUri(resource: Parameters<typeof defaultPageResourceCodec.toUri>[0]) {
      if (resource.type === "record") historyReads++;
      return defaultPageResourceCodec.toUri(resource);
    },
  };
  const memory = createPageNavigationMemory({ pages: () => pages, resources });
  const parent = workspace("work");
  const location = document("remembered", parent);
  memory.load("project", [{ ...parent, location, modeId: "project" }]);
  for (let i = 0; i < 50; i++) memory.forgetResource({ type: "session", id: String(i) });
  expect(historyReads).toBeLessThanOrEqual(1);
  expect(memory.find(parent)).toBe(location);
  memory.forgetResource(location.resource!);
  expect(memory.find(parent)).toBeUndefined();
  memory.remember(location);
  memory.forgetResource(parent.resource!);
  expect(memory.find(parent)).toBeUndefined();
});

test("consecutive matching removals retire shared ancestors without reindexing surviving locations", () => {
  const visits: string[] = [];
  const resources = {
    ...defaultPageResourceCodec,
    toUri(resource: Parameters<typeof defaultPageResourceCodec.toUri>[0]) {
      visits.push(resource.id);
      return defaultPageResourceCodec.toUri(resource);
    },
  };
  const memory = createPageNavigationMemory({ pages: () => pages, resources });
  const shared = workspace("shared");
  const first = document("first", shared);
  const second = document("second", shared);
  const third = document("third", workspace("third-parent"));
  const keep = document("keep", workspace("keep-parent"));
  const saved = [first, keep, second, third].map((location) => ({ ...location.parent!, modeId: "project", location }));
  memory.load("project", saved);
  expect(memory.forgetResource(shared.resource!)).toBe(true);
  expect(visits).toContain("keep-parent");
  visits.length = 0;
  expect(memory.forgetResource(third.resource!)).toBe(true);
  expect(visits).not.toContain("keep-parent");
  expect(memory.forgetResource(first.resource!)).toBe(false);
  expect(memory.find(shared)).toBeUndefined();
  expect(memory.find(third.parent!)).toBeUndefined();

  const next = document("new", workspace("new-parent"));
  const remembered = memory.remember(next);
  expect(remembered.map((entry) => entry.location)).toEqual([keep, next, next]);
  memory.consume(next);
  expect(memory.forgetResource(next.resource!)).toBe(false);
  expect(memory.forgetResource(keep.resource!)).toBe(true);
  memory.load("other", saved);
  expect(memory.forgetResource(second.resource!)).toBe(true);
  expect(memory.find(keep.parent!)).toBe(keep);
  expect(remembered.map((entry) => entry.location)).toEqual([keep, next, next]);
});
