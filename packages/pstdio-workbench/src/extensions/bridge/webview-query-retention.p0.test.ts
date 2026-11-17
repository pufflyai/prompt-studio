import { expect, test } from "bun:test";
import { createScopedQueryClient, createWebviewClient, defineCommand, type GuestHost } from "@pstdio/sdk/extensions";
import type { WebviewHostCapability, WebviewHostProps } from "pstdio-api-contracts/extension-kernel";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench, type WorkbenchCore } from "../../core";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";
import { createWebviewCommandQueryAdapter } from "./webview-command-queries";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const definitions = { read: defineCommand({ id: "read", title: "Read", run: () => ({ project: "", title: "" }) }) };
const fixture = (maxInactive = 512) => {
  const queries = createScopedQueryClient(
    { runtimeId: "runtime", accountId: "one", extensionId: "pstdio" },
    { maxInactive },
  );
  const reads = new Map<string, number>();
  const titles = new Map<string, string>();
  let held: Promise<void> | undefined;
  let enteredSignal: AbortSignal | undefined;
  let failure: Error | undefined;
  const frame = (projectId: string, source = "module-v1", workbench?: WorkbenchCore) => {
    const events = createHostEventPublisher();
    const listeners = new Map<string, Set<(payload: unknown) => void>>();
    const propsListeners = new Set<(props: WebviewHostProps) => void>();
    const owner = JSON.stringify([projectId, source]);
    const adapter = createWebviewCommandQueryAdapter({
      queries,
      owner,
      projectId,
      extensionId: "example.tool",
      events,
      workbench,
      requireCurrent() {},
      captureRead() {
        return async (signal) => {
          reads.set(projectId, (reads.get(projectId) ?? 0) + 1);
          enteredSignal = signal;
          if (held) await held;
          signal.throwIfAborted();
          if (failure) throw failure;
          return { project: projectId, title: titles.get(projectId) ?? projectId };
        };
      },
    });
    const capabilities = createExtensionWebviewHostCapabilities({ commandQueries: adapter });
    const props: WebviewHostProps = {
      projectId,
      queryScope: { runtimeId: "runtime", accountId: "one" },
      commandQueries: adapter.seeds(),
      themePreference: "system",
      locale: "en",
      pageParams: {},
      translations: { locale: "en", defaultLocale: "en", bundle: {}, defaultBundle: {} },
    };
    const host: GuestHost = {
      extensionId: "example.tool",
      propsStore: {
        get: () => props,
        subscribe(listener) {
          propsListeners.add(listener);
          return () => {
            propsListeners.delete(listener);
          };
        },
      },
      onEvent(scope, listener) {
        let group = listeners.get(scope);
        if (!group) {
          group = new Set();
          listeners.set(scope, group);
        }
        group.add(listener);
        return () => {
          group.delete(listener);
        };
      },
      call: async (method, ...args) => capabilities[method as WebviewHostCapability](args[0]) as never,
    };
    events.bind((event) => {
      for (const listener of [...(listeners.get(event.scope) ?? [])]) listener(event.payload);
    });
    const client = createWebviewClient<typeof definitions>(host);
    const query = client.commands.read.query(undefined, { events: ["example.tool.event.changed"] });
    return {
      query,
      adapter,
      events,
      dispose() {
        client.queries.dispose();
        events.unbind();
      },
      rotate() {
        props.commandQueries = { owner: "new-account-or-source", values: [] };
        for (const listener of [...propsListeners]) listener(props);
      },
    };
  };
  return {
    queries,
    frame,
    reads,
    titles,
    fail: (error?: Error) => {
      failure = error;
    },
    hold() {
      const next = Promise.withResolvers<void>();
      held = next.promise;
      return () => {
        held = undefined;
        next.resolve();
      };
    },
    signal: () => enteredSignal,
    invalidate: (projectId: string) =>
      queries.invalidate({ type: "changed", id: "example.tool.event.changed", projectId }),
  };
};

test("new A/B/A iframes restore accepted data immediately without repeating warm command reads", async () => {
  const f = fixture();
  const a = f.frame("a");
  expect(f.reads.size).toBe(0);
  const stopA = a.query.subscribe(() => {});
  await turn();
  expect(a.query.getSnapshot().data).toEqual({ project: "a", title: "a" });
  stopA();
  a.dispose();
  const b = f.frame("b");
  expect(b.query.getSnapshot().data).toBeUndefined();
  const stopB = b.query.subscribe(() => {});
  await turn();
  stopB();
  b.dispose();
  expect(f.queries.inspect()).toEqual({ active: 0, retained: 2 });
  const returned = f.frame("a");
  expect(returned.query.getSnapshot().data).toEqual({ project: "a", title: "a" });
  const stop = returned.query.subscribe(() => {});
  await turn();
  expect([...f.reads]).toEqual([
    ["a", 1],
    ["b", 1],
  ]);
  stop();
  returned.dispose();
  f.queries.dispose();
});

