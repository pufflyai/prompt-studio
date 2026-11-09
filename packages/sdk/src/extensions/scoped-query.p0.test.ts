import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/query-core";
import { createScopedQueryClient, type ScopedQuery } from "./scoped-query";

const scope = { runtimeId: "runtime", projectId: "a", extensionId: "example" };
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("scoped storage resets invalidate only matching extension records, including descriptors without event IDs", async () => {
  const root = createScopedQueryClient(scope);
  const reads = new Map<string, number>();
  const observe = (id: string, extensionId: string, projectId: string, recordId: string) => {
    const query = root.forScope({ extensionId, projectId }).query({
      id,
      dependency: { recordId },
      read: () => {
        reads.set(id, (reads.get(id) ?? 0) + 1);
        return id;
      },
    });
    return query.subscribe(() => {});
  };
  const stops = [
    observe("presentation", "marmalade", "a", "presentation"),
    observe("document", "marmalade", "a", "document"),
    observe("other", "notes", "a", "presentation"),
    observe("project", "marmalade", "b", "presentation"),
  ];
  await turn();
  root.invalidate({ type: "reset", projectId: "a", extensionId: "marmalade", recordIds: ["presentation"] });
  await turn();
  expect(Object.fromEntries(reads)).toEqual({ presentation: 2, document: 1, other: 1, project: 1 });
  for (const stop of stops) stop();
  root.dispose();
});

test("shared queries retain opaque node metadata through changed reads and accepted values", async () => {
  const source = Symbol("provider");
  const original = { id: "node" };
  let label = "One";
  const node = () =>
    Object.defineProperty({ id: "node", label, [source]: original }, "tooltip", {
      get: () => label,
      enumerable: true,
    });
  const root = createScopedQueryClient(scope);
  const query = root.query({ id: "opaque", read: async () => [{ nodes: [node()], stable: { id: "stable" } }] });
  await query.read();
  const first = query.getSnapshot().data!;
  label = "Two";
  query.invalidate();
  await query.read();
  const next = query.getSnapshot().data!;
  expect(next[0].nodes[0][source]).toBe(original);
  expect(Object.getOwnPropertyDescriptor(next[0].nodes[0], "tooltip")?.get).toBeFunction();
  expect(next[0].stable).toBe(first[0].stable);
  query.accept([{ nodes: [node()], stable: { id: "stable" } }]);
  expect(query.getSnapshot().data![0].nodes[0][source]).toBe(original);
  root.dispose();
});

test("shared query observers subscribe before reading, coalesce bursts and reject stale completions", async () => {
  const events = new Set<() => void>();
  const requests: ReturnType<typeof Promise.withResolvers<number>>[] = [];
  const root = createScopedQueryClient(scope);
  const descriptor = {
    id: "read",
    read: async () => {
      expect(events.size).toBe(1);
      const pending = Promise.withResolvers<number>();
      requests.push(pending);
      return pending.promise;
    },
    subscribe: (refresh: () => void) => {
      events.add(refresh);
      return () => {
        events.delete(refresh);
      };
    },
  };
  const first = root.query(descriptor);
  expect(root.query(descriptor)).toBe(first);
  const values: number[] = [];
  const stop = first.subscribe(() => {
    const value = first.getSnapshot().data;
    if (value !== undefined) values.push(value);
  });
  const stopTwo = first.subscribe(() => {});
  expect(events.size).toBe(1);
  expect(requests).toHaveLength(1);
  for (let i = 0; i < 100; i++) for (const event of events) event();
  requests[0].resolve(1);
  await turn();
  expect(requests).toHaveLength(2);
  expect(values).not.toContain(1);
  requests[1].resolve(2);
  await turn();
  expect(first.getSnapshot().data).toBe(2);
  stop();
  stopTwo();
  expect(events.size).toBe(0);
  root.dispose();
});

