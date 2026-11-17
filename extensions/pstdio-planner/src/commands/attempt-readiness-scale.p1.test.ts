import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { seedTicketIdentity } from "../data/ticket-context.fixture";
import type { Ticket } from "../data/types";
import { loadAttemptDependencies, readImplementationCapacity } from "./attempt-readiness";
import { makeCommandContext } from "./command-context.fixture";
import { sessionRecord } from "./session-record.fixture";

test("readiness selects the dependency closure without reading unrelated tickets or histories", async () => {
  const rows: Ticket[] = Array.from({ length: 5000 }, (_, index) => ({
    id: `ticket-${index}`,
    shorthand: `T-${index + 1}`,
    title: `Ticket ${index}`,
    content: "Large body ".repeat(1000),
    statusId: "backlog",
    archived: false,
    tags: {},
    createdAt: "2026-11-14",
    updatedAt: "2026-11-14",
    ...(index === 0 ? { dependsOn: ["ticket-1"] } : {}),
  }));
  const storage = createMemoryStorage({
    collections: { tickets: Object.fromEntries(rows.map((row) => [row.id, row])) },
  });
  for (const row of rows) seedTicketIdentity(storage, row);
  const collection = storage.collection.bind(storage);
  const reads = new Set<string>();
  storage.collection = <T>(name: string) => {
    const records = collection<T>(name);
    return {
      ...records,
      list: async () => {
        if (name === "ticket-statuses") return records.list();
        throw Error(`Unbounded collection: ${name}`);
      },
      get: async (id: string) => {
        if (name === "tickets") reads.add(id);
        return records.get(id);
      },
    };
  };
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      workspaces: { getDefault: async () => ({ id: "home", root_path: "/project", execution_kind: "local" }) },
      process: { run: async () => ({ exitCode: 0, stdout: "head\n", stderr: "" }) },
    },
  });
  expect((await loadAttemptDependencies(ctx, "ticket-0", {})).readiness).toMatchObject({
    decision: "wait",
    reason: "dependency-not-ready",
  });
  expect([...reads].sort()).toEqual(["ticket-0", "ticket-1"]);
});

test("implementation capacity pages live sessions and reads only indexed ownership fields", async () => {
  const storage = createMemoryStorage({
    collections: {
      "planner-attempts": Object.fromEntries(
        Array.from({ length: 5000 }, (_, i) => [
          `workspace-${i}`,
          {
            schemaVersion: 2,
            workspaceId: `workspace-${i}`,
            ticketId: `ticket-${i}`,
            implementationSessionId: `session-${i}`,
          },
        ]),
      ),
    },
  });
  for (let i = 0; i < 150; i++)
    await storage
      .collection("planner-attempts")
      .put(`duplicate-${i}`, { schemaVersion: 2, implementationSessionId: "session-0", workspaceId: `duplicate-${i}` });
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw Error(`Unbounded collection: ${name}`);
    },
  });
  let queries = 0;
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      sessions: {
        query: async (input) => {
          queries++;
          expect(input?.status).toEqual(["queued", "in_progress", "awaiting_input"]);
          expect(input?.limit).toBe(100);
          const start = Number(input?.cursor ?? 0);
          const ids = Array.from({ length: 205 }, (_, i) => `session-${i}`).concat("unmanaged");
          return {
            items: ids.slice(start, start + 100).map((id) => sessionRecord({ id, title: id, status: "in_progress" })),
            nextCursor: start + 100 < ids.length ? String(start + 100) : null,
          };
        },
        get: async () => {
          throw Error("Unbounded attempt session fanout");
        },
      },
    },
  });
  expect(await readImplementationCapacity(ctx)).toMatchObject({ running: 205 });
  expect(queries).toBe(3);
});
