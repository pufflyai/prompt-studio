import { createClient } from "@pstdio/sdk/client";
import {
  type AccountDevice,
  type AccountStatus,
  accountEvents,
  createScopedQueryClient,
  createWebviewClient,
  type ProjectSyncStatus,
  type WebviewCommandQuery,
} from "@pstdio/sdk/extensions";
import { createCloudQueries } from "../../../../extensions/pstdio-cloud/src/cloud-queries";
import type { CloudProjectState, cloudCommands } from "../../../../extensions/pstdio-cloud/src/project-state";
import { createAccountQuerySources } from "../../../pstdio-dashboard/src/shared/extensions/account-query-sources";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";
export const cloudAccount: AccountStatus = {
  login: { managerOrigin: "https://account.test", relayOrigin: "https://relay.test", accountId: "a", deviceId: "d" },
  features: { relay: true },
  cloudProjects: ["project"],
  cloudProjectsLoaded: true,
};
export const cloudDevice: AccountDevice = {
  id: "d",
  name: "Old",
  platform: "fixture",
  createdAt: "2026-11-05T00:00:00Z",
  lastSeenAt: "2026-11-05T00:00:00Z",
  online: true,
  current: true,
};

type Pending<T> = ReturnType<typeof Promise.withResolvers<T>> & {
  entered: Promise<void>;
  aborted: Promise<void>;
  run(signal: AbortSignal): Promise<T>;
};
const hold = <T>(queue: ((signal: AbortSignal) => Promise<T>)[]) => {
  const value = Promise.withResolvers<T>(),
    entered = Promise.withResolvers<void>(),
    aborted = Promise.withResolvers<void>();
  const pending = {
    ...value,
    entered: entered.promise,
    aborted: aborted.promise,
    async run(signal: AbortSignal) {
      entered.resolve();
      signal.throwIfAborted();
      const cancelled = Promise.withResolvers<never>();
      const abort = () => {
        aborted.resolve();
        cancelled.reject(signal.reason);
      };
      signal.addEventListener("abort", abort, { once: true });
      try {
        return await Promise.race([value.promise, cancelled.promise]);
      } finally {
        signal.removeEventListener("abort", abort);
      }
    },
  };
  queue.push(pending.run);
  return pending as Pending<T>;
};
export const cloudQueryFixture = (initialProjectId: string | undefined = "project") => {
  let projectId = initialProjectId,
    accountValue = cloudAccount,
    sync: ProjectSyncStatus = { state: "synced", offlineReady: true },
    devices = [cloudDevice],
    projectState: CloudProjectState = { state: "ready" };
  const reads = { status: 0, sync: 0, devices: 0 };
  const live = { status: 0, sync: 0, devices: 0 };
  const maxLive = { ...live };
  let projectReads = 0;
  const statusReplies: ((signal: AbortSignal) => Promise<AccountStatus>)[] = [],
    syncReplies: ((signal: AbortSignal) => Promise<ProjectSyncStatus>)[] = [],
    deviceReplies: ((signal: AbortSignal) => Promise<AccountDevice[]>)[] = [],
    projectReplies: ((signal: AbortSignal) => Promise<CloudProjectState>)[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const path = new URL(request.url).pathname;
      let key: "devices" | "sync" | "status" = "status";
      if (path.endsWith("/devices")) key = "devices";
      else if (path.endsWith("/sync")) key = "sync";
      reads[key]++;
      live[key]++;
      maxLive[key] = Math.max(maxLive[key], live[key]);
      try {
        let value: unknown;
        if (key === "devices") value = await (deviceReplies.shift()?.(request.signal) ?? devices);
        else if (key === "sync") value = await (syncReplies.shift()?.(request.signal) ?? sync);
        else value = await (statusReplies.shift()?.(request.signal) ?? accountValue);
        return Response.json(value);
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
      } finally {
        live[key]--;
      }
    },
  });
  const api = createClient({ baseUrl: server.url.origin, token: "" });
  const authority = createScopedQueryClient({ runtimeId: "cloud", extensionId: "pstdio.account" }, { maxInactive: 1 });
  const account = authority.query({
    id: "account.status",
    dependsOn: [accountEvents.changed.id],
    read: (signal) => api.account.status({ signal }),
  });
  let sources: ReturnType<typeof createAccountQuerySources>;
  const replyHolds: ((method: string, input: unknown, value: unknown) => Promise<unknown> | undefined)[] = [];
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.pstdio-cloud",
    account: {
      source: (definition) => sources.source(definition),
      sources: (id) => sources.sources(id),
      requireCurrent(id, origin) {
        const login = account.getSnapshot().data?.login;
        if ((login?.accountId ?? "local") !== (id ?? "local") || (login?.managerOrigin ?? "") !== (origin ?? ""))
          throw new Error("Service query authority is closed");
      },
    },
    async execute(_command, signal) {
      projectReads++;
      return projectReplies.shift()?.(signal) ?? projectState;
    },
    async delayReply(method, input, value) {
      const handler = replyHolds[0];
      const result = handler?.(method, input, value);
      if (result) {
        replyHolds.shift();
        return result;
      }
      return value;
    },
  });
  sources = createAccountQuerySources({ queries: transport.queries, account, client: api });
  const frame = transport.frame(projectId);
  const client = createWebviewClient<typeof cloudCommands>(frame.host);
  const definitions = new Map<object, Parameters<typeof sources.source>[0]>();
  const query = client.account.query;
  client.account.query = (definition) => {
    const value = query(definition);
    definitions.set(value, definition);
    return value;
  };
  let applied: AccountStatus | undefined;
  const stopGuard = account.subscribe(() => {
    const next = account.getSnapshot().data;
    if (!next || next === applied) return;
    applied = next;
    frame.authority(next.login?.accountId ?? "local", next.login?.managerOrigin ?? "");
  });
  const stops: (() => void)[] = [];
  const queries = () => createCloudQueries(client, projectId);
  const observe = <T>(value: WebviewCommandQuery<T>) => {
    const stop = value.subscribe(() => {});
    stops.push(stop);
    return stop;
  };
  return {
    client,
    frame,
    transport,
    account,
    reads,
    live,
    maxLive,
    get queries() {
      return queries();
    },
    get projectReads() {
      return projectReads;
    },
    observe,
    holdStatus: () => hold(statusReplies),
    holdDevices: () => hold(deviceReplies),
    holdSync: () => hold(syncReplies),
    holdProject: () => hold(projectReplies),
    holdReply(predicate: (method: string, input: any) => boolean) {
      const entered = Promise.withResolvers<void>(),
        release = Promise.withResolvers<void>();
      replyHolds.push((method, input, value) => {
        if (!predicate(method, input)) return;
        entered.resolve();
        return release.promise.then(() => value);
      });
      return { entered: entered.promise, release: () => release.resolve() };
    },
    refreshAccount: () => account.invalidate(),
    readAccount: () => account.read(),
    retireProject: () => transport.queries.clearScope({ projectId }),
    invalidate(value: object) {
      const definition = definitions.get(value);
      if (!definition) throw new Error("Unknown projection");
      sources.source(definition).invalidate();
    },
    failDevices: () =>
      deviceReplies.push(async () => {
        throw new Error("New manager unavailable");
      }),
    setAccount: (next: AccountStatus) => {
      accountValue = next;
    },
    setSync: (next: ProjectSyncStatus) => {
      sync = next;
    },
    setDevices: (next: AccountDevice[]) => {
      devices = next;
    },
    setProjectState: (next: CloudProjectState) => {
      projectState = next;
    },
    project(next: string) {
      projectId = next;
      frame.project(next);
    },
    authority: (id: string, origin: string) => frame.authority(id, origin),
    emit(id: string, idProject?: string) {
      const event = { type: "changed" as const, id, ...(idProject ? { projectId: idProject } : {}) };
      authority.invalidate(event);
      transport.queries.invalidate(event);
    },
    accountChanged() {
      authority.invalidate({ type: "changed", id: accountEvents.changed.id });
      transport.queries.invalidate({ type: "changed", id: accountEvents.changed.id });
    },
    async open() {
      await account.read();
      observe(queries().account);
      observe(queries().projectSync);
      await Promise.all([queries().account.read(), queries().projectSync.read()]);
    },
    async devices() {
      const value = queries().devices(account.getSnapshot().data!.login!);
      observe(value);
      await value.read();
      return value;
    },
    detach() {
      for (const stop of stops.splice(0)) stop();
    },
    async dispose() {
      for (const stop of stops.splice(0)) stop();
      stopGuard();
      client.queries.dispose();
      transport.dispose();
      sources.dispose();
      authority.dispose();
      await server.stop(true);
    },
  };
};