test("warm remounts reuse empty data while scopes, missed events and authoritative updates stay isolated", async () => {
  const root = createScopedQueryClient(scope, { maxInactive: 2 });
  let reads = 0;
  const query = root.query({
    id: "empty",
    read: async () => {
      reads++;
      return [] as string[];
    },
  });
  const stop = query.subscribe(() => {});
  await turn();
  stop();
  const again = query.subscribe(() => {});
  expect(query.getSnapshot().data).toEqual([]);
  expect(query.getSnapshot().loading).toBe(false);
  await turn();
  expect(reads).toBe(1);
  const other = root.forScope({ ...scope, projectId: "b" }).query({ id: "empty", read: async () => ["b"] });
  expect(other.getSnapshot().data).toBeUndefined();
  await other.read();
  expect(query.getSnapshot().data).toEqual([]);
  query.invalidate();
  await turn();
  expect(reads).toBe(2);
  again();
  root.dispose();
});

test("an authoritative mutation or live snapshot wins an older in-flight read", async () => {
  const root = createScopedQueryClient(scope);
  const pending = Promise.withResolvers<string>();
  const query = root.query({ id: "document", read: () => pending.promise });
  const stop = query.subscribe(() => {});
  query.accept("newer");
  await turn();
  expect(query.getSnapshot().fetching).toBe(false);
  pending.resolve("old");
  await turn();
  expect(query.getSnapshot().data).toBe("newer");
  stop();
  root.dispose();
});

test("inactive snapshots are bounded and explicit disposal cancels obsolete work", async () => {
  const root = createScopedQueryClient(scope, { maxInactive: 2 });
  for (let i = 0; i < 10; i++) {
    const query = root.query({ id: String(i), read: async () => i });
    const stop = query.subscribe(() => {});
    await turn();
    stop();
  }
  expect(root.inspect().retained).toBeLessThanOrEqual(2);
  expect(root.inspect().active).toBe(0);
  const query = root.query({
    id: "late",
    read: async (signal) => {
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      signal.throwIfAborted();
      return 1;
    },
  });
  query.subscribe(() => {});
  root.dispose();
  await turn();
  expect(root.inspect().retained).toBe(0);
});

test("unread preparation cannot evict an entered one-shot read, and settlement restores the inactive bound", async () => {
  const root = createScopedQueryClient(scope, { maxInactive: 1 });
  const gate = Promise.withResolvers<string>();
  const entered = Promise.withResolvers<AbortSignal>();
  const first = root.query({ id: "loaded", read: () => "loaded" });
  await first.read();
  const pending = root.query({
    id: "pending",
    read: async (signal) => {
      entered.resolve(signal);
      return gate.promise;
    },
  });
  const completed = pending.read().then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    const signal = await entered.promise;
    root.query({ id: "preparation", read: () => null });
    expect(signal.aborted).toBe(false);
    expect(pending.isDisposed()).toBe(false);
    gate.resolve("accepted");
    expect(await completed).toEqual({ value: "accepted" });
    expect(root.inspect()).toEqual({ retained: 1, active: 0 });
  } finally {
    gate.resolve("accepted");
    await completed;
    root.dispose();
  }
});

test("a one-shot reader publishes its admission before reentrant query preparation", async () => {
  const root = createScopedQueryClient(scope, { maxInactive: 0 });
  try {
    const query = root.query({
      id: "reading",
      read: () => {
        root.query({ id: "prepared inside the source", read: () => null });
        return "accepted";
      },
    });
    expect(await query.read()).toBe("accepted");
    expect(root.inspect()).toEqual({ active: 0, retained: 0 });
  } finally {
    root.dispose();
  }
});

test("explicit disposal removes its owner without evicting a later replacement or retained sibling", async () => {
  const root = createScopedQueryClient(scope);
  const descriptor = { id: "document", read: async () => "accepted" };
  const previous = root.query(descriptor);
  const sibling = root.query({ id: "sibling", read: async () => "sibling" });
  await Promise.all([previous.read(), sibling.read()]);
  expect(root.inspect().retained).toBe(2);
  previous.dispose();
  expect(root.inspect().retained).toBe(1);
  const replacement = root.query(descriptor);
  await replacement.read();
  previous.dispose();
  expect(root.inspect().retained).toBe(2);
  expect(replacement.getSnapshot().data).toBe("accepted");
  expect(sibling.getSnapshot().data).toBe("sibling");
  root.dispose();
});

