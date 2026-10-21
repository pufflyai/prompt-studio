import { afterEach, beforeEach, expect, test } from "bun:test";
import { join } from "node:path";
import { accountEvents } from "pstdio-api-contracts/extension-kernel";
import { accountUnavailableMessage, createNativeAccount } from "../../../services/account/native-account";
import { createProjectSyncEvents } from "../../../services/account/project-sync-events";
import { fireExtensionEvent } from "../extension-event-runtime";
import { createWorkspaceContextFixture } from "../workspace-context.test-fixture";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
let account: ReturnType<typeof createNativeAccount>;
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
  account = createNativeAccount({
    file: join(fixture.root, "native-account.json"),
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
      received.push({ event, read: await ctx.account.projectSyncStatus(), status: await ctx.account.status() });
    },
  });
  const deliveries: Promise<unknown>[] = [];
  const events = createProjectSyncEvents({
    status: (projectId) => account.projectSyncStatus(projectId),
    publish: (projectId, status) =>
      deliveries.push(fireExtensionEvent(deps, projectId, accountEvents.projectSyncChanged, { ...status, projectId })),
  });

  await events.changed("project-1");
  await events.changed("project-1");
  await Promise.all(deliveries);

  expect(received).toEqual([
    {
      event: expect.objectContaining({ projectId: "project-1", state: "local", offlineReady: false }),
      read: { state: "local", offlineReady: false },
      status: { login: null, cloudProjects: [], cloudProjectsLoaded: true },
    },
  ]);
});

test("account service failures reach extensions without private service details", async () => {
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
      failure = await ctx.account.login("not a service address").catch((error: Error) => error.message);
    },
  });

  await fireExtensionEvent(deps, "project-1", "project.opened", {});

  expect(failure).toBe(accountUnavailableMessage);
});
