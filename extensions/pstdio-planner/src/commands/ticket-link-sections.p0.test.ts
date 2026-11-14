import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { loadTicketLinkedResources } from "../data/ticket-linked-resources";
import type { Ticket } from "../data/types";
import { sessionRecord } from "./session-record.fixture";
import { mergeTicketLinkSections, ticketRelationshipSections } from "./ticket-link-sections";

const ticket = (id: string, extra: Partial<Ticket> = {}): Ticket => ({
  id,
  shorthand: `PS-${id}`,
  title: id,
  content: "",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-11-11",
  updatedAt: "2026-11-11",
  ...extra,
});
test("parent and dependencies navigate to tickets and dependencies link back", () => {
  const parent = ticket("parent");
  const dependency = ticket("dependency");
  const child = ticket("child", { parentId: parent.id, dependsOn: [dependency.shorthand] });
  const tickets = [parent, dependency, child];
  const sections = ticketRelationshipSections(child, tickets);
  expect(sections.map((section) => section.id)).toEqual(["parent", "depends-on"]);
  expect(sections[0].nodes[0].target).toMatchObject({ resource: { id: parent.id } });
  expect(sections[1].nodes[0].target).toMatchObject({ resource: { id: dependency.id } });
  expect(ticketRelationshipSections(dependency, tickets)[0].nodes[0].resource?.id).toBe(child.id);
  expect(ticketRelationshipSections(parent, tickets)).toEqual([]);
});
test("ticket resource navigation merges bidirectional session links without empty groups or duplicates", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { extensionId: "pstdio.pstdio-planner" },
  });
  const ticket = { type: "ticket", id: "ticket", extensionId: ctx.extensionId, projectId: ctx.projectId };
  const session = { type: "session", id: "session", extensionId: "pstdio", projectId: ctx.projectId, label: "Review" };
  ctx.resources.resolveMany = async (refs) =>
    refs.map((resource) => ({
      resource,
      target: {
        kind: "page",
        page: { kind: "page", extensionId: "pstdio.pstdio-session-browser", id: "conversation" },
        resource,
      },
    }));
  await ctx.resources.addAnchors(ticket, [session]);
  await ctx.resources.addAnchors(session, [ticket]);
  const links = (await loadTicketLinkedResources(ctx.resources, [ticket])).get(ticket.id)!;
  const sections = mergeTicketLinkSections(
    [
      { id: "sessions", nodes: [] },
      { id: "parent", nodes: [] },
    ],
    links,
  );
  expect(sections.map((section) => section.id)).toEqual(["sessions"]);
  expect(sections[0].nodes[0].target).toMatchObject({ resource: session });
  expect(mergeTicketLinkSections(sections, links)[0].nodes).toHaveLength(1);
});

test.each([
  "pstdio.pstdio-planner",
  "pstdio.planner",
])("ticket navigation queries %s project-scoped links", async (extensionId) => {
  const { createTicketCommand } = await import("./create-ticket");
  const { listTicketFilesTree } = await import("./ticket-files");
  const { makeCommandContext: plannerContext } = await import("./command-context.fixture");
  const ctx = plannerContext({
    storage: createMemoryStorage(),
    params: { title: "Ticket" },
    overrides: { extensionId },
  });
  const ticket = await createTicketCommand.run(ctx, { title: "Ticket" });
  const resource = { type: "ticket", id: ticket.id, extensionId: ctx.extensionId, projectId: ctx.projectId };
  const session = {
    type: "session",
    id: "session",
    label: "Linked session",
    extensionId: "pstdio",
    projectId: ctx.projectId,
  };
  await ctx.resources.addAnchors(resource, [session]);
  ctx.resources.resolveMany = async (refs) =>
    refs.map((resource) => ({
      resource,
      target: {
        kind: "page",
        page: { kind: "page", id: "conversation", extensionId: "pstdio.pstdio-session-browser" },
        resource,
      },
    }));
  ctx.sessions.query = async (input) => {
    expect(input?.anchor).toMatchObject(resource);
    expect(input?.includeWorkspaceAnchors).toBe(true);
    return {
      items: [sessionRecord({ id: "session", title: "Linked session", status: "completed" })],
      nextCursor: null,
    };
  };
  const sections = await listTicketFilesTree(ctx, { renderer: { rendererId: "ticket-files", resource } });
  expect(sections.find((section) => section.id === "sessions")?.nodes[0].resource?.id).toBe("session");
});

test("resource links with matching ids retain distinct extension owners", () => {
  const links = ["a.notes", "b.notes"].map((extensionId) => ({
    id: extensionId,
    label: extensionId,
    resource: { type: "note", id: "same", extensionId, projectId: "project" },
  }));
  expect(mergeTicketLinkSections([], links)[0].nodes).toHaveLength(2);
});

test("canonical ticket links retain their hierarchy and deduplicate domain relationships", () => {
  const owner = "pstdio.planner";
  const parent = ticket("parent");
  const dependency = ticket("dependency");
  const child = ticket("child", { parentId: parent.id, dependsOn: [dependency.id] });
  const sections = ticketRelationshipSections(child, [parent, dependency, child], owner);
  for (const section of sections)
    for (const node of section.nodes) {
      expect(node.resource?.metadata).toMatchObject({ resourceParent: { viewId: "pstdio.planner.view.tickets" } });
      expect(node.target).toMatchObject({ page: { extensionId: owner } });
    }
  const links = [
    { id: "parent", label: "Parent", resource: { type: "ticket", id: parent.id, extensionId: owner } },
    { id: "dependency", label: "Dependency", resource: { type: "ticket", id: dependency.id, extensionId: owner } },
    {
      id: "foreign",
      label: "Foreign parent",
      resource: { type: "ticket", id: parent.id, extensionId: "alice.planner" },
    },
  ];
  const merged = mergeTicketLinkSections(sections, links, "proj-1", owner);
  expect(merged.find((section) => section.id === "related")?.nodes.map((node) => node.resource?.extensionId)).toEqual([
    "alice.planner",
  ]);
});