test("a synchronous disposal listener can rebind and seed the same query without losing its canonical value", async () => {
  const client = new QueryClient();
  const root = createScopedQueryClient(scope, { client });
  let reads = 0;
  const descriptor = { id: "document", read: async () => ++reads };
  const previous = root.query(descriptor);
  let replacement: ScopedQuery<number> | undefined;
  previous.subscribe(
    () => {
      if (!previous.isDisposed()) return;
      replacement = root.query(descriptor);
      replacement.accept(2);
    },
    { automatic: false },
  );
  previous.accept(1);
  previous.dispose();
  expect(root.inspect().retained).toBe(1);
  expect(client.getQueryData(previous.key)).toBe(2);
  expect(await replacement!.read()).toBe(2);
  expect(reads).toBe(0);
  root.dispose();
});

test("a read abort callback can rebind and seed the same query after its old cache entry retires", async () => {
  const client = new QueryClient();
  const root = createScopedQueryClient(scope, { client });
  const started = Promise.withResolvers<void>();
  let replacement: ScopedQuery<number> | undefined;
  let reads = 0;
  const descriptor = { id: "document", read: async () => ++reads };
  const previous = root.query({
    ...descriptor,
    read: (signal) =>
      new Promise<number>((resolve) => {
        signal.addEventListener("abort", () => {
          replacement = root.query(descriptor);
          replacement.accept(2);
          resolve(1);
        });
        started.resolve();
      }),
  });
  const pending = previous.read().catch(() => undefined);
  await started.promise;
  previous.dispose();
  await pending;
  expect(root.inspect().retained).toBe(1);
  expect(client.getQueryData(previous.key)).toBe(2);
  expect(await replacement!.read()).toBe(2);
  expect(reads).toBe(0);
  root.dispose();
});

test.each([
  "dispose",
  "scope",
  "authority",
] as const)("query retirement clears every private owner despite failing cleanup and notification: %s", (operation) => {
  const client = new QueryClient();
  const root = createScopedQueryClient(scope, {
    client,
    subscribe: () => () => {
      throw new Error("root cleanup failed");
    },
  });
  const first = root.query({
    id: "first",
    read: async () => "private",
    subscribe: () => () => {
      throw new Error("source cleanup failed");
    },
  });
  const second = root.query({ id: "second", read: async () => "private" });
  let retiredNotices = 0;
  for (const owner of [first, second]) {
    owner.subscribe(
      () => {
        if (!owner.isDisposed()) return;
        retiredNotices++;
        if (owner === first) throw new Error("consumer cleanup failed");
      },
      { automatic: false },
    );
    owner.accept("private");
  }
  expect(() => {
    if (operation === "dispose") root.dispose();
    if (operation === "scope") root.clearScope({ projectId: "a" });
    if (operation === "authority") root.setAuthority({ accountId: "another-account" });
  }).toThrow();
  expect(retiredNotices).toBe(2);
  expect(first.getSnapshot().data).toBeUndefined();
  expect(second.getSnapshot().data).toBeUndefined();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
  expect(root.inspect().retained).toBe(0);
  try {
    root.dispose();
  } catch {}
});

test("a source detached while inactive is reconciled on remount instead of trusted forever", async () => {
  const root = createScopedQueryClient(scope);
  let value = "before";
  let emit: (() => void) | undefined;
  const query = root.query({
    id: "missed",
    read: async () => value,
    subscribe: (listener) => {
      emit = listener;
      return () => {
        emit = undefined;
      };
    },
  });
  const stop = query.subscribe(() => {});
  await turn();
  stop();
  value = "after";
  emit?.();
  const again = query.subscribe(() => {});
  await turn();
  expect(query.getSnapshot().data).toBe("after");
  again();
  root.dispose();
});

