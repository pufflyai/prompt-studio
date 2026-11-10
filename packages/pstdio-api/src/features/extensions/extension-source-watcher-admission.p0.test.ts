import { expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stopExtensionPreparation, subscribePreparationEvents } from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";
import { createExtensionSourceWatcher } from "./extension-source-watcher";

test("source edits overtake pending attachment reconciliation without losing offline checks", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-attachment-admission-")));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const paths = ["first", "second", "edited"].map((name) => join(root, name));
  for (const path of paths) {
    await mkdir(path);
    await writeFile(join(path, "SKILL.md"), "offline edit");
  }
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const edited = Promise.withResolvers<void>();
  const offline = Promise.withResolvers<void>();
  const observed: string[] = [];
  const errors: unknown[] = [];
  const watcher = await createExtensionSourceWatcher({
    listInstalledSources: async () => paths.map((source_path) => ({ source_path, install_name: source_path })),
    onSourceChanged: async (path) => {
      observed.push(path);
      if (path === paths[0]) {
        entered.resolve();
        await release.promise;
      }
      if (path === paths[1]) offline.resolve();
      if (path === paths[2]) edited.resolve();
    },
    onError: (error) => errors.push(error),
  });
  try {
    await entered.promise;
    expect(observed).toEqual([paths[0]!]);
    await writeFile(join(paths[2]!, "SKILL.md"), "live edit");
    await edited.promise;
    expect(observed).toEqual([paths[0]!, paths[2]!]);
    release.resolve();
    await offline.promise;
    expect(observed).toEqual([paths[0]!, paths[2]!, paths[1]!]);
    expect(errors).toEqual([]);
  } finally {
    release.resolve();
    await watcher.dispose();
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});

test("disposal clears attachment checks that have not started", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-attachment-dispose-")));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const paths = ["first", "second"].map((name) => join(root, name));
  for (const path of paths) await mkdir(path);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const observed: string[] = [];
  const watcher = await createExtensionSourceWatcher({
    listInstalledSources: async () => paths.map((source_path) => ({ source_path, install_name: source_path })),
    onSourceChanged: async (path) => {
      observed.push(path);
      entered.resolve();
      await release.promise;
    },
  });
  try {
    await entered.promise;
    const disposal = watcher.dispose();
    release.resolve();
    await disposal;
    expect(observed).toEqual([paths[0]!]);
  } finally {
    release.resolve();
    await watcher.dispose();
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});

test("later edits do not extend the attachment barrier beyond its requested generation", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-attachment-generations-")));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const paths = ["first", "second"].map((name) => join(root, name));
  for (const path of paths) {
    await mkdir(path);
    await writeFile(join(path, "SKILL.md"), "initial");
  }
  const entered = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const released = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const notified = Promise.withResolvers<void>();
  const offline = Promise.withResolvers<void>();
  let calls = 0;
  const watcher = await createExtensionSourceWatcher({
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
  const unsubscribe = subscribePreparationEvents((event) => {
    if (event.sourcePath === paths[0] && !event.attachment) notified.resolve();
  });
  try {
    await entered[0]!.promise;
    await writeFile(join(paths[0]!, "SKILL.md"), "later edit");
    await notified.promise;
    released[0]!.resolve();
    await entered[1]!.promise;
    expect(await Promise.race([offline.promise.then(() => "reconciled"), Bun.sleep(1000).then(() => "stalled")])).toBe(
      "reconciled",
    );
    expect(calls).toBe(2);
  } finally {
    for (const release of released) release.resolve();
    unsubscribe();
    await watcher.dispose();
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});

test("reattachment keeps a fresh callback after an already running inspection", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-attachment-gap-")));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const source = join(root, "source");
  await mkdir(source);
  const skill = join(source, "SKILL.md");
  await writeFile(skill, "initial");
  const entered = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const reconciled = Promise.withResolvers<void>();
  let watchId: string | undefined;
  let calls = 0;
  const unsubscribe = subscribePreparationEvents((event) => {
    if (event.sourcePath === source && typeof event.watchId === "string") watchId = event.watchId;
  });
  const watcher = await createExtensionSourceWatcher({
    listInstalledSources: async () => [{ source_path: source, install_name: "source" }],
    onSourceChanged: async () => {
      if (++calls === 1) {
        entered.resolve();
        await released.promise;
      } else reconciled.resolve();
    },
  });
  try {
    await entered.promise;
    await runExtensionPreparation("watch.dispose", { id: watchId });
    await writeFile(skill, "offline edit");
    await watcher.refresh();
    released.resolve();
    await reconciled.promise;
    expect(calls).toBe(2);
  } finally {
    released.resolve();
    unsubscribe();
    await watcher.dispose();
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});
