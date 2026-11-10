import { expect, test } from "bun:test";
import { Worker } from "node:worker_threads";
import { createPreparationScope, withBackgroundPreparation } from "pstdio-extensions";
import { createPreparationClient } from "pstdio-extensions/preparation-client";
import { enqueueDefaultExtensionInstall } from "./default-extension-install-queue";

test("cancelling a foreground default waiter releases its background dependency's urgency", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  const client = createPreparationClient(
    () => new Worker(new URL("./default-extension-install-queue.fixture.ts", import.meta.url)),
  );
  const background = withBackgroundPreparation(() =>
    enqueueDefaultExtensionInstall(() => client.run("wait", { name: "startup", url: gate.url.href })),
  );
  await entered.promise;
  const controller = new AbortController();
  const foreground = enqueueDefaultExtensionInstall(async () => {}, controller.signal).catch((error: unknown) => error);
  try {
    controller.abort();
    expect(await foreground).toBe(controller.signal.reason);
    expect(await client.run("value", { name: "later tool" })).toBe("later tool");
  } finally {
    release.resolve();
    await background;
    await foreground;
    await client.stop();
    await gate.stop(true);
  }
});

for (const promotedAtStart of [false, true]) {
  test(`queued defaults track parent urgency ${promotedAtStart ? "released" : "acquired"} after enqueue`, async () => {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const gate = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch() {
        entered.resolve();
        await release.promise;
        return new Response("ready");
      },
    });
    const client = createPreparationClient(
      () => new Worker(new URL("./default-extension-install-queue.fixture.ts", import.meta.url)),
    );
    let startupCompleted = false;
    const background = withBackgroundPreparation(() =>
      enqueueDefaultExtensionInstall(() => client.run("wait", { name: "startup", url: gate.url.href })),
    ).then(() => {
      startupCompleted = true;
    });
    await entered.promise;
    const parent = withBackgroundPreparation(() => createPreparationScope());
    let releasePriority = promotedAtStart ? parent.request() : () => {};
    const queued = parent.run(() => enqueueDefaultExtensionInstall(async () => {}));
    try {
      if (promotedAtStart) releasePriority();
      else releasePriority = parent.request();
      const read = client.run("value", { name: "later tool" });
      if (!promotedAtStart) release.resolve();
      expect(await read).toBe("later tool");
      if (!promotedAtStart) expect(startupCompleted).toBe(true);
    } finally {
      releasePriority();
      parent.dispose();
      release.resolve();
      await background;
      await queued;
      await client.stop();
      await gate.stop(true);
    }
  });
}
