import { describe, expect, test } from "bun:test";
import { accountEvents } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import { createWebviewClient } from "./webview-client";

const createAccountHost = () => {
  const calls: { method: string; params: unknown }[] = [];
  const listeners = new Set<(payload: unknown) => void>();
  let state = "waiting-to-sync";
  let signInRequired = false;
  const host: GuestHost = {
    extensionId: "pstdio.cloud",
    call: async <TResult>(method: string, params?: unknown) => {
      calls.push({ method, params });
      if ((params as { op?: string })?.op === "status")
        return { login: null, cloudProjects: [], cloudProjectsLoaded: true, features: null, signInRequired } as TResult;
      return {
        state,
        offlineReady: true,
        pendingItems: state === "synced" ? 0 : 2,
        download: { completed: state === "synced" ? 3 : 1, total: 3 },
      } as TResult;
    },
    onEvent: (_scope, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const syncChanged = (next: string) => {
    state = next;
    for (const listener of listeners) listener({ type: "changed", id: "account.project-sync.changed" });
  };
  const rejected = () => {
    signInRequired = true;
    for (const listener of listeners) listener({ type: "changed", id: accountEvents.changed.id });
  };
  return { host, calls, syncChanged, rejected };
};

describe("webview account client", () => {
  test("a webview reads sign-in recovery after the public account change event", async () => {
    const { host, rejected } = createAccountHost();
    const client = createWebviewClient<Record<never, never>>(host);
    expect((await client.account.status()).signInRequired).toBe(false);
    const changed = Promise.withResolvers<void>();
    const stop = client.events.subscribe(accountEvents.changed, () => changed.resolve());
    rejected();
    await changed.promise;
    expect((await client.account.status()).signInRequired).toBe(true);
    stop();
  });
  test("an extension reads the project sync state again after a change event", async () => {
    const { host, calls, syncChanged } = createAccountHost();
    const client = createWebviewClient<Record<never, never>>(host);
    const states: string[] = [];
    const read = async () => states.push((await client.account.projectSyncStatus()).state);

    await read();
    expect(await client.account.projectSyncStatus()).toMatchObject({
      pendingItems: 2,
      download: { completed: 1, total: 3 },
    });
    const changed = Promise.withResolvers<void>();
    const unsubscribe = client.events.subscribe(accountEvents.projectSyncChanged, () => {
      void read().then(() => changed.resolve());
    });
    syncChanged("synced");
    await changed.promise;
    unsubscribe();

    expect(states).toEqual(["waiting-to-sync", "synced"]);
    expect(await client.account.projectSyncStatus()).toMatchObject({
      pendingItems: 0,
      download: { completed: 3, total: 3 },
    });
    expect(calls[0]).toEqual({ method: "account.read", params: { op: "projectSyncStatus" } });
  });

  test("account changes use the manage capability", async () => {
    const { host, calls } = createAccountHost();
    const client = createWebviewClient<Record<never, never>>(host);

    await client.account.renameDevice("device-2", "Studio Mac");
    await client.account.stopProjectSync("project-2");

    expect(calls).toEqual([
      { method: "account.manage", params: { op: "renameDevice", id: "device-2", name: "Studio Mac" } },
      { method: "account.manage", params: { op: "stopProjectSync", projectId: "project-2" } },
    ]);
  });
});
