import { expect, test } from "bun:test";
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { createExtensionWebviewHostCapabilities } from "@pstdio/workbench/extensions";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { dashboardQueryAuthority, getDashboardAccountStatusQuery } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { useCloudProjectStates } from "@/modules/projects/data/cloud-project-states";
import { createDashboardWebviewServiceQueries } from "./webview-service-queries";

test("native project picker and a service guest share one identity-fenced project-sync read", async () => {
  const environment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
    __PSTDIO_CONFIG__?: { apiBaseUrl: string };
  };
  const original = { act: environment.IS_REACT_ACT_ENVIRONMENT, config: environment.__PSTDIO_CONFIG__ };
  const held = Promise.withResolvers<void>(),
    entered = Promise.withResolvers<void>();
  let syncReads = 0;
  const expected: URLSearchParams[] = [];
  const status = {
    login: {
      accountId: "account",
      deviceId: "device",
      managerOrigin: "https://manager.test",
      relayOrigin: "https://relay.test",
    },
    features: { relay: true },
    cloudProjects: ["A"],
    cloudProjectsLoaded: true,
  };
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/sync")) {
        syncReads++;
        expected.push(url.searchParams);
        entered.resolve();
        await held.promise;
        return Response.json({ state: "synced", offlineReady: true });
      }
      return Response.json(status);
    },
  });
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  environment.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  const runtime = getRuntimeCollections();
  const events = createHostEventPublisher();
  const listeners = new Map<string, Set<(value: unknown) => void>>();
  let tree: ReactTestRenderer | undefined,
    client: ReturnType<typeof createWebviewClient> | undefined,
    read: Promise<unknown> | undefined;
  let native: ReturnType<typeof useCloudProjectStates>;
  const Probe = () => {
    native = useCloudProjectStates(["A"]);
    return <span>{native("A").sync?.state}</span>;
  };
  try {
    await getDashboardAccountStatusQuery(runtime).read();
    const queryScope = { runtimeId: String(runtime.id), ...dashboardQueryAuthority(status) };
    const services = createDashboardWebviewServiceQueries({
      runtime,
      projectId: "A",
      queryScope,
      extensionId: "consumer",
      source: ["installation"],
      events,
    });
    const capabilities = createExtensionWebviewHostCapabilities({
      accountQueries: services.account,
      hostEvents: events,
    });
    const host = {
      extensionId: "consumer",
      propsStore: {
        get: () => ({ projectId: "A", queryScope, serviceQueries: { account: services.account.seeds() } }),
        subscribe: () => () => {},
      },
      onEvent(scope: string, listener: (value: unknown) => void) {
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
    await act(async () => {
      tree = create(<Probe />);
    });
    await entered.promise;
    client = createWebviewClient(host);
    const query = client.account.query({ service: "projectSyncStatus", projectId: "A" });
    read = query.read();
    held.resolve();
    expect(await read).toEqual({ state: "synced", offlineReady: true });
    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    expect(native!("A").sync?.state).toBe("synced");
    expect(syncReads).toBe(1);
    expect(expected[0]!.get("accountId")).toBe("account");
    expect(expected[0]!.get("managerOrigin")).toBe("https://manager.test");
  } finally {
    held.resolve();
    await read?.catch(() => {});
    await act(async () => {
      tree?.unmount();
    });
    client?.queries.dispose();
    events.unbind();
    await runtime.dispose();
    await server.stop(true);
    environment.IS_REACT_ACT_ENVIRONMENT = original.act;
    environment.__PSTDIO_CONFIG__ = original.config;
  }
});
