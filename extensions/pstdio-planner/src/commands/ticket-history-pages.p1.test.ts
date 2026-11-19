import { expect, test } from "bun:test";
import type { TreeNode } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { sessionRecord } from "./session-record.fixture";
import { listTicketFilesTree } from "./ticket-files";
import { listTicketFilesPage } from "./ticket-files-page";

test("ticket history and arbitrary related resources load only their visible page", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  const ticket = await createTicketCommand.run(ctx, { title: "Selected" });
  const history = Array.from({ length: 205 }, (_, index) =>
    sessionRecord({ id: `session-${index}`, title: `Session ${index}`, status: "completed" }),
  );
  let calls = 0;
  ctx.sessions.query = async (input) => {
    calls++;
    expect(input?.includeWorkspaceAnchors).toBe(true);
    expect(input?.anchor?.id).toBe(ticket.id);
    expect(input?.limit).toBe(100);
    const start = Number(input?.cursor ?? 0);
    return {
      items: history.slice(start, start + 100),
      nextCursor: start + 100 < history.length ? String(start + 100) : null,
    };
  };
  ctx.workspaces.list = async () => {
    throw Error("Unbounded workspace lookup");
  };
  for (let offset = 0; offset < 205; offset += 100)
    await ctx.resources.addAnchors(
      { type: "ticket", id: ticket.id, extensionId: "pstdio.planner" },
      Array.from({ length: Math.min(100, 205 - offset) }, (_, index) => ({
        type: offset + index < 150 ? "foobar" : "note",
        id: `item-${String(offset + index).padStart(3, "0")}`,
        extensionId: "example",
        label: `Item ${offset + index}`,
      })),
    );
  let resolved = 0;
  ctx.resources.resolveMany = async () => {
    throw Error("Owner resolution bypasses configured opener");
  };
  ctx.resources.resolveOpenings = async (refs) => {
    expect(refs.length).toBeLessThanOrEqual(100);
    resolved += refs.length;
    return refs.map((resource) => ({
      resource,
      target: {
        kind: "page",
        page: { kind: "page", id: "configured-opening", extensionId: "example.viewer" },
        resource,
      },
    }));
  };
  const renderer = { rendererId: "ticket-files", resource: { type: "ticket", id: ticket.id } };
  const sections = await listTicketFilesTree(ctx, { renderer });
  expect(calls).toBe(1);
  expect(resolved).toBe(100);
  for (const id of ["sessions", "related"]) {
    const first = sections.find((section) => section.id === id)!;
    const firstNodes = id === "related" ? first.nodes.flatMap((node) => node.children ?? []) : first.nodes;
    expect(firstNodes).toHaveLength(100);
    if (id === "related")
      for (const node of firstNodes)
        expect(node.target).toMatchObject({ page: { id: "configured-opening", extensionId: "example.viewer" } });
    const second = await listTicketFilesPage(ctx, {
      renderer,
      parent: { kind: "section", id },
      cursor: first.nextCursor!,
    });
    const secondNodes = id === "related" ? second.nodes.flatMap((node: TreeNode) => node.children ?? []) : second.nodes;
    expect(secondNodes).toHaveLength(100);
    if (id === "related") {
      expect(first.label).toBeUndefined();
      expect(first.nodes).toHaveLength(1);
      expect(second.nodes).toHaveLength(2);
      expect(new Set([...first.nodes, ...second.nodes].map((node) => node.id)).size).toBe(2);
    }
    if (id === "related")
      for (const node of secondNodes)
        expect(node.target).toMatchObject({ page: { id: "configured-opening", extensionId: "example.viewer" } });
    const third = await listTicketFilesPage(ctx, {
      renderer,
      parent: { kind: "section", id },
      cursor: second.nextCursor!,
    });
    const thirdNodes = id === "related" ? third.nodes.flatMap((node: TreeNode) => node.children ?? []) : third.nodes;
    expect(thirdNodes).toHaveLength(5);
    expect(new Set([...firstNodes, ...secondNodes, ...thirdNodes].map((node) => node.id)).size).toBe(205);
  }
});
