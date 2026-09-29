import { describe, expect, test } from "bun:test";
import type { PageLocation } from "@pstdio/sdk/extensions";
import { createNavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import { createNavigationBackNode, resolveNavigationLevel } from "./navigation-level";
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
    resolveNavigationLevel({
      location,
      pages: registry.listPages(),
      navigationTrees,
      mode: { id: "project", label: "Project" },
    });
  return { own, resolve };
};
describe("sidenav levels", () => {
  test("keeps main navigation for pages without content contributions", () => {
    const { own, resolve } = setup();
    own("tickets", "header");
    expect(resolve()).toBeUndefined();
    expect(resolve({ page: ticketsRef })).toBeUndefined();
  });
  test("resolves a direct owner and its declared parent fallback", () => {
    const { own, resolve } = setup();
    own("ticket");
    const location = { page: ticketRef, parent: { page: ticketsRef } };
    expect(resolve(location)).toMatchObject({
      owner: { id: "ticket" },
      location,
      parent: { key: "project", label: "Project", fallback: { kind: "page", page: ticketsRef } },
    });
    expect(resolve({ page: ticketRef })?.parent.fallback.page.id).toBe(startRef.id);
  });
  test("inherits enclosing levels and resolves nested owners with breadcrumb titles", () => {
    const { own, resolve } = setup();
    own("tickets");
    own("ticket");
    const parent = { page: ticketsRef, resource: { type: "ticket", id: "parent", label: "Parent ticket" } };
    const nested = { page: ticketRef, parent };
    const level = resolve({ page: startRef, parent: nested });
    expect(level?.location).toEqual(nested);
    expect(level?.parent).toMatchObject({ key: "tickets", label: "Parent ticket" });
    expect(resolve({ page: ticketRef, parent: { page: ticketsRef } })?.parent.label).toBe("Tickets");
  });
  test("Back stays fixed and uses parent memory before the fallback", () => {
    const { own, resolve } = setup();
    own("ticket");
    const level = resolve({ page: ticketRef, parent: { page: ticketsRef } })!;
    expect(createNavigationBackNode(level)).toMatchObject({
      label: "Project",
      rowVariant: "back",
      canHide: false,
      canReorder: false,
      canDrag: false,
      canDrop: false,
      target: level.parent.fallback,
    });
    expect(createNavigationBackNode(level, { page: startRef }).target).toEqual({ kind: "page", page: startRef });
  });
});
