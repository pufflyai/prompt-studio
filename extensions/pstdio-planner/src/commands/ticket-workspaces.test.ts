import { describe, expect, mock, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { ticketWorktreesListCommand, ticketWorktreesRemoveAllCommand } from "./ticket-workspaces";

describe("ticketWorktreesRemoveAllCommand", () => {
  test("uses workspace lifecycle cleanup and preserves workspace records", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Cleanup" } }));
    const removeWorktree = mock(async () => ({ removed: true }));

    const result = await ticketWorktreesRemoveAllCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.id },
        overrides: {
          workspaces: {
            list: async () => [
              {
                id: "workspace-1",
                workspace_shorthand: `${ticket.shorthand}_A1`,
                root_path: "/repo/.pstdio/workspaces/one",
                provider_id: "pstdio.worktree",
                execution_kind: "local",
                anchors_json: [{ type: "ticket", id: ticket.id, label: ticket.shorthand }],
              },
            ],
            removeWorktree,
          },
        },
      }),
    );

    expect(result).toEqual({ removed: 1 });
    expect(removeWorktree).toHaveBeenCalledWith("workspace-1");
  });
});

test.each([
  "list",
  "remove-all",
] as const)("ticket worktrees %s includes Git worktrees and excludes other providers", async (command) => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Provider ownership" } }),
  );
  const targets = [
    {
      id: "git",
      provider_id: "pstdio.worktree",
      execution_kind: "local" as const,
      root_path: "/git",
      branch: "feature",
    },
    { id: "folder", provider_id: "pstdio.root", execution_kind: "local" as const, root_path: "/folder" },
    { id: "custom-folder", provider_id: "example.folder", execution_kind: "local" as const, root_path: "/custom" },
    { id: "remote", provider_id: "example.remote", execution_kind: "remote" as const, root_path: "/stale" },
    { id: "missing", provider_id: "pstdio.worktree", execution_kind: "local" as const, root_path: null },
  ].map((target) => ({
    ...target,
    workspace_shorthand: target.id,
    anchors_json: [{ type: "ticket", id: ticket.id, label: ticket.shorthand }],
  }));
  const removed: string[] = [];
  const args = makeCommandArgs({
    storage,
    params: { id: ticket.id },
    overrides: {
      workspaces: {
        list: async () => targets,
        removeWorktree: async (id: string) => {
          removed.push(id);
          return { removed: true };
        },
      },
    },
  });

  if (command === "list") {
    expect(await ticketWorktreesListCommand.run(...args)).toEqual([
      { workspace: "git", branch: "feature", path: "/git" },
    ]);
    return;
  }
  expect(await ticketWorktreesRemoveAllCommand.run(...args)).toEqual({ removed: 1 });
  expect(removed).toEqual(["git"]);
});
