import { expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import {
  type AccountStatus,
  createScopedQueryClient,
  createWebviewClient,
  type GuestHost,
} from "@pstdio/sdk/extensions";
import { createExtensionWebviewHostCapabilities, createWebviewServiceQueryAdapter } from "@pstdio/workbench/extensions";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createAccountQuerySources } from "./account-query-sources";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const waitFor = async (ready: () => boolean) => {
  const until = performance.now() + 1000;
  while (!ready()) {
    if (performance.now() > until) throw new Error("Device observation did not settle");
    await Bun.sleep(1);
  }
};

const fixture = () => {
  const login = {
    accountId: "account",
    managerOrigin: "https://manager.test",
    deviceId: "first",
    relayOrigin: "https://relay.test",
  };
  const definition = { service: "devices" as const, accountId: login.accountId, managerOrigin: login.managerOrigin };
  const queries = createScopedQueryClient({
    runtimeId: "devices",
    accountId: login.accountId,
    accountOrigin: login.managerOrigin,
    extensionId: "pstdio.account",
  });
  const account = queries.query<AccountStatus>({
    id: "account.status",
    read: () => ({ login, features: { relay: true }, cloudProjects: [], cloudProjectsLoaded: true }),
  });
  account.accept({ login, features: { relay: true }, cloudProjects: [], cloudProjectsLoaded: true });
  let devices = [{ id: "first" }],
    reads = 0;
  const signals: AbortSignal[] = [];
  const gates: ReturnType<typeof Promise.withResolvers<void>>[] = [];
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => Response.json(devices) });
  const api = createClient({ baseUrl: server.url.origin, token: "" });
  const readDevices = api.account.devices;
  api.account.devices = async (options) => {
    reads++;
    signals.push(options!.signal!);
    const gate = gates.shift();
    if (gate)
      await new Promise<void>((resolve, reject) => {
        const aborted = () => reject(options!.signal!.reason);
        options!.signal!.addEventListener("abort", aborted, { once: true });
        gate.promise.then(resolve).finally(() => options!.signal!.removeEventListener("abort", aborted));
      });
    return readDevices(options);
  };
  const sources = createAccountQuerySources({ queries, account, client: api });
  const frames: {
    client: ReturnType<typeof createWebviewClient>;
    events: ReturnType<typeof createHostEventPublisher>;
  }[] = [];
  const frame = () => {
    const events = createHostEventPublisher(),
      listeners = new Set<(event: unknown) => void>();
    const adapter = createWebviewServiceQueryAdapter({
      channel: "account.query",
      owner: String(frames.length),
      events,
      requireCurrent() {
        if (account.getSnapshot().data?.login !== login) throw new Error("Account authority retired");
      },
      sources: () => sources.sources(undefined),
      source: (input) => sources.source(input),
    });
    const capabilities = createExtensionWebviewHostCapabilities({ accountQueries: adapter });
    const client = createWebviewClient({
      extensionId: "device-view",
      propsStore: {
        get: () => ({
          queryScope: { runtimeId: "devices", accountId: login.accountId, accountOrigin: login.managerOrigin },
          serviceQueries: { account: adapter.seeds() },
        }),
        subscribe: () => () => {},
      },
      call: (method: keyof typeof capabilities, input: never) => capabilities[method](input),
      onEvent(_scope: string, listener: (value: unknown) => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    } as unknown as GuestHost);
    events.bind((event) => {
      for (const listener of listeners) listener(event.payload);
    });
    frames.push({ client, events });
    return client.account.query(definition);
  };
  return {
    frame,
    signals,
    sources,
    queries,
    definition,
    get reads() {
      return reads;
    },
    setDevices: () => {
      devices = [{ id: "first" }, { id: "peer" }];
    },
    hold() {
      const gate = Promise.withResolvers<void>();
      gates.push(gate);
      return gate;
    },
    async dispose() {
      for (const f of frames) {
        f.client.queries.dispose();
        f.events.unbind();
      }
      sources.dispose();
      queries.dispose();
      await server.stop(true);
    },
  };
};

test("reopening device observations catches up a remote gap with one canonical read for both views", async () => {
  const f = fixture(),
    first = f.frame(),
    second = f.frame();
  let stopFirst = first.subscribe(() => {}),
    stopSecond = second.subscribe(() => {});
  try {
    await waitFor(() => first.getSnapshot().data?.length === 1 && second.getSnapshot().data?.length === 1);
    expect(f.reads).toBe(1);
    expect(f.sources.source(f.definition).inspect().observers).toBe(1);
    stopFirst();
    stopSecond();
    await turn();
    expect(f.sources.source(f.definition).inspect().observers).toBe(0);
    f.setDevices();
    stopFirst = first.subscribe(() => {});
    stopSecond = second.subscribe(() => {});
    await waitFor(() => first.getSnapshot().data?.length === 2 && second.getSnapshot().data?.length === 2);
    expect(f.reads).toBe(2);
  } finally {
    stopFirst();
    stopSecond();
    await f.dispose();
  }
});

test("a returning device read remains optional and closes only after its final view leaves", async () => {
  const f = fixture(),
    first = f.frame(),
    second = f.frame();
  let stopFirst = first.subscribe(() => {}),
    stopSecond = second.subscribe(() => {});
  const gate = f.hold();
  try {
    await waitFor(() => f.reads === 1);
    stopFirst();
    await turn();
    expect(f.signals[0]!.aborted).toBe(false);
    stopSecond();
    await waitFor(() => f.signals[0]!.aborted);
    gate.resolve();
    f.setDevices();
    stopFirst = first.subscribe(() => {});
    stopSecond = second.subscribe(() => {});
    await waitFor(() => first.getSnapshot().data?.length === 2 && second.getSnapshot().data?.length === 2);
    expect(f.reads).toBe(2);
  } finally {
    gate.resolve();
    stopFirst();
    stopSecond();
    await f.dispose();
  }
});
