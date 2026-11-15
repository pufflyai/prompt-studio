import { expect, test } from "bun:test";
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench } from "../../core";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";
import { createWorkbenchWebviewHostAdapters } from "./webview-host-capabilities";
import type { WebviewOwnedPreferences } from "./webview-preferences-capability";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const fixture = (preferences: WebviewOwnedPreferences) => {
  const core = createWorkbench();
  core.pageLocations.setProject("A");
  const frames = new Set<ReturnType<typeof frame>>();
  const frame = (identity = "installation") => {
    const events = createHostEventPublisher();
    const listeners = new Map<string, Set<(payload: unknown) => void>>();
    const adapters = createWorkbenchWebviewHostAdapters({
      workbench: core,
      projectId: "A",
      extensionId: "owned",
      hostEvents: events,
      ownedPreferences: { ...preferences, identity: [identity] },
    });
    const capabilities = createExtensionWebviewHostCapabilities(adapters);
    const host = {
      extensionId: "owned",
      propsStore: {
        get: () => ({
          projectId: "A",
          queryScope: { runtimeId: "host" },
          serviceQueries: { preferences: adapters.preferenceQueries!.seeds() },
        }),
        subscribe: () => () => {},
      },
      onEvent(scope: string, listener: (payload: unknown) => void) {
        const group = listeners.get(scope) ?? new Set();
        listeners.set(scope, group);
        group.add(listener);
        return () => {
          group.delete(listener);
        };
      },
      call: (method: keyof typeof capabilities, input: never) => capabilities[method](input),
    } as unknown as GuestHost;
    events.bind((event) => {
      for (const listener of [...(listeners.get(event.scope) ?? [])]) listener(event.payload);
    });
    const client = createWebviewClient(host);
    const result = {
      client,
      dispose() {
        client.queries.dispose();
        events.unbind();
        frames.delete(result);
      },
    };
    frames.add(result);
    return result;
  };
  return {
    core,
    frame,
    async dispose() {
      for (const frame of [...frames]) frame.dispose();
      await core.dispose();
    },
  };
};

test("a caller in project A refreshes a legal project-B preference on B's scoped event", async () => {
  let value = "before",
    reads = 0;
  const f = fixture({
    get: async (_name, scope) => {
      expect(scope).toEqual({ scope: "project", scopeId: "B" });
      reads++;
      return value;
    },
    set: () => {},
  });
  const frame = f.frame(),
    query = frame.client.preferences.query("choice", { scope: "project", scopeId: "B" });
  const stop = query.subscribe(() => {});
  try {
    expect((await query.read()).value).toBe("before");
    expect(reads).toBe(1);
    value = "after";
    getWorkbenchQueries(f.core).invalidate({
      type: "changed",
      id: "preferences.changed",
      projectId: "C",
      extensionId: "owned",
      resourceIds: ["choice"],
    });
    await turn();
    expect(reads).toBe(1);
    getWorkbenchQueries(f.core).invalidate({
      type: "changed",
      id: "preferences.changed",
      projectId: "B",
      extensionId: "owned",
      resourceIds: ["choice"],
    });
    await turn();
    expect(query.getSnapshot().data?.value).toBe("after");
    expect(reads).toBe(2);
  } finally {
    stop();
    await f.dispose();
  }
});

test("recreated preference guests paint the accepted last choice while persistence is held, without another GET", async () => {
  let value = "before",
    reads = 0,
    writes = 0;
  const held = Promise.withResolvers<void>(),
    entered = Promise.withResolvers<void>();
  const f = fixture({
    get: async () => {
      reads++;
      return value;
    },
    set: async (_name, next) => {
      writes++;
      if (writes === 1) {
        entered.resolve();
        await held.promise;
        throw new Error("First save unavailable");
      }
      value = String(next);
    },
  });
  const frame = f.frame(),
    query = frame.client.preferences.query("choice", { scope: "project", scopeId: "A" });
  let first: Promise<unknown> | undefined, last: Promise<unknown> | undefined;
  try {
    await query.read();
    first = frame.client.preferences.set("choice", "first", { scope: "project", scopeId: "A" }).catch((error) => error);
    await entered.promise;
    last = frame.client.preferences.set("choice", "last", { scope: "project", scopeId: "A" });
    frame.dispose();
    const returning = f.frame(),
      again = returning.client.preferences.query("choice", { scope: "project", scopeId: "A" });
    expect(again.getSnapshot().data?.value).toBe("last");
    expect(reads).toBe(1);
    held.resolve();
    expect(await first).toBeInstanceOf(Error);
    await last;
    expect(value).toBe("last");
    expect(writes).toBe(2);
    const other = f.frame("another-installation");
    expect(
      other.client.preferences.query("choice", { scope: "project", scopeId: "A" }).getSnapshot().data,
    ).toBeUndefined();
  } finally {
    held.resolve();
    await first;
    await last;
    await f.dispose();
  }
});

test("an older held preference GET cannot overwrite a newer accepted presentation write", async () => {
  const old = Promise.withResolvers<string>(),
    entered = Promise.withResolvers<void>();
  let value = "before",
    reads = 0,
    hold = false;
  const f = fixture({
    get: async () => {
      reads++;
      if (hold) {
        entered.resolve();
        return old.promise;
      }
      return value;
    },
    set: async (_name, next) => {
      value = String(next);
    },
  });
  const frame = f.frame(),
    query = frame.client.preferences.query("choice", { scope: "project", scopeId: "A" });
  let refresh: Promise<unknown> | undefined;
  try {
    await query.read();
    hold = true;
    refresh = query.refresh().catch((error) => error);
    await entered.promise;
    await frame.client.preferences.set("choice", "latest", { scope: "project", scopeId: "A" });
    old.resolve("obsolete");
    await refresh;
    expect(query.getSnapshot().data?.value).toBe("latest");
    expect(reads).toBe(2);
  } finally {
    old.resolve("obsolete");
    await refresh;
    await f.dispose();
  }
});
