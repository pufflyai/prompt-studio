import { expect, test } from "bun:test";
import { EventBus } from "../../features/sync/event-bus";
import { createStorageChangeAnnouncer } from "./storage-changes";

test("coalesces a synchronous burst into one storage change per project", async () => {
  const eventBus = new EventBus();
  const changes = createStorageChangeAnnouncer(eventBus);
  const delivered = Promise.withResolvers<void>();
  const stop = eventBus.subscribe(() => {
    if (eventBus.seq === 2) delivered.resolve();
  });
  try {
    for (let index = 0; index < 10; index++) {
      changes.changed("first");
      changes.changed("second");
    }
    await delivered.promise;
    expect(eventBus.getSince(0).map((event) => event.data)).toEqual([
      { id: expect.any(String), projectId: "first", eventId: "pstdio.event.storage-changed" },
      { id: expect.any(String), projectId: "second", eventId: "pstdio.event.storage-changed" },
    ]);
  } finally {
    stop();
    changes.close();
  }
});
