import { describe, expect, test } from "bun:test";
import type { ExtensionSessionsApi, ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket } from "../data/collections";
import { seedDefaultStatuses } from "../data/seed";
import { countStorageWrites } from "../data/storage-writes.fixture";
import type { StoredTicket } from "../data/types";
import { commandParamsFor, makeCommandContext } from "./command-context.fixture";
import { queryTicketsCommand } from "./query-tickets";
import { sessionQuery } from "./session-query.fixture";

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

type WorkspaceSession = Partial<Awaited<ReturnType<ExtensionSessionsApi["query"]>>["items"][number]> & {
  id: string;
  title: string;
  status: "completed" | "failed" | "in_progress";
};

const makeWorkspace = (id: string, shorthand: string, createdAt: string): ExtensionWorkspace => ({
  id,
  anchors_json: [{ type: "ticket", id: "ticket-1", shorthand: "T-1" }],
  workspace_shorthand: shorthand,
  root_path: `/worktrees/${shorthand}`,
  provider_id: "pstdio.worktree",
  execution_kind: "local",
  created_at: createdAt,
});

describe("queryTicketsCommand", () => {
  test("reading the board writes nothing once Planner storage is up to date", async () => {
    const { storage, counter } = countStorageWrites(createMemoryStorage());
    await putTicket(storage, makeTicket({ title: "Active" }));
    const ctx = makeCommandContext({ storage, params: { filter: { conjunction: "and", rules: [] } } });
    await queryTicketsCommand.run(ctx, commandParamsFor(ctx));
    counter.writes = 0;

    const result = await queryTicketsCommand.run(ctx, commandParamsFor(ctx));

    expect(result.rows.map((row) => row.title)).toEqual(["Active"]);
    expect(counter.writes).toBe(0);
  });

  test("returns both archive states when the view has no archive filter", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ archived: false, title: "Active" }));
    await putTicket(storage, makeTicket({ id: "ticket-2", shorthand: "T-2", archived: true, title: "Archived" }));

    const ctx = makeCommandContext({ storage, params: { filter: { conjunction: "and", rules: [] } } });
    const result = await queryTicketsCommand.run(ctx, commandParamsFor(ctx));

    expect(result.rows.map((row) => row.title)).toEqual(["Active", "Archived"]);
  });

  test("passes archived filter values to the tickets query", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await putTicket(storage, makeTicket({ archived: false, title: "Active" }));
    await putTicket(storage, makeTicket({ id: "ticket-2", shorthand: "T-2", archived: true, title: "Archived" }));

    const ctx = makeCommandContext({
      storage,
      params: {
        filter: {
          conjunction: "and",
          rules: [{ attributeId: "archived", condition: "is-any-of", value: ["archived"] }],
        },
      },
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
        sessions: {
          query: sessionQuery(
            async () => [],
            async (workspaceId: string) => sessionsByWorkspace[workspaceId] ?? [],
          ),
        },
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

    expect(result.rows[0]?.attributes.workspaceItems).toMatchObject([
      {
        id: "workspace-1",
        label: "T-1_A1",
        icon: "GitBranch",
        resource: { type: "workspace", id: "workspace-1", label: "T-1_A1" },
        createdAt: "2026-01-02T00:00:00.000Z",
        resourceParent: {
          type: "ticket",
          id: "ticket-1",
          label: "T-1 Ticket",
          shorthand: "T-1",
          metadata: {
            resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
          },
        },
      },
    ]);
  });
});