test("accepted state wins even between queryFn completion and the cache success commit", async () => {
  const root = createScopedQueryClient(scope);
  const pending = Promise.withResolvers<string>();
  const query = root.query({ id: "success-boundary", read: () => pending.promise });
  const values: (string | undefined)[] = [];
  const stop = query.subscribe(() => values.push(query.getSnapshot().data));
  pending.resolve("old");
  queueMicrotask(() => query.accept("newer"));
  await turn();
  expect(query.getSnapshot().data).toBe("newer");
  expect(values).not.toContain("old");
  stop();
  root.dispose();
});

test("an invalidation at the cache commit boundary still queues one trailing read", async () => {
  const root = createScopedQueryClient(scope);
  const pending = Promise.withResolvers<string>();
  let reads = 0;
  const query = root.query({
    id: "event-boundary",
    read: () => (++reads === 1 ? pending.promise : Promise.resolve("newer")),
  });
  const values: (string | undefined)[] = [];
  const stop = query.subscribe(() => values.push(query.getSnapshot().data));
  pending.resolve("old");
  queueMicrotask(query.invalidate);
  await turn();
  expect(reads).toBe(2);
  expect(query.getSnapshot().data).toBe("newer");
  expect(values).not.toContain("old");
  stop();
  root.dispose();
});

test("explicitly disposed queries reopen, zero retention admits a first observer, and disposal clears snapshots", async () => {
  const root = createScopedQueryClient(scope, { maxInactive: 0 });
  const descriptor = { id: "no-retention", read: async () => "value" };
  const first = root.query(descriptor);
  const stop = first.subscribe(() => {});
  await turn();
  expect(first.getSnapshot().data).toBe("value");
  stop();
  expect(first.getSnapshot().data).toBeUndefined();
  const second = root.query(descriptor);
  expect(second).not.toBe(first);
  second.dispose();
  const third = root.query(descriptor);
  expect(third).not.toBe(second);
  root.dispose();
});

test("replacement reads wait for cancelled children that cannot abort, including owner eviction", async () => {
  const root = createScopedQueryClient(scope);
  const requests: ReturnType<typeof Promise.withResolvers<string>>[] = [];
  const descriptor = {
    id: "uncooperative",
    read: () => {
      const pending = Promise.withResolvers<string>();
      requests.push(pending);
      return pending.promise;
    },
  };
  const first = root.query(descriptor);
  first.subscribe(() => {});
  first.accept("accepted");
  first.invalidate();
  await turn();
  expect(requests).toHaveLength(1);
  first.dispose();
  const replacement = root.query(descriptor);
  const stop = replacement.subscribe(() => {});
  await turn();
  expect(requests).toHaveLength(1);
  requests[0].resolve("old");
  await turn();
  expect(requests).toHaveLength(2);
  requests[1].resolve("current");
  await turn();
  expect(replacement.getSnapshot().data).toBe("current");
  stop();
  root.dispose();
});

test.each([
  false,
  true,
])("accepted state survives every cache success/error microtask boundary (failure: %s)", async (failure) => {
  for (let delay = 0; delay < 12; delay++) {
    const root = createScopedQueryClient(scope);
    const pending = Promise.withResolvers<string>();
    const query = root.query({ id: "all-boundaries", read: () => pending.promise });
    const accepted: { data?: string; error?: Error }[] = [];
    let authority = false;
    const stop = query.subscribe(() => {
      if (authority) accepted.push(query.getSnapshot());
    });
    if (failure) pending.reject(new Error("obsolete failure"));
    else pending.resolve("obsolete value");
    let boundary = Promise.resolve();
    for (let index = 0; index < delay; index++) boundary = boundary.then(() => {});
    void boundary.then(() => {
      authority = true;
      query.accept("accepted");
    });
    await turn();
    expect(query.getSnapshot().data).toBe("accepted");
    expect(query.getSnapshot().error).toBeUndefined();
    expect(accepted.every((snapshot) => snapshot.data === "accepted" && !snapshot.error)).toBe(true);
    stop();
    root.dispose();
  }
});

