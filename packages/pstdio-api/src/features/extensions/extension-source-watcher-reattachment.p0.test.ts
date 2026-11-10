import { expect, test } from "bun:test";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPreparationScope, stopExtensionPreparation } from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";
import { loadExtensionSource } from "./extension-runtime";
import { createExtensionSourceWatcher } from "./extension-source-watcher";
import { createTestSkillExtensionSource } from "./test-utils/create-test-extension-source";

test("reattaching an observed edit permits inventory while a new offline edit retains live admission", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-observed-reattachment-")));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const source = createTestSkillExtensionSource({ root, name: "source", installName: "source", displayName: "Source" });
  const skill = join(source, "SKILL.md");
  await writeFile(skill, "accepted A");
  await loadExtensionSource(source, { accepted: true });
  const phases = ["initial", "live", "repeated", "offline"] as const;
  type Phase = (typeof phases)[number];
  const entered = Object.fromEntries(phases.map((phase) => [phase, Promise.withResolvers<void>()])) as Record<
    Phase,
    ReturnType<typeof Promise.withResolvers<void>>
  >;
  const finished = Object.fromEntries(phases.map((phase) => [phase, Promise.withResolvers<void>()])) as typeof entered;
  const releaseRepeated = Promise.withResolvers<void>(),
    releaseOffline = Promise.withResolvers<void>();
  let phase: Phase = "initial";
  const priorities: Partial<Record<Phase, string>> = {};
  const watcher = await createExtensionSourceWatcher({
    listInstalledSources: async () => [{ source_path: source, install_name: "source" }],
    onSourceChanged: async () => {
      const current = phase,
        scope = createPreparationScope();
      priorities[current] = scope.continuation?.priority;
      scope.dispose();
      entered[current].resolve();
      if (current === "repeated") await releaseRepeated.promise;
      if (current === "offline") await releaseOffline.promise;
    },
    afterSourceChanged: async () => {
      finished[phase].resolve();
    },
  });
  let inventory: Promise<unknown> | undefined;
  try {
    await finished.initial.promise;
    phase = "live";
    await writeFile(skill, "observed B");
    await finished.live.promise;
    expect(priorities.live).toBe("requested");
    await stopExtensionPreparation(false);
    phase = "repeated";
    await watcher.refresh();
    await entered.repeated.promise;
    inventory = runExtensionPreparation("source.hash", { sourcePath: source }, { preserveActiveContinuation: true });
    expect(typeof (await inventory)).toBe("string");
    expect(priorities.repeated).toBe("background");
    releaseRepeated.resolve();
    await finished.repeated.promise;
    await stopExtensionPreparation(false);
    phase = "offline";
    await writeFile(skill, "unseen C");
    await watcher.refresh();
    await entered.offline.promise;
    inventory = runExtensionPreparation("source.hash", { sourcePath: source }, { preserveActiveContinuation: true });
    expect(await Promise.race([inventory.then(() => "ready"), Bun.sleep(100).then(() => "held")])).toBe("held");
    expect(priorities.offline).toBe("requested");
    releaseOffline.resolve();
    await inventory;
  } finally {
    releaseRepeated.resolve();
    releaseOffline.resolve();
    await inventory;
    await watcher.dispose();
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});
