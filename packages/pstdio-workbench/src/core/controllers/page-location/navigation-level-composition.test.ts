import { describe, expect, test } from "bun:test";
import { createWorkbench, type WorkbenchCore } from "../../workbench-core";
import { createLevelNavigation } from "./navigation-level-composition";

const registerPage = (workbench: WorkbenchCore, pageId: string, resourceKind?: string) => {
  const viewId = `test.${pageId}.view`;
  const page = { extensionId: "test", kind: "page" as const, id: pageId };
  workbench.views.registerView({ id: viewId, title: pageId, body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: `test.page.${pageId}`,
    ref: page,
    title: pageId,
    path: pageId,
    modeId: "project",
    ...(resourceKind ? { resource: { kinds: [{ kind: "resource-kind" as const, id: resourceKind }] } } : {}),
    main: { kind: "panels", empty: { kind: "view", id: viewId } },
    slots: [],
  });
  return page;
};
const contribute = (
  workbench: WorkbenchCore,
  owner: { kind: "mode" | "page"; id: string; extensionId: string },
  slot: "header" | "content" | "footer",
  sections: (resource?: { id: string }) => { id: string; nodes: { id: string; label: string }[] }[],
) =>
  workbench.navigationTrees.registerContribution({
    id: `${owner.id}.${slot}`,
    owner,
    sourceExtensionId: owner.extensionId,
    declarationIndex: 0,
    slot,
    getSections: ({ resource }) => sections(resource),
  });
const rows = (sections: { nodes: { id: string; pinnedOnly?: boolean }[] }[]) =>
  sections.flatMap((section) => section.nodes).map((node) => (node.pinnedOnly ? `pinned:${node.id}` : node.id));
const project = { kind: "mode" as const, id: "project", extensionId: "pstdio" };
const setup = () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.pageLocations.setProject("one");
  return { workbench, navigation: createLevelNavigation(workbench) };
};

describe("level navigation", () => {
  test("replaces the body with the level, keeps mode rows for pinned slots, and follows inherited levels", async () => {
    const { workbench, navigation } = setup();
    const home = registerPage(workbench, "home");
    const ticket = registerPage(workbench, "ticket", "ticket");
    const child = registerPage(workbench, "child");
    for (const slot of ["header", "content", "footer"] as const)
      contribute(workbench, project, slot, () => [{ id: slot, nodes: [{ id: slot, label: slot }] }]);
    contribute(workbench, { kind: "page", id: "test.page.ticket", extensionId: "test" }, "content", (resource) => [
      { id: "ticket", nodes: [{ id: resource!.id, label: resource!.id }] },
    ]);
    const target = (id: string) => ({ kind: "page" as const, page: ticket, resource: { type: "ticket", id } });

    workbench.pageLocations.navigate(target("one"));
    expect(rows(await navigation.getSections("content"))).toEqual(["one", "pinned:content"]);
    expect(rows(await navigation.getSections("header"))).toEqual(["header"]);
    expect(rows(await navigation.getSections("footer"))).toEqual(["footer"]);
    const levelKey = navigation.getReadKey();
    workbench.pageLocations.navigate(target("two"));
    expect(rows(await navigation.getSections("content"))).toEqual(["two", "pinned:content"]);
    expect(navigation.getReadKey()).not.toBe(levelKey);
    workbench.pageLocations.navigate({ kind: "page", page: child, parent: target("two") });
    expect(rows(await navigation.getSections("content"))).toEqual(["two", "pinned:content"]);
    workbench.pageLocations.navigate({ kind: "page", page: home });
    expect(rows(await navigation.getSections("content"))).toEqual(["content"]);
  });

  test("keeps header rows of enclosing levels in nested levels and merges shared section ids", async () => {
    const { workbench, navigation } = setup();
    const tickets = registerPage(workbench, "tickets");
    const ticket = registerPage(workbench, "ticket", "ticket");
    const ticketsOwner = { kind: "page" as const, id: "test.page.tickets", extensionId: "test" };
    contribute(workbench, project, "header", () => [{ id: "search", nodes: [{ id: "search", label: "Search" }] }]);
    contribute(workbench, project, "content", () => [
      { id: "navigation.root", nodes: [{ id: "notes", label: "Notes" }] },
    ]);
    contribute(workbench, ticketsOwner, "header", () => [
      { id: "filters", nodes: [{ id: "filter", label: "Filter" }] },
    ]);
    contribute(workbench, ticketsOwner, "content", () => [
      { id: "board", nodes: [{ id: "all", label: "All tickets" }] },
    ]);
    contribute(workbench, { kind: "page", id: "test.page.ticket", extensionId: "test" }, "content", () => [
      { id: "navigation.root", nodes: [{ id: "files", label: "Files" }] },
    ]);
    workbench.pageLocations.navigate({
      kind: "page",
      page: ticket,
      resource: { type: "ticket", id: "PS-1" },
      parent: { kind: "page", page: tickets },
    });

    expect(rows(await navigation.getSections("header"))).toEqual(["search", "filter"]);
    const body = await navigation.getSections("content");
    expect(body.map((section) => section.id)).toEqual(["navigation.root", "board"]);
    expect(rows(body)).toEqual(["files", "pinned:notes", "pinned:all"]);
  });
});
