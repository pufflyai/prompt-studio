import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/query-core";
import { PstdioApiError, PstdioConnectionError } from "../client/request";
import { createScopedQueryClient } from "./scoped-query";

test("shared page reads retain their snapshot and recover silently after connection failures", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "example" }, { client });
  let attempts = 0;
  const query = queries.forScope({}).query({
    id: "tickets",
    read: () => {
      attempts++;
      if (attempts > 1 && attempts <= 6) throw new PstdioConnectionError(new TypeError("Failed to fetch"));
      return [attempts === 1 ? "loaded ticket" : "recovered ticket"];
    },
  });
  const snapshots: ReturnType<typeof query.getSnapshot>[] = [];
  const stop = query.subscribe(() => snapshots.push(query.getSnapshot()));
  try {
    expect(await query.read()).toEqual(["loaded ticket"]);
    snapshots.length = 0;
    query.invalidate();
    const first = query.read();
    const second = query.read();
    expect(first).toBe(second);
    expect(await first).toEqual(["recovered ticket"]);
    expect(attempts).toBe(7);
    expect(snapshots.every((snapshot) => !snapshot.error)).toBe(true);
    expect(
      snapshots.filter((snapshot) => snapshot.fetching).every((snapshot) => snapshot.data?.[0] === "loaded ticket"),
    ).toBe(true);
  } finally {
    stop();
    queries.dispose();
  }
});

test("disposing an initially disconnected query cancels pending recovery", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "example" }, { client });
  const failed = Promise.withResolvers<void>();
  const query = queries.forScope({}).query({
    id: "extensions",
    read: () => {
      failed.resolve();
      throw new PstdioConnectionError(new TypeError("Failed to fetch"));
    },
  });
  const stop = query.subscribe(() => {});
  const pending = query.read();
  const outcome = pending.catch((error: unknown) => error);
  await failed.promise;
  expect(query.getSnapshot().error).toBeUndefined();
  expect(query.getSnapshot().loading).toBe(true);
  stop();
  queries.dispose();
  expect(await outcome).toBeInstanceOf(Error);
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});

test("page reads keep actionable API errors instead of retrying them forever", async () => {
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "example" });
  const failure = new PstdioApiError("The view has an invalid filter.", 400);
  let attempts = 0;
  const query = queries.forScope({}).query({
    id: "tickets",
    read: () => {
      attempts++;
      throw failure;
    },
  });
  try {
    await expect(query.read()).rejects.toBe(failure);
    expect(attempts).toBe(1);
    expect(query.getSnapshot().error).toBe(failure);
  } finally {
    queries.dispose();
  }
});

test("leaving the last observing page stops connection recovery", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "example" }, { client });
  const failed = Promise.withResolvers<void>();
  const query = queries.query({
    id: "tickets",
    read: () => {
      failed.resolve();
      throw new PstdioConnectionError(new TypeError("Failed to fetch"));
    },
  });
  const stop = query.subscribe(() => {});
  try {
    await failed.promise;
    stop();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(query.active()).toBe(false);
    expect(client.isFetching()).toBe(0);
  } finally {
    stop();
    queries.dispose();
  }
});