test("revoked owners stay empty after warm promises and accepted children finish", async () => {
  const root = createScopedQueryClient(scope);
  const warm = root.query({ id: "warm-revoked", read: async () => "private" });
  const first = warm.subscribe(() => {});
  await turn();
  first();
  warm.subscribe(() => {});
  root.clearScope({});
  await turn();
  expect(warm.isDisposed()).toBe(true);
  expect(warm.getSnapshot()).toEqual({ data: undefined, loading: false, fetching: false });
  const child = Promise.withResolvers<string>();
  const pending = root.query({ id: "pending-revoked", read: () => child.promise });
  pending.subscribe(() => {});
  pending.accept("private");
  root.clearScope({});
  await turn();
  child.resolve("older private");
  await turn();
  expect(pending.getSnapshot()).toEqual({ data: undefined, loading: false, fetching: false });
  root.dispose();
});

test("equal reads retain the canonical snapshot identity across refreshes", async () => {
  const root = createScopedQueryClient(scope);
  const query = root.query({ id: "equal", read: async () => ({ items: [{ id: "one", name: "same" }] }) });
  const stop = query.subscribe(() => {});
  await turn();
  const first = query.getSnapshot().data;
  query.invalidate();
  await turn();
  expect(query.getSnapshot().data).toBe(first);
  stop();
  root.dispose();
});

test("authority purges leave synchronously rebound owners outside the retired set", async () => {
  const root = createScopedQueryClient(scope);
  const first = root.forScope({ accountId: "a" }).query({ id: "private", read: async () => "a" });
  let replacement: ReturnType<typeof root.query<string>> | undefined;
  first.subscribe(() => {
    if (!first.isDisposed() || replacement) return;
    replacement = root.forScope({ accountId: "b" }).query({ id: "private", read: async () => "b" });
    replacement.subscribe(() => {});
  });
  await turn();
  root.clearScope({});
  await turn();
  expect(first.getSnapshot().data).toBeUndefined();
  expect(replacement?.isDisposed()).toBe(false);
  expect(replacement?.getSnapshot().data).toBe("b");
  root.dispose();
});

test("passive observations protect scheduled presentations without admitting reads and count equal callbacks independently", async () => {
  const root = createScopedQueryClient(scope);
  let reads = 0;
  const query = root.query({ id: "scheduled", read: async () => ++reads });
  const listener = () => {};
  const passive = query.subscribe(listener, { automatic: false });
  query.invalidate();
  await turn();
  expect(reads).toBe(0);
  const first = query.subscribe(listener);
  const second = query.subscribe(listener);
  await turn();
  expect(reads).toBe(1);
  expect(query.inspect()).toMatchObject({ observers: 3, automaticObservers: 2 });
  first();
  expect(query.inspect().automaticObservers).toBe(1);
  second();
  query.invalidate();
  await turn();
  expect(reads).toBe(1);
  expect(root.inspect().active).toBe(1);
  passive();
  root.dispose();
});

test("authority updates revoke old snapshots before a synchronous rebind and keys use the new authority", async () => {
  const root = createScopedQueryClient({ ...scope, accountId: "a" });
  const descriptor = { id: "private", read: async () => "value" };
  const first = root.query(descriptor);
  await first.read();
  root.setAuthority({ accountId: "b", accountOrigin: "https://account" });
  const second = root.query(descriptor);
  expect(first.getSnapshot().data).toBeUndefined();
  expect(second.key.slice(2, 4)).toEqual(["b", "https://account"]);
  expect(second.getSnapshot().data).toBeUndefined();
  root.setAuthority({ accountId: "b", accountOrigin: "https://account" });
  expect(root.query(descriptor)).toBe(second);
  root.dispose();
});

