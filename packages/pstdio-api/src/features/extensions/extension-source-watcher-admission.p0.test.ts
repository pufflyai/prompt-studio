import { expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPreparationScope, stopExtensionPreparation, subscribePreparationEvents } from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";
import { loadExtensionSource } from "./extension-runtime";
import { createExtensionSourceWatcher } from "./extension-source-watcher";
import { hashExtensionSource } from "./hash-extension-source";
import { createTestSkillExtensionSource } from "./test-utils/create-test-extension-source";

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
    const disposal = Promise.resolve(watcher.dispose());
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

test.each([
  "edit",
  "attachment",
] as const)("a source %s retains its frontend continuation across asynchronous host steps", async (origin) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-edit-continuation-")));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const source = createTestSkillExtensionSource({
    root,
    name: "continuation",
    installName: "continuation",
    displayName: "Continuation",
  });
  await writeFile(join(source, "SKILL.md"), "initial");
  await loadExtensionSource(source, { accepted: true });
  const attached = Promise.withResolvers<void>();
  const editing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  let requested: boolean | undefined;
  const watcher = await createExtensionSourceWatcher({
    listInstalledSources: async () => [{ source_path: source, install_name: "source" }],
    onSourceChanged: async () => {
      if (++calls === 1 && origin === "edit") {
        attached.resolve();
        return;
      }
      const scope = createPreparationScope();
      requested = scope.requested;
      scope.dispose();
      editing.resolve();
      await release.promise;
    },
  });
  let background: Promise<unknown> | undefined;
  try {
    if (origin === "edit") {
      await attached.promise;
      await writeFile(join(source, "SKILL.md"), "live edit");
    }
    await editing.promise;
    background = runExtensionPreparation("source.hash", { sourcePath: source }, { priority: "background" });
    expect(await Promise.race([background.then(() => "started"), Bun.sleep(100).then(() => "held")])).toBe("held");
    expect(requested).toBe(false);
    release.resolve();
    expect(typeof (await background)).toBe("string");
  } finally {
    release.resolve();
    await background;
    await watcher.dispose();
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});

test("source provisioning releases the frontend continuation while remaining owned by disposal", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-edit-provisioning-")));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const source = join(root, "source");
  await mkdir(source);
  await writeFile(join(source, "SKILL.md"), "initial");
  const attached = Promise.withResolvers<void>();
  const editing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  const watcher = await createExtensionSourceWatcher({
    listInstalledSources: async () => [{ source_path: source, install_name: "source" }],
    onSourceChanged: async () => {},
    afterSourceChanged: async () => {
      if (++calls === 1) {
        attached.resolve();
        return;
      }
      editing.resolve();
      await release.promise;
    },
  });
  let background: Promise<unknown> | undefined;
  try {
    await attached.promise;
    await writeFile(join(source, "SKILL.md"), "live edit");
    await editing.promise;
    background = runExtensionPreparation("source.hash", { sourcePath: source }, { priority: "background" });
    expect(await Promise.race([background.then(() => "started"), Bun.sleep(1000).then(() => "held")])).toBe("started");
    const disposal = Promise.resolve(watcher.dispose());
    expect(await Promise.race([disposal.then(() => "disposed"), Bun.sleep(100).then(() => "owned")])).toBe("owned");
    release.resolve();
    await disposal;
  } finally {
    release.resolve();
    await background;
    await watcher.dispose();
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});

test.each([
  false,
  true,
])("a later edit refreshes before its predecessor ends and retains provisioning ownership (failure: %s)", async (fail) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-frontend-generations-")));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const source = join(root, "source");
  await mkdir(source);
  await writeFile(join(source, "SKILL.md"), "initial");
  const attached = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const edited = Promise.withResolvers<void>();
  const provisioned = Promise.withResolvers<void>();
  let callbacks = 0;
  const phases: string[] = [];
  const errors: unknown[] = [];
  const watcher = await createExtensionSourceWatcher({
    listInstalledSources: async () => [{ source_path: source, install_name: "source" }],
    onSourceChanged: async () => {
      if (++callbacks === 1) {
        attached.resolve();
        await release.promise;
      } else {
        edited.resolve();
        if (fail) throw new Error("Changed frontend failed");
      }
    },
    afterSourceChanged: async () => {
      phases.push("provision");
      if (phases.length === (fail ? 1 : 2)) provisioned.resolve();
    },
    onError: (error) => errors.push(error),
  });
  try {
    await attached.promise;
    await writeFile(join(source, "SKILL.md"), "edited");
    expect(await Promise.race([edited.promise.then(() => "fresh"), Bun.sleep(1000).then(() => "blocked")])).toBe(
      "fresh",
    );
    expect(phases).toEqual([]);
    const disposal = Promise.resolve(watcher.dispose());
    expect(await Promise.race([disposal.then(() => "disposed"), Bun.sleep(50).then(() => "owned")])).toBe("owned");
    release.resolve();
    await disposal;
    await provisioned.promise;
    expect(phases).toEqual(fail ? ["provision"] : ["provision", "provision"]);
    expect(errors.map((error) => (error as Error).message)).toEqual(fail ? ["Changed frontend failed"] : []);
  } finally {
    release.resolve();
    await watcher.dispose();
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});

test("reattachment admits offline edits before an unrelated held reconciliation", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-offline-admission-")));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const paths = ["first", "edited"].map((name) => join(root, name));
  for (const path of paths) {
    await mkdir(path);
    await writeFile(join(path, "SKILL.md"), "accepted");
  }
  const rows = paths.map((source_path) => ({
    source_path,
    install_name: source_path,
    source_hash: hashExtensionSource(source_path),
  }));
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const edited = Promise.withResolvers<void>();
  let watchId: string | undefined;
  const unsubscribe = subscribePreparationEvents((event) => {
    if (event.sourcePath === paths[0] && typeof event.watchId === "string") watchId = event.watchId;
  });
  const watcher = await createExtensionSourceWatcher({
    listInstalledSources: async () => rows,
    onSourceChanged: async (path) => {
      if (path === paths[0]) {
        entered.resolve();
        await release.promise;
      } else edited.resolve();
    },
  });
  try {
    await entered.promise;
    await runExtensionPreparation("watch.dispose", { id: watchId });
    await writeFile(join(paths[1]!, "SKILL.md"), "offline edit");
    await watcher.refresh();
    expect(await Promise.race([edited.promise.then(() => "admitted"), Bun.sleep(1000).then(() => "blocked")])).toBe(
      "admitted",
    );
  } finally {
    release.resolve();
    unsubscribe();
    await watcher.dispose();
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});
