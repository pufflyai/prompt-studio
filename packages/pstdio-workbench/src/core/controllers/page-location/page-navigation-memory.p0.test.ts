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
