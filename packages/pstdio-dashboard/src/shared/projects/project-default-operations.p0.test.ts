import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { createProjectDefaultOperations } from "./project-default-operations";

test("settings and launch surfaces see the latest project default while writes and reads settle", async () => {
  const registry = getWorkbenchOperations(createScopedQueryClient({ runtimeId: "test", extensionId: "pstdio" }));
  let confirmed = { default_agent_id: "codex", default_agent_model: "small" as string | null };
  const firstWrite = Promise.withResolvers<typeof confirmed>();
  const firstRead = Promise.withResolvers<typeof confirmed>();
  const writes: unknown[] = [];
  const input = {
    operations: registry,
    read: async () => confirmed,
    write: (_projectId: string, value: Partial<typeof confirmed>) => {
      writes.push(value);
      return writes.length === 1 ? firstWrite.promise : Promise.resolve({ ...confirmed, ...value });
    },
  };
  const settings = createProjectDefaultOperations(input);
  const launch = createProjectDefaultOperations(input);
  const change = (value: Partial<typeof confirmed>) =>
    settings.submit("alpha", value, async (saved) => {
      confirmed = writes.length === 1 ? await firstRead.promise : saved;
    }).result;
  const first = change({ default_agent_id: "claude", default_agent_model: null });
  expect(launch.project("alpha", confirmed)).toEqual({ default_agent_id: "claude", default_agent_model: null });

  const second = change({ default_agent_model: "sonnet" });
  expect(launch.project("alpha", confirmed)).toEqual({ default_agent_id: "claude", default_agent_model: "sonnet" });
  expect(launch.project("other", confirmed)).toBe(confirmed);
  await Promise.resolve();
  firstWrite.resolve({ default_agent_id: "claude", default_agent_model: null });
  await Promise.resolve();
  expect(writes).toHaveLength(1);
  expect(settings.project("alpha", confirmed)).toEqual({ default_agent_id: "claude", default_agent_model: "sonnet" });
  firstRead.resolve({ default_agent_id: "claude", default_agent_model: null });

  await Promise.all([first, second]);
  expect(writes).toEqual([
    { default_agent_id: "claude", default_agent_model: null },
    { default_agent_model: "sonnet" },
  ]);
  expect(launch.project("alpha", confirmed)).toEqual({ default_agent_id: "claude", default_agent_model: "sonnet" });
});

test("checks only the attempted project fields after a lost response", async () => {
  const registry = getWorkbenchOperations(createScopedQueryClient({ runtimeId: "test", extensionId: "pstdio" }));
  let state = { default_agent_id: "codex", default_agent_model: "small" };
  let writes = 0;
  const actions = createProjectDefaultOperations({
    operations: registry,
    read: async (id) => {
      expect(id).toBe("alpha");
      return state;
    },
    write: async () => {
      writes++;
      throw new PstdioConnectionError(new Error("Response lost"));
    },
  });
  const pending = actions.submit("alpha", { default_agent_model: "large" }, async () => {});
  await expect(pending.result).rejects.toThrow();
  expect(registry.getSnapshot().recovery[0]?.canCheck).toBe(true);
  await registry.check(pending.id);
  expect(registry.getSnapshot().recovery[0]?.status).toBe("unknown");
  state = { default_agent_id: "other", default_agent_model: "large" };
  await registry.check(pending.id);
  expect(registry.getSnapshot().recovery).toEqual([]);
  expect(writes).toBe(1);
});
