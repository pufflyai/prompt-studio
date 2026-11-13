import { expect, test } from "bun:test";
import type { GuestHost } from "./guest-host";
import { createWebviewClient } from "./webview-client";

test("inactive command and service projections incorporate newer same-authority seeds without a read", () => {
  const listeners = new Set<() => void>();
  let calls = 0;
  const snapshot = <T>(version: number, data: T) => ({ generation: 1, version, data, stale: false, fetching: false });
  const accountData = (label: string) => ({
    login: null,
    features: null,
    cloudProjects: [label],
    cloudProjectsLoaded: true,
  });
  let props = {
    commandQueries: { owner: "commands", values: [{ command: { commandId: "read" }, snapshot: snapshot(1, "old") }] },
    serviceQueries: {
      account: {
        owner: "account",
        values: [{ source: { service: "status" as const }, snapshot: snapshot(1, accountData("old")) }],
      },
    },
  };
  const host = {
    extensionId: "test",
    propsStore: {
      get: () => props,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    onEvent: () => () => {},
    call: () => {
      calls++;
      return Promise.reject(new Error("No bridge read expected"));
    },
  } as unknown as GuestHost;
  const client = createWebviewClient(host);
  const command = client.queries.command({ kind: "command", id: "read", extensionId: "pstdio" });
  const account = client.account.query({ service: "status" });
  try {
    expect(command.getSnapshot().data).toBe("old");
    expect(account.getSnapshot().data?.cloudProjects).toEqual(["old"]);
    props = {
      commandQueries: { owner: "commands", values: [{ command: { commandId: "read" }, snapshot: snapshot(2, "new") }] },
      serviceQueries: {
        account: {
          owner: "account",
          values: [{ source: { service: "status" }, snapshot: snapshot(2, accountData("new")) }],
        },
      },
    };
    for (const listener of [...listeners]) listener();
    expect(command.getSnapshot().data).toBe("new");
    expect(account.getSnapshot().data?.cloudProjects).toEqual(["new"]);
    expect(calls).toBe(0);
    props = {
      commandQueries: {
        owner: "commands",
        values: [{ command: { commandId: "read" }, snapshot: snapshot(1, "late old") }],
      },
      serviceQueries: {
        account: {
          owner: "account",
          values: [{ source: { service: "status" }, snapshot: snapshot(1, accountData("late old")) }],
        },
      },
    };
    for (const listener of [...listeners]) listener();
    expect(command.getSnapshot().data).toBe("new");
    expect(account.getSnapshot().data?.cloudProjects).toEqual(["new"]);
    expect(calls).toBe(0);
  } finally {
    client.queries.dispose();
  }
});
