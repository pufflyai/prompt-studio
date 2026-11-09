import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { createNativeStore } from "./native-store";

test.each([
  false,
  true,
])("device rejection announces one runtime account change (has projects: %s)", async (hasProjects) => {
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
    const project = hasProjects ? await app.deps.projectService.create({ name: "Local" }) : undefined;
    const { environmentId } = await app.deps.environmentService.get();
    await createNativeStore(join(root, "native-account.json")).save({
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      accountId: "account",
      deviceId: environmentId,
      token: "credential",
    });
    await app.deps.accountService.refresh();
    if (project) expect((await app.deps.accountService.projectSyncStatus(project.id)).state).toBe("local");
    const announced = Promise.withResolvers<boolean>();
    const events: unknown[] = [];
    stop = app.deps.eventBus.subscribe((event) => {
      if (event.table !== "extension_events" || (event.data as { eventId: string }).eventId !== "account.changed")
        return;
      events.push(event.data);
      announced.resolve(true);
    });
    rejected = true;
    await app.deps.accountService.refresh();
    expect(await app.deps.accountService.status()).toMatchObject({ signInRequired: true });
    if (project) expect((await app.deps.accountService.projectSyncStatus(project.id)).state).toBe("local");
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
    clearTimeout(timer);
    stop();
    await app.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
