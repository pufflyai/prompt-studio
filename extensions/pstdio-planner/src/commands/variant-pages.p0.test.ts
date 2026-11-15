import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putAttempt } from "../data/attempt-storage";
import { makeCommandContext } from "./command-context.fixture";
import { listVariantsCommand } from "./reconcile-attempt";

test("variant listings return bounded continuations without listing all attempts", async () => {
  const storage = createMemoryStorage();
  for (let i = 0; i < 203; i++)
    await putAttempt(storage, {
      schemaVersion: 2,
      workspaceId: `workspace-${String(i).padStart(3, "0")}`,
      workspaceShorthand: `WS-${i}`,
      ticketId: `ticket-${i}`,
      ticketShorthand: `T-${i}`,
      implementationSessionId: `session-${i}`,
      base: { workspaceId: null, headSha: "base" },
      revisions: [],
      implementationDisconnectRetries: 0,
      reviewDisconnectRetries: 0,
      blocker: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw Error(`Unbounded ${name}`);
    },
  });
  const ctx = makeCommandContext({ storage, params: {} });
  const first = await listVariantsCommand.run(ctx, {});
  expect(first.variants).toHaveLength(100);
  expect(first.total).toBe(203);
  const second = await listVariantsCommand.run(ctx, { cursor: first.cursor! });
  const last = await listVariantsCommand.run(ctx, { cursor: second.cursor! });
  expect(last.variants.map(({ workspaceId }) => workspaceId)).toEqual([
    "workspace-200",
    "workspace-201",
    "workspace-202",
  ]);
  expect(last.cursor).toBeNull();
});
