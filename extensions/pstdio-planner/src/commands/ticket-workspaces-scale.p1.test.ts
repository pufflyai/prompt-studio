import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { seedWorkspaceLinks } from "./archive-context.fixture";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { deleteUnusedLinkedWorkspaces } from "./ticket-workspace-cleanup";
import { ticketWorkspacesCommand, ticketWorktreesRemoveAllCommand } from "./ticket-workspaces";

test("workspace discovery pages ticket links and cleanup preflights later pages", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const ticket = await createTicketCommand.run(ctx, { title: "Selected" });
  const removed: string[] = [];
  const workspaces = Array.from({ length: 205 }, (_, index) => ({
    id: `workspace-${String(index).padStart(3, "0")}`,
    provider_id: "pstdio.worktree",
    execution_kind: "local" as const,
    root_path: `/workspace/${index}`,
    anchors_json: [
      { type: "ticket", id: ticket.id },
      ...(index === 204 ? [{ type: "ticket", id: "another-ticket" }] : []),
    ],
  }));
  await seedWorkspaceLinks(ctx, workspaces);
  for (const workspace of workspaces)
    await ctx.resources.addAnchors({ type: "ticket", id: ticket.id, extensionId: "pstdio.pstdio-planner" }, [
      { type: "workspace", id: workspace.id, extensionId: "pstdio" },
    ]);
  ctx.workspaces.list = async () => {
    throw Error("Unbounded workspace read");
  };
  ctx.workspaces.removeWorktree = async (id) => {
    removed.push(id);
    return { removed: true };
  };
  const first = await ticketWorkspacesCommand.run(ctx, { id: ticket.id });
  expect(first.items).toHaveLength(100);
  expect(first.nextCursor).toBeDefined();
  const second = await ticketWorkspacesCommand.run(ctx, { id: ticket.id, cursor: first.nextCursor });
  expect(second.items).toHaveLength(100);
  const third = await ticketWorkspacesCommand.run(ctx, { id: ticket.id, cursor: second.nextCursor });
  expect(third.items).toHaveLength(5);
  expect(new Set([...first.items, ...second.items, ...third.items].map(({ id }) => id)).size).toBe(205);
  expect(third.nextCursor).toBeUndefined();
  await expect(ticketWorktreesRemoveAllCommand.run(ctx, { id: ticket.id })).rejects.toThrow("linked to other tickets");
  expect(removed).toEqual([]);
});

test("workspace cleanup continues after an early failure and protects foreign owners", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const ticket = await createTicketCommand.run(ctx, { title: "Archived" });
  await storage.collection("tickets").put(ticket.id, { ...ticket, archived: true });
  const workspaces = Array.from({ length: 205 }, (_, index) => ({
    id: `workspace-${String(index).padStart(3, "0")}`,
    anchors_json: [{ type: "ticket", id: ticket.id }],
  }));
  await seedWorkspaceLinks(ctx, [
    ...workspaces,
    {
      id: "shared-foreign",
      anchors_json: [
        { type: "ticket", id: ticket.id },
        { type: "ticket", id: ticket.id, extensionId: "other.planner" },
      ],
    },
  ]);
  const deleted: string[] = [];
  const notices: string[] = [];
  ctx.workspaces.list = async () => {
    throw Error("Unbounded workspace read");
  };
  ctx.workspaces.delete = async (id) => {
    deleted.push(id);
    if (id === "workspace-000") throw Error("First deletion failed");
  };
  const notify = ctx.notify.action;
  ctx.notify.action = async (input) => {
    notices.push(String(input.body));
    return notify(input);
  };
  await deleteUnusedLinkedWorkspaces(ctx, [ticket]);
  expect(deleted).toHaveLength(205);
  expect(deleted).toContain("workspace-204");
  expect(deleted).not.toContain("shared-foreign");
  expect(notices).toHaveLength(1);
  expect(notices[0]).toContain("First deletion failed");
});
