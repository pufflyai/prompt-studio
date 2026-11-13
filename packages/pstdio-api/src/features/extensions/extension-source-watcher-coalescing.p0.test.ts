import { expect, test } from "bun:test";
import { Worker } from "node:worker_threads";
import {
  configureExtensionPreparationWorker,
  stopExtensionPreparation,
  subscribePreparationEvents,
} from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";
import { createRootWatcherClient } from "./extension-root-watcher-client";
import { createExtensionSourceWatcher } from "./extension-source-watcher";

test.each([
  "database feedback",
  "source revisions",
  "root registrations",
] as const)("watch registration coalesces changing %s instead of flooding preparation", async (changes) => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const server = Bun.serve({
    port: 0,
    async fetch() {
      entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  configureExtensionPreparationWorker(
    () => new Worker(new URL("./preparation-watch-admission.fixture.ts", import.meta.url)),
  );
  const observed: unknown[] = [];
  const unsubscribe = subscribePreparationEvents((event) => {
    if (event.registration) observed.push(event.registration);
  });
  let watcher: Awaited<ReturnType<typeof createExtensionSourceWatcher>> | undefined;
  let held: Promise<unknown> | undefined;
  const refreshes: Promise<unknown>[] = [];
  let revision = 0;
  let feedback = 0;
  try {
    watcher =
      changes === "root registrations"
        ? await createRootWatcherClient({
            listExtensionRoots: async () => [{ path: `/root-${revision}`, ownerRoot: "/", sync: async () => {} }],
          })
        : await createExtensionSourceWatcher({
            listInstalledSources: async () => [
              {
                install_name: "fixture",
                source_path: "/fixture",
                source_hash: changes === "source revisions" ? String(revision) : "accepted",
                loaded_revision: ++feedback,
                updated_at: String(feedback),
              },
            ],
            onSourceChanged: async () => {},
          });
    const initial = observed.length;
    held = runExtensionPreparation("hold", { url: server.url.href });
    await entered.promise;
    for (let index = 0; index < 130; index++) {
      revision = index + 1;
      refreshes.push(watcher.refresh().catch((error) => error));
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    const requested = runExtensionPreparation("value", { name: "requested" }).catch((error) => error);
    release.resolve();
    await held;
    expect(await requested).toMatchObject({ name: "requested" });
    expect(await Promise.all(refreshes)).toEqual(Array(130).fill(undefined));
    expect(observed.slice(initial)).toEqual(
      changes === "root registrations"
        ? [[{ path: "/root-130" }]]
        : [
            [
              {
                install_name: "fixture",
                source_path: "/fixture",
                source_hash: changes === "source revisions" ? "130" : "accepted",
              },
            ],
          ],
    );
  } finally {
    release.resolve();
    await Promise.allSettled([held, ...refreshes].filter(Boolean));
    await watcher?.dispose();
    unsubscribe();
    await stopExtensionPreparation();
    configureExtensionPreparationWorker(
      () => new Worker(new URL("./extension-preparation-worker.ts", import.meta.url)),
    );
    await server.stop(true);
  }
});
