import { expect, test } from "bun:test";
import type { WebviewCommandQuerySnapshot } from "pstdio-api-contracts/extension-kernel";
import type {
  PerformanceMonitoringState,
  PerformanceReadResult,
  PerformanceRecordingExport,
  PerformanceSnapshot,
} from "pstdio-api-contracts/performance-diagnostics";
import type { GuestHost } from "./guest-host";
import { createWebviewPerformanceClient } from "./webview-performance-client";

test("performance calls preserve legacy result types and separate query snapshots", async () => {
  type LegacyResult = PerformanceMonitoringState | PerformanceSnapshot | PerformanceRecordingExport | null | undefined;
  const host: GuestHost = {
    call: async () => undefined as never,
    onEvent: () => () => {},
  };
  const exportedLegacyResult = undefined as PerformanceReadResult;
  const legacyResult: LegacyResult = exportedLegacyResult;
  const state: Promise<LegacyResult> = host.call("performance.read", { operation: "state" });
  const snapshot: Promise<LegacyResult> = host.call("performance.read", { operation: "snapshot" });
  const query: Promise<WebviewCommandQuerySnapshot | undefined> = host.call("performance.read", {
    operation: "query",
    query: { operation: "read", owner: "view", requestId: "read", source: { service: "snapshot" } },
  });
  expect(legacyResult).toBeUndefined();
  expect(await Promise.all([state, snapshot, query])).toEqual([undefined, undefined, undefined]);
});

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
