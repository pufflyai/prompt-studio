import { expect, test } from "bun:test";
import { createRegistry, registerPage } from "./page-registry-test-helpers";

test("page lists remain independent snapshots and follow registration changes", () => {
  const registry = createRegistry();
  const add = (id: string) => registerPage(registry, { id, modeId: "project", main: { kind: "panels" }, slots: [] });
  const zulu = add("zulu");
  add("alpha");
  const first = registry.listPages();
  expect(first.map((page) => page.id)).toEqual(["alpha", "zulu"]);
  first.reverse().pop();
  expect(registry.listPages().map((page) => page.id)).toEqual(["alpha", "zulu"]);
  zulu.dispose();
  add("middle");
  expect(registry.listPages().map((page) => page.id)).toEqual(["alpha", "middle"]);
  expect(registry.listPages().find((page) => page.id === "middle")).toBe(registry.getPage("middle"));
});
