import { describe, expect, test } from "bun:test";
import type { ExtensionSessionsApi, ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { putTicket } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultStatuses } from "../data/seed";
import type { StoredTicket } from "../data/types";
import { commandParamsFor, makeCommandContext } from "./command-context.fixture";
import { queryTicketsCommand } from "./query-tickets";

const makeTicket = (overrides: Partial<StoredTicket>): StoredTicket => ({
  id: "ticket-1",
  shorthand: "T-1",
  title: "Ticket",
  content: "",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

type WorkspaceSession = Awaited<ReturnType<ExtensionSessionsApi["listByWorkspace"]>>[number];

const makeWorkspace = (id: string, shorthand: string, createdAt: string): ExtensionWorkspace => ({
  id,
  workspace_shorthand: shorthand,
  worktree_path: `/worktrees/${shorthand}`,
  created_at: createdAt,
});

describe("queryTicketsCommand", () => {
  test("passes archived filter values to the tickets query", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await putTicket(storage, makeTicket({ archived: false, title: "Active" }));
    await putTicket(storage, makeTicket({ id: "ticket-2", shorthand: "T-2", archived: true, title: "Archived" }));

    const ctx = makeCommandContext({
      storage,
      params: { filters: { archived: ["archived"] } },
    });

    const result = await queryTicketsCommand.run(ctx, commandParamsFor(ctx));

    expect(result.rows.map((row) => row.title)).toEqual(["Archived"]);
  });

  test("pairs each workspace badge item with that workspace's latest session", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await putTicket(storage, makeTicket({}));

    const sessionsByWorkspace: Record<string, WorkspaceSession[]> = {
      "workspace-1": [
        { id: "session-old", title: "Old", status: "completed" },
        { id: "session-new", title: "New", status: "failed" },
      ],
      "workspace-2": [{ id: "session-latest", title: "Latest", status: "in_progress" }],
    };

    const ctx = makeCommandContext({
      storage,
      params: {},
      overrides: {
        workspaces: {
          list: async () => [
            makeWorkspace("workspace-1", "T-1_A1", "2026-01-02T00:00:00.000Z"),
            makeWorkspace("workspace-2", "T-1_A2", "2026-01-03T00:00:00.000Z"),
          ],
        },
        sessions: { listByWorkspace: async (workspaceId: string) => sessionsByWorkspace[workspaceId] ?? [] },
      },
    });

    const result = await queryTicketsCommand.run(ctx, commandParamsFor(ctx));

    expect(result.rows[0]?.attributes.workspaceItems).toMatchObject([
      { id: "workspace-2", session: { id: "session-latest", status: "in_progress" } },
      { id: "workspace-1", session: { id: "session-new", status: "failed" } },
    ]);
  });

  test("leaves workspace items without sessions unchanged", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await putTicket(storage, makeTicket({}));

    const ctx = makeCommandContext({
      storage,
      params: {},
      overrides: {
        workspaces: { list: async () => [makeWorkspace("workspace-1", "T-1_A1", "2026-01-02T00:00:00.000Z")] },
      },
    });

    const result = await queryTicketsCommand.run(ctx, commandParamsFor(ctx));

    expect(result.rows[0]?.attributes.workspaceItems).toEqual([
      {
        id: "workspace-1",
        name: "T-1_A1",
        shorthand: "T-1_A1",
        type: "worktree",
        createdAt: "2026-01-02T00:00:00.000Z",
        resourceParent: {
          type: "ticket",
          id: "ticket-1",
          label: "T-1 Ticket",
          metadata: {
            shorthand: "T-1",
            resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
          },
        },
      },
    ]);
  });
});
