import { expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import {
  configureExtensionPreparationWorker,
  createPreparationScope,
  stopExtensionPreparation,
  subscribePreparationEvents,
} from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";
import { loadExtensionSource } from "./extension-runtime";
import { createExtensionSourceWatcher } from "./extension-source-watcher";
import { createTestSkillExtensionSource } from "./test-utils/create-test-extension-source";

test.each([
  { name: "repeated metadata", sourceHash: "A", metadataOnly: true, priority: "background" },
  { name: "changed metadata", sourceHash: "B", metadataOnly: true, priority: "requested" },
  { name: "unknown metadata", sourceHash: undefined, metadataOnly: true, priority: "requested" },
  { name: "ordinary source event", sourceHash: "A", metadataOnly: false, priority: "requested" },
])("fresh source reconciliation retains appropriate admission for $name", async (scenario) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-metadata-admission-")));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const source = createTestSkillExtensionSource({ root, name: "source", installName: "source", displayName: "Source" });
  let watcher: Awaited<ReturnType<typeof createExtensionSourceWatcher>> | undefined;
  let watchId: string | undefined;
  let generation = 0;
  const finished = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const priorities: (string | undefined)[] = [];
  const unsubscribe = subscribePreparationEvents((event) => {
    if (event.registration && typeof event.watchId === "string") watchId = event.watchId;
  });
  try {
    await loadExtensionSource(source, { accepted: true });
    await stopExtensionPreparation();
    configureExtensionPreparationWorker(
      () => new Worker(new URL("./preparation-watch-admission.fixture.ts", import.meta.url)),
    );
    watcher = await createExtensionSourceWatcher({
      listInstalledSources: async () => [{ source_path: source, install_name: "source" }],
      onSourceChanged: async () => {
        const scope = createPreparationScope();
        priorities.push(scope.continuation?.priority);
        scope.dispose();
      },
      afterSourceChanged: async () => finished[generation++]!.resolve(),
    });
    await runExtensionPreparation("notify", {
      event: { watchId, sourcePath: source, sourceHash: "A", attachment: true, changed: false },
    });
    await finished[0]!.promise;
    await runExtensionPreparation("notify", {
      event: { watchId, sourcePath: source, sourceHash: scenario.sourceHash, metadataOnly: scenario.metadataOnly },
    });
    await finished[1]!.promise;
    expect(priorities).toEqual(["background", scenario.priority]);
  } finally {
    await watcher?.dispose();
    unsubscribe();
    await stopExtensionPreparation();
    configureExtensionPreparationWorker(
      () => new Worker(new URL("./extension-preparation-worker.ts", import.meta.url)),
    );
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});