test("an inactive scoped event catches up once while retaining content, and refresh updates an active peer", async () => {
  const f = fixture();
  const first = f.frame("a");
  const stopFirst = first.query.subscribe(() => {});
  await turn();
  stopFirst();
  first.dispose();
  f.titles.set("a", "Changed while away");
  f.invalidate("b");
  f.invalidate("a");
  await turn();
  expect(f.reads.get("a")).toBe(1);
  const a = f.frame("a");
  expect(a.query.getSnapshot().data?.title).toBe("a");
  const stopA = a.query.subscribe(() => {});
  const peer = f.frame("a");
  const stopPeer = peer.query.subscribe(() => {});
  await turn();
  expect(f.reads.get("a")).toBe(2);
  expect(a.query.getSnapshot().data?.title).toBe("Changed while away");
  f.titles.set("a", "Explicit refresh");
  await a.query.refresh();
  expect(peer.query.getSnapshot().data?.title).toBe("Explicit refresh");
  expect(f.reads.get("a")).toBe(3);
  stopA();
  stopPeer();
  a.dispose();
  peer.dispose();
  f.queries.dispose();
});

test("closing one held finite reader preserves a peer's shared command", async () => {
  const f = fixture();
  const release = f.hold();
  const first = f.frame("a");
  const peer = f.frame("a");
  const abandoned = first.query.read();
  void abandoned.catch(() => {});
  const accepted = peer.query.read();
  await turn();
  expect(f.reads.get("a")).toBe(1);
  first.dispose();
  await expect(abandoned).rejects.toThrow("closed");
  expect(f.signal()?.aborted).toBe(false);
  release();
  expect(await accepted).toEqual({ project: "a", title: "a" });
  peer.dispose();
  f.queries.dispose();
});

test("a replacement observation waits for the last abandoned actual child to drain", async () => {
  const f = fixture();
  const release = f.hold();
  const first = f.frame("a");
  const stopFirst = first.query.subscribe(() => {});
  await turn();
  const oldSignal = f.signal();
  stopFirst();
  first.dispose();
  await turn();
  expect(oldSignal?.aborted).toBe(true);
  const next = f.frame("a");
  const stopNext = next.query.subscribe(() => {});
  await turn();
  expect(f.reads.get("a")).toBe(1);
  release();
  await turn();
  await turn();
  expect(f.reads.get("a")).toBe(2);
  expect(next.query.getSnapshot().data?.project).toBe("a");
  stopNext();
  next.dispose();
  f.queries.dispose();
});

test("a failed refresh imports the host's newer accepted content and serialized error together", async () => {
  const f = fixture();
  const a = f.frame("a");
  const stopA = a.query.subscribe(() => {});
  await turn();
  f.titles.set("a", "Newest accepted");
  await a.query.refresh();
  f.fail(new Error("Offline"));
  await expect(a.query.refresh()).rejects.toThrow("Offline");
  stopA();
  a.dispose();
  const next = f.frame("a");
  expect(next.query.getSnapshot().data?.title).toBe("Newest accepted");
  expect(next.query.getSnapshot().error?.message).toBe("Offline");
  next.dispose();
  f.queries.dispose();
});

test("account retirement clears active data synchronously and retained source generations stay isolated and bounded", async () => {
  const f = fixture(2);
  const a = f.frame("a");
  const stop = a.query.subscribe(() => {});
  await turn();
  f.queries.setAuthority({ accountId: "two" });
  expect(a.query.getSnapshot().data).toBeUndefined();
  expect(a.query.isDisposed()).toBe(true);
  stop();
  a.dispose();
  for (const project of ["a", "b", "c"]) {
    const frame = f.frame(project);
    const off = frame.query.subscribe(() => {});
    await turn();
    off();
    frame.dispose();
  }
  expect(f.queries.inspect()).toEqual({ active: 0, retained: 2 });
  const evicted = f.frame("a");
  expect(evicted.query.getSnapshot().data).toBeUndefined();
  evicted.dispose();
  const replaced = f.frame("c", "module-v2");
  expect(replaced.query.getSnapshot().data).toBeUndefined();
  replaced.dispose();
  f.queries.dispose();
});

test("one throwing frame cannot prevent a peer from clearing retired account data", async () => {
  const f = fixture();
  const a = f.frame("a");
  const b = f.frame("a");
  const stopA = a.query.subscribe(() => {
    if (a.query.isDisposed()) throw new Error("Guest listener failed");
  });
  const stopB = b.query.subscribe(() => {});
  await turn();
  let error: unknown;
  try {
    f.queries.setAuthority({ accountId: "two" });
  } catch (cause) {
    error = cause;
  }
  try {
    expect(error).toBeDefined();
    expect(a.query.getSnapshot().data).toBeUndefined();
    expect(b.query.getSnapshot().data).toBeUndefined();
    expect(b.query.isDisposed()).toBe(true);
  } finally {
    stopA();
    stopB();
    a.dispose();
    b.dispose();
    f.queries.dispose();
  }
});

