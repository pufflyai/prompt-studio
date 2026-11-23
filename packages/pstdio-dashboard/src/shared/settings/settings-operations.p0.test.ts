import { expect, test } from "bun:test";
import type { Settings, UpdateSettingsInput } from "@pstdio/sdk/api";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { createSettingsOperations } from "./settings-operations";

const initial: Settings = {
  notifications_enabled: false,
  machine_tokens_enabled: false,
  max_concurrent_sessions: null,
};

test("shares settings intent, keeps capabilities confirmed, and reconciles before applying a second write", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  let settings = initial;
  const sent: UpdateSettingsInput[] = [];
  const firstWrite = Promise.withResolvers<Settings>();
  const firstRead = Promise.withResolvers<Settings>();
  const firstResult = { ...initial, notifications_enabled: true };
  const secondResult = { ...firstResult, machine_tokens_enabled: true };
  const owner = createSettingsOperations({
    operations: getWorkbenchOperations(queries),
    read: () => settings,
    accept: (value) => {
      settings = value;
    },
    update: (input) => {
      sent.push(input);
      return sent.length === 1 ? firstWrite.promise : Promise.resolve(secondResult);
    },
    reload: () => (sent.length === 1 ? firstRead.promise : Promise.resolve(secondResult)),
  });

  const first = owner.submit({ notifications_enabled: true });
  const second = owner.submit({ machine_tokens_enabled: true });
  expect(owner.read()).toEqual(secondResult);
  expect(owner.pending()).toEqual({ notifications_enabled: true, machine_tokens_enabled: true });
  expect(settings).toEqual(initial);
  await Promise.resolve();
  expect(sent).toEqual([{ notifications_enabled: true }]);
  firstWrite.resolve(firstResult);
  await Promise.resolve();
  expect(sent).toHaveLength(1);

  firstRead.resolve(firstResult);
  await first.result;
  await second.result;
  expect(owner.read()).toEqual(secondResult);
  expect(owner.pending()).toEqual({});
  expect(settings).toEqual(secondResult);
});

test("a rejected settings write preserves the draft across consumers and projects the newer field", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const first = Promise.withResolvers<Settings>();
  const second = Promise.withResolvers<Settings>();
  let settings = initial;
  const owner = createSettingsOperations({
    operations,
    read: () => settings,
    accept: (value) => {
      settings = value;
    },
    update: (input) => ("notifications_enabled" in input ? first.promise : second.promise),
    reload: async () => ({ ...initial, machine_tokens_enabled: true }),
  });

  const failed = owner.submit({ notifications_enabled: true });
  const later = owner.submit({ machine_tokens_enabled: true });
  first.reject(new Error("Notifications could not be enabled"));
  await expect(failed.result).rejects.toThrow("Notifications could not be enabled");
  expect(owner.read()).toEqual({ ...initial, machine_tokens_enabled: true });
  expect(operations.getSnapshot().recovery[0]?.draft).toEqual({ notifications_enabled: true });
  second.resolve({ ...initial, machine_tokens_enabled: true });
  await later.result;
  expect(operations.getSnapshot().recovery[0]?.draft).toEqual({ notifications_enabled: true });
});

test("a point read can confirm unknown settings before releasing later work", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  let confirmed = initial;
  let cache = initial;
  let writes = 0;
  const owner = createSettingsOperations({
    operations: getWorkbenchOperations(queries),
    read: () => cache,
    accept: (value) => {
      cache = value;
    },
    update: async (input) => {
      if (++writes === 1) throw new PstdioConnectionError(new Error("Response lost"));
      confirmed = { ...confirmed, ...input };
      return confirmed;
    },
    reload: async () => confirmed,
  });
  const first = owner.submit({ notifications_enabled: true });
  const later = owner.submit({ max_concurrent_sessions: 5 });
  await expect(first.result).rejects.toThrow();
  await owner.check(first.id);
  expect(writes).toBe(1);
  confirmed = { ...initial, notifications_enabled: true };
  await owner.check(first.id);
  await later.result;
  expect(writes).toBe(2);
  expect(cache).toEqual({ ...initial, notifications_enabled: true, max_concurrent_sessions: 5 });
});
