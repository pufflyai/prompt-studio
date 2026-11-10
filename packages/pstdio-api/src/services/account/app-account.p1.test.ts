import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { createNativeStore } from "./native-store";

const prepareSignedInApp = async (root: string, hasProjects: boolean, managerOrigin: string) => {
  const config = { storageRoot: root, databasePath: join(root, "database") };
  const bootstrap = await createTestApp(config);
  let projectId: string | undefined;
  let environmentId: string;
  try {
    projectId = hasProjects ? (await bootstrap.deps.projectService.create({ name: "Local" })).id : undefined;
    environmentId = (await bootstrap.deps.environmentService.get()).environmentId;
  } finally {
    await bootstrap.close();
  }
  await createNativeStore(join(root, "native-account.json")).save({
    managerOrigin,
    relayOrigin: managerOrigin,
    accountId: "account",
    deviceId: environmentId,
    token: "credential",
  });
  return { config, projectId };
};

test.each([
  false,
  true,
])("device rejection announces one runtime account change (has projects: %s)", async (hasProjects) => {
  const root = await mkdtemp(join(tmpdir(), "account-rejection-events-"));
  const rejection = Promise.withResolvers<void>();
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      await rejection.promise;
      return new Response(null, { status: 401 });
    },
  });
  let app: Awaited<ReturnType<typeof createTestApp>> | undefined;
  let stop = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { config, projectId } = await prepareSignedInApp(root, hasProjects, manager.url.origin);
    // Opening saved credentials establishes the status owner's silent baseline.
    // A live sign-in's queued notice must not enter the rejection measurement.
    app = await createTestApp(config);
    expect(await app.deps.accountService.status()).toMatchObject({ login: { accountId: "account" } });
    const announced = Promise.withResolvers<boolean>();
    const events: unknown[] = [];
    stop = app.deps.eventBus.subscribe((event) => {
      if (event.table !== "extension_events" || (event.data as { eventId: string }).eventId !== "account.changed")
        return;
      events.push(event.data);
      announced.resolve(true);
    });
    rejection.resolve();
    await app.deps.accountService.refresh();
    expect(await app.deps.accountService.status()).toMatchObject({ signInRequired: true });
    if (projectId) expect((await app.deps.accountService.projectSyncStatus(projectId)).state).toBe("local");
    expect(
      await Promise.race([
        announced.promise,
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), 500);
        }),
      ]),
    ).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ id: expect.any(String), eventId: "account.changed" });
  } finally {
    rejection.resolve();
    clearTimeout(timer);
    stop();
    await app?.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});

test("device rejection announces account changes even when the project's sync state stays local", async () => {
  const root = await mkdtemp(join(tmpdir(), "account-events-"));
  let rejected = false;
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      if (rejected) return new Response(null, { status: 401 });
      if (new URL(request.url).pathname === "/v1/account") return Response.json({ features: { relay: false } });
      return Response.json([]);
    },
  });
  const app = await createTestApp({ storageRoot: root });
  let stop = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "Local" });
    const { environmentId } = await app.deps.environmentService.get();
    await createNativeStore(join(root, "native-account.json")).save({
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      accountId: "account",
      deviceId: environmentId,
      token: "credential",
    });
    await app.deps.accountService.refresh();
    expect((await app.deps.accountService.projectSyncStatus(project.id)).state).toBe("local");
    const announced = Promise.withResolvers<boolean>();
    stop = app.deps.eventBus.subscribe((event) => {
      if (event.table === "extension_events" && (event.data as { eventId: string }).eventId === "account.changed")
        announced.resolve(true);
    });
    rejected = true;
    await app.deps.accountService.refresh();
    expect(await app.deps.accountService.status()).toMatchObject({ signInRequired: true });
    expect((await app.deps.accountService.projectSyncStatus(project.id)).state).toBe("local");
    expect(
      await Promise.race([
        announced.promise,
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), 500);
        }),
      ]),
    ).toBe(true);
  } finally {
    clearTimeout(timer);
    stop();
    await app.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
