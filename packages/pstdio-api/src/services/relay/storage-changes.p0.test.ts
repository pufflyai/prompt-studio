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

test("storage bursts retain extension and record identity and conservatively broaden incomplete scopes", async () => {
  const eventBus = new EventBus();
  const changes = createStorageChangeAnnouncer(eventBus);
  const delivered = Promise.withResolvers<void>();
  const stop = eventBus.subscribe((event) => {
    if ((event.data as { projectId?: string }).projectId === "other") delivered.resolve();
  });
  try {
    changes.changed("project", { extensionId: "marmalade", recordIds: ["presentation"] });
    changes.changed("project", { extensionId: "marmalade", recordIds: ["presentation", "history"] });
    changes.changed("project", { extensionId: "notes", recordIds: ["one"] });
    changes.changed("project", { extensionId: "notes" });
    changes.changed("other", { extensionId: "notes", recordIds: ["one"] });
    changes.changed("other");
    await delivered.promise;
    expect(eventBus.getSince(0).map((event) => event.data)).toEqual([
      {
        id: expect.any(String),
        eventId: "pstdio.event.storage-changed",
        projectId: "project",
        extensionId: "marmalade",
        recordIds: ["presentation", "history"],
      },
      { id: expect.any(String), eventId: "pstdio.event.storage-changed", projectId: "project", extensionId: "notes" },
      { id: expect.any(String), eventId: "pstdio.event.storage-changed", projectId: "other" },
    ]);
  } finally {
    stop();
    changes.close();
  }
});

test("overflow hints remain bounded and closing during publication retires remaining work", async () => {
  const eventBus = new EventBus();
  const changes = createStorageChangeAnnouncer(eventBus);
  const delivered = Promise.withResolvers<void>();
  const stop = eventBus.subscribe(() => {
    changes.close();
    delivered.resolve();
  });
  changes.changed("first", {
    extensionId: "notes",
    recordIds: Array.from({ length: 129 }, (_, index) => String(index)),
  });
  changes.changed("second", { extensionId: "notes", recordIds: ["one"] });
  await delivered.promise;
  expect(eventBus.getSince(0).map((event) => event.data)).toEqual([
    { id: expect.any(String), eventId: "pstdio.event.storage-changed", projectId: "first", extensionId: "notes" },
  ]);
  changes.changed("late");
  await Bun.sleep(30);
  expect(eventBus.seq).toBe(1);
  stop();
});
