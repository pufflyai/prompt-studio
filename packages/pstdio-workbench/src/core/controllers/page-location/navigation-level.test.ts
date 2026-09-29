import { describe, expect, test } from "bun:test";
import type { PageLocation } from "@pstdio/sdk/extensions";
import { createNavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import { resolveNavigationLevels } from "./navigation-level";
import { createPageLocationHarness, startRef, ticketRef, ticketsRef } from "./page-location-controller.test-support";

const setup = () => {
  const { registry } = createPageLocationHarness();
  const navigationTrees = createNavigationTreeRegistry();
  const own = (id: string, slot: "content" | "header" = "content") =>
    navigationTrees.registerContribution({
      id: `${id}.${slot}`,
      owner: { kind: "page", id, extensionId: "acme.planner" },
      sourceExtensionId: "acme.planner",
      declarationIndex: 0,
      slot,
      getSections: () => [],
    });
  const resolve = (location?: PageLocation) =>
    resolveNavigationLevels({ location, pages: registry.listPages(), navigationTrees });
  return { own, resolve };
};
describe("sidenav levels", () => {
  test("keeps main navigation for pages without content contributions", () => {
    const { own, resolve } = setup();
    own("tickets", "header");
    expect(resolve()).toEqual([]);
    expect(resolve({ page: ticketsRef })).toEqual([]);
  });
  test("resolves the owner that the location or a parent location opens", () => {
    const { own, resolve } = setup();
    own("ticket");
    const location = { page: ticketRef, parent: { page: ticketsRef } };
    expect(resolve(location)).toMatchObject([{ owner: { id: "ticket" }, location }]);
    expect(resolve({ page: startRef, parent: location })).toMatchObject([{ owner: { id: "ticket" }, location }]);
  });
  test("lists nested levels from the outermost to the innermost", () => {
    const { own, resolve } = setup();
    own("tickets");
    own("ticket");
    const parent = { page: ticketsRef, resource: { type: "ticket", id: "parent", label: "Parent ticket" } };
    const nested = { page: ticketRef, parent };
    expect(resolve(nested).map((level) => [level.owner.id, level.location])).toEqual([
      ["tickets", parent],
      ["ticket", nested],
    ]);
  });
});
