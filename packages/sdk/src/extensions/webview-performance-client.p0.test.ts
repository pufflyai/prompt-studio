import { expect, test } from "bun:test";
import type { GuestHost } from "./guest-host";
import { createWebviewPerformanceClient } from "./webview-performance-client";

test("concurrent clients share a subscription and only the last disposal unsubscribes", async () => {
  const requests: unknown[] = [];
  const listeners = new Set<(value: unknown) => void>();
  const host: GuestHost = {
    call: async <T>(_capability: string, params?: unknown) => {
      requests.push(params);
      return undefined as T;
    },
    onEvent: (_scope, listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const values: unknown[] = [];
  const [first, second] = await Promise.all([
    createWebviewPerformanceClient(host).subscribe((value) => values.push(value)),
    createWebviewPerformanceClient(host).subscribe((value) => values.push(value)),
  ]);
  expect(requests).toEqual([{ operation: "subscribe" }]);
  for (const listener of listeners) listener(null);
  expect(values).toEqual([null, null]);
  await first();
  await first();
  expect(listeners.size).toBe(1);
  expect(requests).toHaveLength(1);
  await second();
  expect(requests).toEqual([{ operation: "subscribe" }, { operation: "unsubscribe" }]);
  expect(listeners.size).toBe(0);
});
