import { expect, test } from "bun:test";
import type { ExtensionSessionsApi } from "@pstdio/sdk/extensions";
import { sessionRecord } from "../commands/session-record.fixture";
import { loadLatestWorkspaceSessions } from "./workspace-sessions";

test("workspace badges read at most one result per query even with long histories", async () => {
  const queries: Parameters<ExtensionSessionsApi["query"]>[0][] = [];
  let returnedRows = 0;
  const history = Array.from({ length: 1000 }, (_, index) =>
    sessionRecord({
      id: `session-${index}`,
      title: "Session",
      status: index === 900 ? "awaiting_input" : "completed",
    }),
  ).reverse();
  const sessions: Pick<ExtensionSessionsApi, "query"> = {
    query: async (input) => {
      queries.push(input);
      const matching = history.filter((session) => !input?.status || input.status.includes(session.status));
      const offset = Number(input?.cursor ?? 0);
      const limit = input?.limit ?? 50;
      const items = matching.slice(offset, offset + limit);
      returnedRows += items.length;
      return { items, nextCursor: offset + limit < matching.length ? String(offset + limit) : null };
    },
  };
  const lookup = await loadLatestWorkspaceSessions(sessions, [
    {
      id: "ws",
      anchors_json: [{ type: "ticket", id: "ticket", shorthand: "T-1" }],
    },
  ]);

  expect(lookup.get("ws")).toEqual({ id: "session-900", status: "awaiting_input" });
  expect(returnedRows).toBe(1);
  expect(queries).toHaveLength(1);
  expect(queries[0]).toMatchObject({ workspaceId: "ws", includeArchived: true, limit: 1 });
});

test("completed workspace badges fetch only the latest session, including archived sessions", async () => {
  const queries: Parameters<ExtensionSessionsApi["query"]>[0][] = [];
  const latest = sessionRecord({ id: "latest", title: "Latest", status: "completed", archived: true });
  const sessions: Pick<ExtensionSessionsApi, "query"> = {
    query: async (input) => {
      queries.push(input);
      return { items: input?.status ? [] : [latest], nextCursor: null };
    },
  };
  expect(
    (
      await loadLatestWorkspaceSessions(sessions, [
        {
          id: "ws",
          anchors_json: [{ type: "ticket", id: "ticket", shorthand: "T-1" }],
        },
      ])
    ).get("ws"),
  ).toEqual({ id: "latest", status: "completed" });
  expect(queries).toHaveLength(2);
  expect(queries.every((query) => query?.limit === 1 && query.includeArchived === true)).toBe(true);
});

test("overlapping board refreshes share a four-query concurrency limit", async () => {
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  let started!: () => void;
  const fourStarted = new Promise<void>((done) => {
    started = done;
  });
  let active = 0;
  let peak = 0;
  let calls = 0;
  const sessions: Pick<ExtensionSessionsApi, "query"> = {
    query: async () => {
      active++;
      peak = Math.max(peak, active);
      calls++;
      if (active === 4) started();
      await gate;
      active--;
      return { items: [], nextCursor: null };
    },
  };
  const workspaces = Array.from({ length: 28 }, (_, index) => ({
    id: `ws-${index}`,
    anchors_json: [{ type: "ticket", id: "ticket", shorthand: "T-1" }],
  }));
  const complete = Promise.all([
    loadLatestWorkspaceSessions(sessions, workspaces.slice(0, 14)),
    loadLatestWorkspaceSessions(sessions, workspaces.slice(14)),
  ]);
  try {
    await fourStarted;
    await new Promise<void>((done) => setImmediate(done));
    expect(active).toBe(4);
  } finally {
    release();
    await complete;
  }
  expect(peak).toBe(4);
  expect(calls).toBe(56);
});
