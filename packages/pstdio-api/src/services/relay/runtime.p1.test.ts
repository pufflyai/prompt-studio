import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { startRelayRuntime } from "./runtime";

const unreachable = "http://127.0.0.1:9";

test("committed writes in a synced project announce storage changes for that project", async () => {
  const app = await createTestApp();
  const relay = await startRelayRuntime({ deps: app.deps });
  const announced: unknown[] = [];
  const stop = app.deps.eventBus.subscribe((event) => {
    if (event.table === "extension_events") announced.push(event.data);
  });
  try {
    const project = await app.deps.projectService.create({ name: "Synced" });
    await relay.update([
      {
        accountId: "account",
        workbenchId: project.id,
        environmentId: "device",
        relayOrigin: unreachable,
        managerOrigin: unreachable,
        renewalGrant: "grant",
      },
    ]);
    const { records } = await app.deps.extensionStorageService.open({
      owner: { workbenchId: project.id, extensionId: "example.notes" },
    });
    announced.length = 0;
    const writes = 10;
    await Promise.all(
      Array.from({ length: writes }, (_, index) =>
        records.commit({ operationId: `save-${index}`, edits: [{ recordId: `note-${index}`, replace: index }] }),
      ),
    );
    // Database commits can span several quiet windows on a busy runner.
    await Bun.sleep(300);
    expect(announced.length).toBeGreaterThan(0);
    for (const event of announced)
      expect(event).toEqual({
        id: expect.any(String),
        projectId: project.id,
        eventId: "pstdio.event.storage-changed",
      });
  } finally {
    stop();
    await relay.close();
    await app.close();
  }
});

test("an unsupported relay live version reaches the existing account error display as an update request", async () => {
  const app = await createTestApp();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (new URL(request.url).pathname === "/v1/environment-access")
        return Response.json({ token: "access", expiresAt: new Date(Date.now() + 60_000).toISOString() });
      if (server.upgrade(request)) return;
      return new Response(null, { status: 404 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ type: "ready", protocolVersion: 1 }));
      },
      message() {},
    },
  });
  const relay = await startRelayRuntime({ deps: app.deps });
  try {
    const project = await app.deps.projectService.create({ name: "Needs update" });
    await relay.update([
      {
        accountId: "owner",
        workbenchId: project.id,
        environmentId: "device",
        managerOrigin: server.url.origin,
        relayOrigin: server.url.origin,
        renewalGrant: "grant",
      },
    ]);
    let error: unknown;
    const end = Date.now() + 1000;
    while (!error && Date.now() < end) {
      error = await relay.status(project.id).then(
        () => undefined,
        (error) => error,
      );
      if (!error) await Bun.sleep(1);
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("Update Prompt Studio or the relay");
  } finally {
    await relay.close();
    await server.stop(true);
    await app.close();
  }
});