test("retiring one core releases its optional finite caller while preserving a surviving core", async () => {
  const f = fixture();
  const release = f.hold();
  const coreA = createWorkbench({ queries: f.queries });
  const coreB = createWorkbench({ queries: f.queries });
  coreA.pageLocations.setProject("a");
  coreB.pageLocations.setProject("a");
  const a = f.frame("a", "module-v1", coreA);
  const b = f.frame("a", "module-v1", coreB);
  let closed = false;
  const pendingA = a.query.read().catch(() => {
    closed = true;
  });
  const pendingB = b.query.read();
  await turn();
  await coreA.dispose();
  await turn();
  try {
    expect(closed).toBe(true);
    expect(f.signal()?.aborted).toBe(false);
    expect(f.reads.get("a")).toBe(1);
  } finally {
    release();
    await Promise.all([pendingA, pendingB]);
    a.dispose();
    b.dispose();
    await coreB.dispose();
    f.queries.dispose();
  }
});

test("built-in finite queries keep private core identity while backend sources remain shared", async () => {
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "pstdio" });
  const a = createWorkbench({ queries });
  const b = createWorkbench({ queries });
  a.pageLocations.setProject("project");
  b.pageLocations.setProject("project");
  const eventsA = createHostEventPublisher();
  const eventsB = createHostEventPublisher();
  const adapter = (workbench: WorkbenchCore, title: string, events: ReturnType<typeof createHostEventPublisher>) =>
    createWebviewCommandQueryAdapter({
      queries,
      workbench,
      owner: "same-project-source",
      projectId: "project",
      extensionId: "example.tool",
      events,
      requireCurrent() {},
      captureRead: () => async () => title,
    });
  const first = adapter(a, "A recents", eventsA);
  const second = adapter(b, "B recents", eventsB);
  const definition = {
    owner: "same-project-source",
    command: { commandId: "workbench.resources.recent" },
    dependsOn: ["view.recent.changed"],
  };
  let current: unknown;
  eventsA.bind((event) => {
    current = (event.payload as { snapshot: { data: unknown } }).snapshot.data;
  });
  await first.request({ ...definition, operation: "observe", requestId: "a" });
  await turn();
  try {
    expect(second.seeds().values).toHaveLength(0);
    expect((await second.request({ ...definition, operation: "read", requestId: "b" }))?.data).toBe("B recents");
    await b.dispose();
    queries.invalidate({ type: "changed", id: "view.recent.changed", projectId: "project" });
    await turn();
    expect(current).toBe("A recents");
  } finally {
    eventsA.unbind();
    eventsB.unbind();
    await a.dispose();
    await b.dispose();
    queries.dispose();
  }
});

test("qualified foreign command events refresh their source without a caller-extension override", async () => {
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "pstdio" });
  const events = createHostEventPublisher();
  events.bind(() => {});
  let reads = 0;
  const adapter = createWebviewCommandQueryAdapter({
    queries,
    owner: "owner",
    projectId: "project",
    extensionId: "caller.a",
    events,
    requireCurrent() {},
    captureRead: () => async () => ++reads,
  });
  await adapter.request({
    operation: "observe",
    requestId: "read",
    owner: "owner",
    command: { commandId: "source.b.command.read" },
    dependsOn: ["source.b.event.changed"],
  });
  await turn();
  queries.invalidate({ type: "changed", id: "source.b.event.changed", extensionId: "source.b", projectId: "project" });
  await turn();
  try {
    expect(reads).toBe(2);
  } finally {
    events.unbind();
    queries.dispose();
  }
});

test("a reentrant refresh retirement cannot admit another optional backend read", async () => {
  const f = fixture();
  const coreA = createWorkbench({ queries: f.queries });
  const coreB = createWorkbench({ queries: f.queries });
  coreA.pageLocations.setProject("a");
  coreB.pageLocations.setProject("a");
  const a = f.frame("a", "module-v1", coreA);
  const b = f.frame("a", "module-v1", coreB);
  const stopB = b.query.subscribe(() => {});
  await turn();
  let retiring: Promise<void> | undefined;
  let armed = true;
  b.events.bind((event) => {
    if (!armed || !(event.payload as { snapshot: { stale: boolean } }).snapshot.stale) return;
    armed = false;
    b.dispose();
    retiring = coreA.dispose();
  });
  try {
    await expect(a.query.refresh()).rejects.toThrow("closed");
    await turn();
    expect(f.reads.get("a")).toBe(1);
  } finally {
    stopB();
    a.dispose();
    b.dispose();
    await retiring;
    await coreA.dispose();
    await coreB.dispose();
    f.queries.dispose();
  }
});
