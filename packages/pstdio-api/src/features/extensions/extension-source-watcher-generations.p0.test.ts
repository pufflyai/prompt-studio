import { expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import {
  configureExtensionPreparationWorker,
  stopExtensionPreparation,
  subscribePreparationEvents,
} from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";
import { createExtensionSourceWatcher } from "./extension-source-watcher";
import { hashExtensionSource } from "./hash-extension-source";

test("later edits do not extend the attachment barrier beyond its requested generation", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-attachment-generations-")));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const paths = ["first", "second"].map((name) => join(root, name));
  const registered = Promise.withResolvers<string>();
  const entered = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const released = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const offline = Promise.withResolvers<void>();
  let calls = 0;
  let watcher: Awaited<ReturnType<typeof createExtensionSourceWatcher>> | undefined;
  const unsubscribe = subscribePreparationEvents((event) => {
    if (event.registration && typeof event.watchId === "string") registered.resolve(event.watchId);
  });
  try {
    for (const path of paths) {
      await mkdir(path);
      await writeFile(join(path, "SKILL.md"), "initial");
    }
    await stopExtensionPreparation();
    // The host's generation barrier is the contract here. Native edit delivery
    // remains covered by the admission tests using the real preparation worker.
    configureExtensionPreparationWorker(
      () => new Worker(new URL("./preparation-watch-admission.fixture.ts", import.meta.url)),
    );
    watcher = await createExtensionSourceWatcher({
      listInstalledSources: async () => paths.map((source_path) => ({ source_path, install_name: source_path })),
      onSourceChanged: async (path) => {
        if (path === paths[1]) {
          offline.resolve();
          return;
        }
        const index = calls++;
        if (index < 2) {
          entered[index]!.resolve();
          await released[index]!.promise;
        }
      },
    });
    const watchId = await registered.promise;
    await runExtensionPreparation("notify", {
      event: {
        watchId,
        sourcePath: paths[0],
        sourceHash: hashExtensionSource(paths[0]!),
        attachment: true,
        changed: false,
      },
    });
    await entered[0]!.promise;
    await runExtensionPreparation("notify", {
      event: {
        watchId,
        sourcePath: paths[1],
        sourceHash: hashExtensionSource(paths[1]!),
        attachment: true,
        changed: false,
      },
    });
    await writeFile(join(paths[0]!, "SKILL.md"), "later edit");
    await runExtensionPreparation("notify", {
      event: { watchId, sourcePath: paths[0], sourceHash: hashExtensionSource(paths[0]!) },
    });
    await entered[1]!.promise;
    released[0]!.resolve();
    expect(await Promise.race([offline.promise.then(() => "reconciled"), Bun.sleep(1000).then(() => "stalled")])).toBe(
      "reconciled",
    );
    expect(calls).toBe(2);
  } finally {
    for (const release of released) release.resolve();
    await watcher?.dispose();
    unsubscribe();
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});
