import { expect, test } from "bun:test";
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
      { type: "ticket", id: ticket.id, extensionId: "pstdio.pstdio-planner" },
      Array.from({ length: Math.min(100, 205 - offset) }, (_, index) => ({
        type: "foobar",
        id: `item-${String(offset + index).padStart(3, "0")}`,
        extensionId: "example",
        label: `Item ${offset + index}`,
      })),
    );
  let resolved = 0;
  ctx.resources.resolveMany = async (refs) => {
    expect(refs.length).toBeLessThanOrEqual(100);
    resolved += refs.length;
    return refs.map((resource) => ({
      resource,
      target: { kind: "page", page: { kind: "page", id: "item", extensionId: "example" }, resource },
    }));
  };
  const renderer = { rendererId: "ticket-files", resource: { type: "ticket", id: ticket.id } };
  const sections = await listTicketFilesTree(ctx, { renderer });
  expect(calls).toBe(1);
  expect(resolved).toBe(100);
  for (const id of ["sessions", "related"]) {
    const first = sections.find((section) => section.id === id)!;
    expect(first.nodes).toHaveLength(100);
    const second = await listTicketFilesPage(ctx, {
      renderer,
      parent: { kind: "section", id },
      cursor: first.nextCursor!,
    });
    expect(second.nodes).toHaveLength(100);
    const third = await listTicketFilesPage(ctx, {
      renderer,
      parent: { kind: "section", id },
      cursor: second.nextCursor!,
    });
    expect(third.nodes).toHaveLength(5);
    expect(new Set([...first.nodes, ...second.nodes, ...third.nodes].map((node) => node.id)).size).toBe(205);
  }
});
