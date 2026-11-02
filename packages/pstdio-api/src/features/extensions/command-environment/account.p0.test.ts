import { afterEach, beforeEach, expect, test } from "bun:test";
import { join } from "node:path";
import { accountEvents } from "pstdio-api-contracts/extension-kernel";
import { accountUnavailableMessage, createNativeAccount } from "../../../services/account/native-account";
import { createNativeStore } from "../../../services/account/native-store";
import { createProjectSyncEvents } from "../../../services/account/project-sync-events";
import { fireExtensionEvent } from "../extension-event-runtime";
import { createWorkspaceContextFixture } from "../workspace-context.test-fixture";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
let account: ReturnType<typeof createNativeAccount>;
let file: string;
// Nothing listens on port 1, so the account service is unreachable.
const unreachableLogin = {
  login: {
    managerOrigin: "https://127.0.0.1:1",
    relayOrigin: "https://127.0.0.1:1",
    accountId: "account",
    deviceId: "device",
    token: "device-credential",
  },
};
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
  file = join(fixture.root, "native-account.json");
  account = createNativeAccount({
    file,
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: fixture.deps.projectService,
  });
});
afterEach(async () => {
  account.close();
  await fixture.cleanup();
});

test("an extension receives a project sync change and reads the same state from ctx.account", async () => {
  const deps = { ...fixture.deps, accountService: account };
  const snapshot = await deps.extensionRuntimeCatalog.get("project-1");
  const received: unknown[] = [];
  snapshot.runtime.hooks.push({
    id: "sync",
    localId: "sync",
    extensionId: "example.context",
    name: "context",
    sourcePath: fixture.root,
    eventId: accountEvents.projectSyncChanged.id,
    handler: async (ctx, event) => {
      received.push({ event, read: await ctx.account.projectSyncStatus() });
    },
  });
  const deliveries: Promise<unknown>[] = [];
  const events = createProjectSyncEvents({
    status: (projectId) => account.projectSyncStatus(projectId),
    publish: (projectId, status) =>
      deliveries.push(fireExtensionEvent(deps, projectId, accountEvents.projectSyncChanged, { ...status, projectId })),
  });

  await events.changed("project-1");
  expect(await account.projectSyncStatus("project-1")).toEqual({ state: "local", offlineReady: false });
  // Signing in while the account service cannot say which projects sync leaves the project offline.
  await Bun.write(file, JSON.stringify(unreachableLogin));
  await events.changed("project-1");
  await Promise.all(deliveries);

  expect(received).toEqual([
    {
      event: expect.objectContaining({ projectId: "project-1", state: "offline", offlineReady: false }),
      read: { state: "offline", offlineReady: false },
    },
  ]);
});

test("account service failures reach extensions without private service details", async () => {
  await Bun.write(file, JSON.stringify(unreachableLogin));
  const deps = { ...fixture.deps, accountService: account };
  const snapshot = await deps.extensionRuntimeCatalog.get("project-1");
  let failure: unknown;
  snapshot.runtime.hooks.push({
    id: "devices",
    localId: "devices",
    extensionId: "example.context",
    name: "context",
    sourcePath: fixture.root,
    eventId: "project.opened",
    handler: async (ctx) => {
      failure = await ctx.account.devices().catch((error: Error) => error.message);
    },
  });

  await fireExtensionEvent(deps, "project-1", "project.opened", {});

  expect(failure).toBe(accountUnavailableMessage);
});

test("progress-only events and rejected device status reach the public extension context", async () => {
  let rejected = false;
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      if (rejected) return new Response(null, { status: 401 });
      if (new URL(request.url).pathname === "/v1/account") return Response.json({ features: { relay: true } });
      return Response.json([{ workbenchId: "project-1" }]);
    },
  });
  await createNativeStore(file).save({
    ...unreachableLogin.login,
    managerOrigin: manager.url.origin,
  });
  let completed = 0;
  account.start(
    async () => {},
    async () => ({
      state: "first-download-incomplete",
      offlineReady: false,
      pendingItems: 1,
      download: { completed, total: 3 },
    }),
    async () => {},
  );
  const deps = { ...fixture.deps, accountService: account };
  const snapshot = await deps.extensionRuntimeCatalog.get("project-1");
  const received: unknown[] = [];
  snapshot.runtime.hooks.push({
    id: "progress",
    localId: "progress",
    extensionId: "example.context",
    name: "context",
    sourcePath: fixture.root,
    eventId: accountEvents.projectSyncChanged.id,
    handler: async (ctx, event) => {
      received.push({ event, sync: await ctx.account.projectSyncStatus(), account: await ctx.account.status() });
    },
  });
  const deliveries: Promise<unknown>[] = [];
  const events = createProjectSyncEvents({
    status: (id) => account.projectSyncStatus(id),
    publish: (id, status) =>
      deliveries.push(fireExtensionEvent(deps, id, accountEvents.projectSyncChanged, { ...status, projectId: id })),
  });
  try {
    await account.refresh();
    await events.changed("project-1");
    completed = 1;
    await events.changed("project-1");
    await Promise.all(deliveries);
    expect(received).toMatchObject([
      {
        event: { state: "first-download-incomplete", pendingItems: 1, download: { completed: 1, total: 3 } },
        sync: { state: "first-download-incomplete", pendingItems: 1, download: { completed: 1, total: 3 } },
      },
    ]);
    rejected = true;
    await account.refresh();
    await events.changed("project-1");
    await Promise.all(deliveries);
    expect(received.at(-1)).toMatchObject({ account: { login: null, signInRequired: true } });
  } finally {
    await events.close();
    await account.close();
    await manager.stop(true);
  }
});