test("undefined results report a finite error instead of suppressing it as a successful empty read", async () => {
  const root = createScopedQueryClient(scope);
  let reads = 0;
  const query = root.query({
    id: "undefined",
    read: async () => {
      reads++;
      return undefined;
    },
  });
  const stop = query.subscribe(() => {});
  await turn();
  expect(reads).toBe(1);
  expect(query.getSnapshot().fetching).toBe(false);
  expect(query.getSnapshot().error?.message).toContain("use null");
  stop();
  root.dispose();
});

test("compound record dependencies coalesce their source records and ignore presentation-only changes", async () => {
  const root = createScopedQueryClient(scope);
  let reads = 0;
  const query = root.query({
    id: "compound",
    dependency: { recordIds: ["document", "history", "legacy"] },
    read: () => ++reads,
  });
  const stop = query.subscribe(() => {});
  await turn();
  root.invalidate({ type: "reset", recordIds: ["presentation"] });
  await turn();
  expect(reads).toBe(1);
  root.invalidate({ type: "reset", recordIds: ["legacy", "history"] });
  await turn();
  expect(reads).toBe(2);
  stop();
  root.dispose();
});

test("paired delivery in one turn admits one automatic reconciliation", async () => {
  const root = createScopedQueryClient(scope);
  let reads = 0;
  const query = root.query({ id: "paired", dependsOn: ["changed"], read: () => ++reads });
  const stop = query.subscribe(() => {});
  await turn();
  root.invalidate({ type: "changed", id: "changed" });
  query.invalidate();
  await turn();
  expect(reads).toBe(2);
  stop();
  root.dispose();
});

test("an adapter can suspend old read admission before reconciling its changed parameters", async () => {
  const root = createScopedQueryClient(scope);
  let reads = 0;
  const query = root.query({ id: "page", read: () => ++reads });
  let stop = query.subscribe(() => {});
  await turn();
  const release = query.subscribeInvalidation(() => {
    stop();
  });
  query.invalidate();
  await turn();
  expect(reads).toBe(1);
  release();
  stop = query.subscribe(() => {});
  await turn();
  expect(reads).toBe(2);
  stop();
  root.dispose();
});

test("invalidation observes independent handles and snapshots reentrant registrations and owners", async () => {
  const root = createScopedQueryClient(scope);
  const descriptor = { id: "reentrant invalidation", dependsOn: ["changed"], read: () => "value" };
  const query = root.query(descriptor);
  let notices = 0;
  const listener = () => {
    notices++;
    root.query(descriptor);
  };
  const first = query.subscribeInvalidation(listener);
  const second = query.subscribeInvalidation(listener);
  first();
  root.invalidate({ type: "changed", id: "changed" });
  expect(notices).toBe(1);
  expect(query.inspect().revision).toBe(1);
  second();
  let stop = () => {};
  const rebound = () => {
    notices++;
    stop();
    stop = query.subscribeInvalidation(rebound);
  };
  stop = query.subscribeInvalidation(rebound);
  query.invalidate();
  expect(notices).toBe(2);
  stop();
  root.dispose();
});

test("a failed invalidation callback cannot strand its query, sibling callbacks or matching owners", async () => {
  const root = createScopedQueryClient(scope);
  const reads = { a: 0, b: 0 };
  const a = root.query({ id: "callback a", dependsOn: ["changed"], read: () => ++reads.a });
  const b = root.query({ id: "callback b", dependsOn: ["changed"], read: () => ++reads.b });
  const stops = [a.subscribe(() => {}), b.subscribe(() => {})];
  await turn();
  a.subscribeInvalidation(() => {
    throw new Error("Adapter failed");
  });
  let notified = false;
  a.subscribeInvalidation(() => {
    notified = true;
  });
  expect(() => root.invalidate({ type: "changed", id: "changed" })).toThrow("Adapter failed");
  await turn();
  expect(notified).toBe(true);
  expect(reads).toEqual({ a: 2, b: 2 });
  for (const stop of stops) stop();
  root.dispose();
});
