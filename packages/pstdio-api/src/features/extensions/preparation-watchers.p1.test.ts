import { afterEach, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { createPreparationClient } from "pstdio-extensions/preparation-client";
import { createTestSkillExtensionSource } from "./test-utils/create-test-extension-source";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

test.each([
  "initial attachment",
  "new source attachment",
  "reattachment",
])("a delayed source watcher reconciles editable files after %s", async (phase) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "preparation-watch-gap-")));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const sourcePath = join(root, "extension");
  await mkdir(sourcePath);
  const skill = join(sourcePath, "SKILL.md");
  const copy = join(root, "workspace-skill.md");
  await writeFile(skill, "Old steps");
  await copyFile(skill, copy);
  const client = createPreparationClient(
    () => new Worker(new URL("./extension-preparation-worker.ts", import.meta.url)),
  );
  cleanups.push(() => client.stop());
  const options = { home: join(root, "home") };
  const input = {
    id: "editable-source",
    kind: "sources",
    rows: [{ install_name: "fixture", source_path: sourcePath }],
  };
  if (phase === "new source attachment") await client.run("watch.update", { ...input, rows: [] }, options);
  if (phase === "reattachment") {
    await client.run("watch.update", input, options);
    await client.run("watch.dispose", { id: input.id }, options);
  }
  const notifications: string[] = [];
  client.subscribe((event) => {
    if (event.watchId === input.id && typeof event.sourcePath === "string") notifications.push(event.sourcePath);
  });
  // The foreground operation completed while registration was still queued.
  await writeFile(skill, "New steps");
  await client.run("watch.update", input, options);
  expect(notifications).toContain(sourcePath);
  for (const path of notifications) await copyFile(join(path, "SKILL.md"), copy);
  expect(await readFile(copy, "utf8")).toBe("New steps");
  const delivered = notifications.length;
  await client.run("watch.update", input, options);
  expect(notifications).toHaveLength(delivered);
  await client.run("watch.dispose", { id: input.id }, options);
});

test("a focused update attaches every newly listed source before reconciling it", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "preparation-watch-batch-")));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const paths = [join(root, "first"), join(root, "second")];
  for (const path of paths) {
    await mkdir(path);
    await writeFile(join(path, "SKILL.md"), "Old steps");
  }
  const client = createPreparationClient(
    () => new Worker(new URL("./extension-preparation-worker.ts", import.meta.url)),
  );
  cleanups.push(() => client.stop());
  const options = { home: join(root, "home") };
  const input = {
    id: "batch",
    kind: "sources",
    rows: paths.map((path) => ({ install_name: path, source_path: path })),
  };
  await client.run("watch.update", { ...input, rows: [] }, options);
  await client.run("watch.update", { ...input, sourcePath: paths[0] }, options);
  const changed = Promise.withResolvers<void>();
  const unsubscribe = client.subscribe((event) => {
    if (event.watchId === input.id && event.sourcePath === paths[1]) changed.resolve();
  });
  try {
    await writeFile(join(paths[1]!, "SKILL.md"), "New steps");
    // A later focused refresh must not establish its watch after this edit.
    await client.run("watch.update", { ...input, sourcePath: paths[1] }, options);
    await changed.promise;
    expect(await readFile(join(paths[1]!, "SKILL.md"), "utf8")).toBe("New steps");
  } finally {
    unsubscribe();
    await client.run("watch.dispose", { id: input.id }, options);
  }
});

test("an attachment failure leaves a repaired source eligible for reconciliation", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "preparation-watch-repair-")));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const sourcePath = join(root, "extension");
  const client = createPreparationClient(
    () => new Worker(new URL("./extension-preparation-worker.ts", import.meta.url)),
  );
  cleanups.push(() => client.stop());
  const options = { home: join(root, "home") };
  const input = {
    id: "repair",
    kind: "sources",
    sourcePath,
    rows: [{ install_name: "fixture", source_path: sourcePath }],
  };
  await client.run("watch.update", { ...input, rows: [] }, options);
  const failure = await client.run("watch.update", input, options).catch((error) => error);
  expect(failure).toBeInstanceOf(Error);
  await mkdir(sourcePath);
  await writeFile(join(sourcePath, "SKILL.md"), "New steps");
  const notifications: string[] = [];
  client.subscribe((event) => {
    if (event.watchId === input.id && typeof event.sourcePath === "string") notifications.push(event.sourcePath);
  });
  await client.run("watch.update", input, options);
  expect(notifications).toContain(sourcePath);
  await client.run("watch.dispose", { id: input.id }, options);
});

test("reattachment identifies offline source changes before slow frontend reconciliation", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "preparation-watch-offline-")));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const sourcePath = createTestSkillExtensionSource({
    root,
    name: "source",
    installName: "source",
    displayName: "Source",
  });
  const skill = join(sourcePath, "SKILL.md");
  await writeFile(skill, "accepted");
  const client = createPreparationClient(
    () => new Worker(new URL("./extension-preparation-worker.ts", import.meta.url)),
  );
  cleanups.push(() => client.stop());
  const input = {
    id: "offline",
    kind: "sources",
    rows: [{ install_name: "source", source_path: sourcePath, source_hash: "opaque-source-version" }],
  };
  const options = { home: join(root, "home") };
  const revision = await client.run("runtime.prepare", { sourcePath }, options);
  await client.run("runtime.accept", { sourcePath, revision }, options);
  const events: Record<string, unknown>[] = [];
  client.subscribe((event) => {
    if (event.attachment) events.push(event);
  });
  await client.run("watch.update", input, options);
  expect(events.at(-1)?.changed).toBe(false);
  await client.run("watch.dispose", { id: input.id }, options);
  await writeFile(skill, "offline edit");
  await client.run("watch.update", input, options);
  expect(events.at(-1)?.changed).toBe(true);
  await client.run("watch.dispose", { id: input.id }, options);
});
