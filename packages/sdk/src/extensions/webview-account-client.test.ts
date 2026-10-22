import { describe, expect, test } from "bun:test";
import { accountEvents } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import { createWebviewClient } from "./webview-client";

const createAccountHost = () => {
  const calls: { method: string; params: unknown }[] = [];
  const listeners = new Set<(payload: unknown) => void>();
  let state = "waiting-to-sync";
  const host: GuestHost = {
    extensionId: "pstdio.cloud",
    call: async <TResult>(method: string, params?: unknown) => {
      calls.push({ method, params });
      return { state, offlineReady: true } as TResult;
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
  return { host, calls, syncChanged };
};

describe("webview account client", () => {
  test("an extension reads the project sync state again after a change event", async () => {
    const { host, calls, syncChanged } = createAccountHost();
    const client = createWebviewClient<Record<never, never>>(host);
    const states: string[] = [];
    const read = async () => states.push((await client.account.projectSyncStatus()).state);

    await read();
    const changed = Promise.withResolvers<void>();
    const unsubscribe = client.events.subscribe(accountEvents.projectSyncChanged, () => {
      void read().then(() => changed.resolve());
    });
    syncChanged("synced");
    await changed.promise;
    unsubscribe();

    expect(states).toEqual(["waiting-to-sync", "synced"]);
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
