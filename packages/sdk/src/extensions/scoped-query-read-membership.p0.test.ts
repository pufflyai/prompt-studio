import { expect, test } from "bun:test";
import { createScopedQueryClient } from "./scoped-query";

test("cancelling a finite optional read preserves a peer and aborts the actual child only after the final member leaves", async () => {
  const client = createScopedQueryClient({ runtimeId: "members", extensionId: "test" });
  const entered = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  let reads = 0;
  const query = client.query({
    id: "held",
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
      return "old";
    },
  });
  const a = new AbortController(),
    b = new AbortController();
  const first = query.read(a.signal);
  const second = query.read(b.signal);
  try {
    await entered.promise;
    a.abort(new Error("first left"));
    await expect(first).rejects.toThrow("first left");
    expect(query.inspect().automaticObservers).toBe(1);
    expect(reads).toBe(1);
    expect(query.active()).toBe(true);
    b.abort(new Error("last left"));
    await expect(second).rejects.toThrow("last left");
    await cancelled.promise;
    expect(query.inspect().automaticObservers).toBe(0);
  } finally {
    a.abort();
    b.abort();
    client.dispose();
  }
});

test("an already-cancelled refresh cannot invalidate a peer, including falsey cancellation reasons", async () => {
  const client = createScopedQueryClient({ runtimeId: "cancelled-refresh", extensionId: "test" });
  let reads = 0;
  const query = client.query({ id: "value", read: async () => ++reads });
  const stop = query.subscribe(() => {});
  try {
    expect(await query.read()).toBe(1);
    for (const reason of [0, false, ""]) {
      const abort = new AbortController();
      abort.abort(reason);
      const result = await query.refresh(abort.signal).then(
        () => ({ ok: true }),
        (error) => ({ ok: false, error }),
      );
      expect(result).toEqual({ ok: false, error: reason });
      expect(query.inspect().stale).toBe(false);
      expect(reads).toBe(1);
    }
  } finally {
    stop();
    client.dispose();
  }
});

test("cancellation settles and releases every membership even when another source cleanup throws", async () => {
  const { readScopedQueryMembership } = await import("./scoped-query-read-membership");
  const abort = new AbortController();
  let releases = 0;
  const result = readScopedQueryMembership(
    {
      getSnapshot: () => ({ data: undefined, fetching: true, loading: true }),
      inspect: () => ({ stale: true }),
      isDisposed: () => false,
      subscribe: () => () => {
        releases++;
        throw new Error("broken cleanup");
      },
      subscribeInvalidation: () => () => {
        releases++;
      },
    },
    abort.signal,
  );
  abort.abort(0);
  expect(
    await result.then(
      () => ({ ok: true }),
      (error) => ({ ok: false, error }),
    ),
  ).toEqual({ ok: false, error: 0 });
  expect(releases).toBe(2);
});
