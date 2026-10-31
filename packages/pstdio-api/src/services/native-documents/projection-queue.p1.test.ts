import { expect, test } from "bun:test";
import { createNativeProjectionQueue } from "./projection-queue";

test("a captured projection fence completes while a later trailing projection remains pending", async () => {
  const first = Promise.withResolvers<void>();
  const firstStarted = Promise.withResolvers<void>();
  const trailing = Promise.withResolvers<void>();
  const trailingStarted = Promise.withResolvers<void>();
  let revision = 0;
  const address = { owner: { workbenchId: "project", extensionId: "example.source" }, documentKey: "source" };
  const queue = createNativeProjectionQueue({
    reconcile: async () => {
      if (revision === 0) {
        firstStarted.resolve();
        await first.promise;
        return ++revision;
      }
      trailingStarted.resolve();
      await trailing.promise;
      return ++revision;
    },
    failed: () => {},
  });
  const captured = queue.through(address, 1);
  await firstStarted.promise;
  const later = queue.through(address, 2);
  first.resolve();
  await trailingStarted.promise;
  try {
    await captured;
    expect(revision).toBe(1);
  } finally {
    trailing.resolve();
    await later;
    await queue.drain();
  }
});
