import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import type { WebviewAccountQuery } from "pstdio-api-contracts/extension-kernel";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench } from "../../core";
import { registerWorkbenchRequiredWork } from "../../core/workbench-required-work";
import { createWebviewServiceQueryAdapter } from "./webview-service-queries";

test("core retirement releases only its service members while required writes drain and a peer survives", async () => {
  const root = createScopedQueryClient({ runtimeId: "service-retirement", extensionId: "account" });
  const a = createWorkbench({ queries: root }),
    b = createWorkbench({ queries: root });
  a.pageLocations.setProject("a");
  b.pageLocations.setProject("a");
  const entered = Promise.withResolvers<void>(),
    cancelled = Promise.withResolvers<void>(),
    save = Promise.withResolvers<void>();
  registerWorkbenchRequiredWork(a, () => save.promise);
  let reads = 0;
  const query = root.query({
    id: "sync",
    read: async (signal) => {
      reads++;
      entered.resolve();
      await new Promise<void>((resolve) =>
        signal.addEventListener(
          "abort",
          () => {
            cancelled.resolve();
            resolve();
          },
          { once: true },
        ),
      );
      signal.throwIfAborted();
      return "obsolete";
    },
  });
  const source: WebviewAccountQuery = { service: "projectSyncStatus", projectId: "a" };
  const eventsA = createHostEventPublisher(),
    eventsB = createHostEventPublisher();
  eventsA.bind(() => {});
  eventsB.bind(() => {});
  const adapter = (workbench: typeof a, events: typeof eventsA, owner: string) =>
    createWebviewServiceQueryAdapter({
      workbench,
      projectId: "a",
      channel: "account.query",
      events,
      owner,
      requireCurrent() {},
      source: () => query,
      sources: () => [{ source, query }],
    });
  const first = adapter(a, eventsA, "a"),
    second = adapter(b, eventsB, "b");
  let closing: Promise<void> | undefined;
  try {
    await first.request({ operation: "observe", owner: "a", requestId: "a", source });
    await second.request({ operation: "observe", owner: "b", requestId: "b", source });
    await entered.promise;
    let disposed = false;
    closing = a.dispose().then(() => {
      disposed = true;
    });
    expect(query.inspect().automaticObservers).toBe(1);
    expect(query.isDisposed()).toBe(false);
    expect(reads).toBe(1);
    expect(disposed).toBe(false);
    await expect(first.request({ operation: "read", owner: "a", requestId: "late", source })).rejects.toThrow(
      /closed|inactive/,
    );
    await second.request({ operation: "close", owner: "b", requestId: "b" });
    await cancelled.promise;
    expect(query.inspect().automaticObservers).toBe(0);
    save.resolve();
    await closing;
    expect(disposed).toBe(true);
  } finally {
    save.resolve();
    eventsA.unbind();
    eventsB.unbind();
    await closing;
    await a.dispose();
    await b.dispose();
    root.dispose();
  }
});

test("surviving account identity authority retires old projections and cannot seed the replacement identity under an old owner", async () => {
  const root = createScopedQueryClient({ runtimeId: "identity-service", extensionId: "account" });
  let authority = "a";
  const query = root.query({ id: "status", read: () => ({ identity: authority }) });
  query.accept({ identity: "a" });
  const guard = query.subscribe(() => {
    const value = query.getSnapshot().data;
    if (value) authority = value.identity;
  });
  const events = createHostEventPublisher();
  const published: unknown[] = [];
  events.bind((event) => published.push(event.payload));
  const source: WebviewAccountQuery = { service: "status" };
  const adapter = createWebviewServiceQueryAdapter({
    channel: "account.query",
    owner: "a",
    events,
    requireCurrent() {
      if (authority !== "a") throw new Error("old authority");
    },
    source: () => query,
    sources: () => [{ source, query }],
  });
  try {
    await adapter.request({ operation: "observe", owner: "a", requestId: "old", source });
    query.accept({ identity: "b" });
    expect(published.at(-1)).toMatchObject({ requestId: "old", snapshot: { retired: true } });
    expect(adapter.seeds().values).toEqual([]);
    expect(query.getSnapshot().data).toEqual({ identity: "b" });
    expect(query.inspect().automaticObservers).toBe(1);
    await expect(adapter.request({ operation: "read", owner: "a", requestId: "late", source })).rejects.toThrow(
      "old authority",
    );
  } finally {
    guard();
    events.unbind();
    root.dispose();
  }
});
