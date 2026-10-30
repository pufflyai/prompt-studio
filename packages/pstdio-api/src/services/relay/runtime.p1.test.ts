import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { startRelayRuntime } from "./runtime";

const unreachable = "http://127.0.0.1:9";

test("a burst of committed writes in a synced project announces one storage change for that project", async () => {
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
    // Longer than the announcer's maximum delay, so every announcement for the burst has arrived.
    await Bun.sleep(300);
    expect(announced).toEqual([
      { id: expect.any(String), projectId: project.id, eventId: "pstdio.event.storage-changed" },
    ]);
  } finally {
    stop();
    await relay.close();
    await app.close();
  }
});
