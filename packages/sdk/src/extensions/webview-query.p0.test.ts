import { expect, test } from "bun:test";
import type { GuestHost } from "./guest-host";
import { createWebviewQueryClient } from "./webview-query";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("retained project queries remember cheap scoped invalidations without background reads", async () => {
  const listeners = new Set<(event: unknown) => void>();
  const host: GuestHost = {
    extensionId: "example",
    call: async () => {
      throw new Error("No RPC");
    },
    propsStore: { get: () => ({ projectId: "a" }) as never, subscribe: () => () => {} },
    onEvent: (_scope, listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const root = createWebviewQueryClient(host);
  let reads = 0;
  const query = root.query({
    id: "read",
    events: ["example.event.changed"],
    dependency: { resourceId: "one" },
    read: async () => ++reads,
  });
  let stop = query.subscribe(() => {});
  await turn();
  stop();
  for (const emit of listeners)
    emit({ type: "changed", id: "example.event.changed", projectId: "b", resourceIds: ["one"] });
  await turn();
  stop = query.subscribe(() => {});
  await turn();
  stop();
  expect(reads).toBe(1);
  for (const emit of listeners)
    emit({ type: "changed", id: "example.event.changed", projectId: "a", resourceIds: ["one"] });
  await turn();
  expect(reads).toBe(1);
  stop = query.subscribe(() => {});
  expect(query.getSnapshot().data).toBe(1);
  await turn();
  expect(reads).toBe(2);
  stop();
  root.dispose();
  expect(listeners.size).toBe(0);
});

test("duplicate readers cannot remove another reader's declared invalidation", async () => {
  let emit!: (event: unknown) => void;
  const host: GuestHost = {
    extensionId: "example",
    call: async () => {
      throw new Error("No RPC");
    },
    onEvent: (_scope, listener) => {
      emit = listener;
      return () => {};
    },
  };
  const root = createWebviewQueryClient(host);
  let reads = 0;
  const read = async () => ++reads;
  const first = root.query({ id: "shared", read, events: ["example.event.changed"] });
  const stop = first.subscribe(() => {});
  await turn();
  expect(root.query({ id: "shared", read })).toBe(first);
  emit({ type: "changed", id: "example.event.changed" });
  await turn();
  expect(reads).toBe(2);
  stop();
  root.dispose();
});

test("switching account authority disposes old snapshots and cannot reuse a colliding account ID", async () => {
  let props = {
    projectId: "same",
    queryScope: { runtimeId: "runtime", accountId: "one", accountOrigin: "https://first" },
  };
  const listeners = new Set<(props: import("pstdio-api-contracts/extension-kernel").WebviewHostProps) => void>();
  const host: GuestHost = {
    extensionId: "example",
    call: async () => {
      throw new Error("No RPC");
    },
    propsStore: {
      get: () => props as never,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    onEvent: () => () => {},
  };
  const root = createWebviewQueryClient(host);
  const first = root.query({ id: "private", read: async () => "first account" });
  const stop = first.subscribe(() => {});
  await turn();
  props = { ...props, queryScope: { ...props.queryScope, accountOrigin: "https://second" } };
  for (const listener of listeners) listener(props as never);
  expect(first.getSnapshot().data).toBeUndefined();
  const second = root.query({ id: "private", read: async () => "second account" });
  expect(second).not.toBe(first);
  expect(second.getSnapshot().data).toBeUndefined();
  stop();
  root.dispose();
});

test("disposing an old query handle again cannot orphan the replacement root", () => {
  const listeners = new Set<(event: unknown) => void>();
  const host: GuestHost = {
    call: async () => undefined as never,
    onEvent: (_scope, listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const old = createWebviewQueryClient(host);
  old.dispose();
  const replacement = createWebviewQueryClient(host);
  old.dispose();
  const again = createWebviewQueryClient(host);
  const descriptor = { id: "shared", read: async () => 1 };
  expect(again.query(descriptor)).toBe(replacement.query(descriptor));
  expect(listeners.size).toBe(1);
  replacement.dispose();
  again.dispose();
  expect(listeners.size).toBe(0);
});
