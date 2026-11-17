import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPreparationScope, readAcceptedRevision, withBackgroundPreparation } from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";
import { loadExtensionSource } from "./extension-runtime";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { writeExtension, writeManagedBuildOutput } from "./test-utils/webview-build-fixture";

test("a foreground request lends urgency to every overlapping background webview check", async () => {
  const root = mkdtempSync(join(tmpdir(), "webview-request-priority-"));
  const sourcePath = join(root, "extension");
  writeExtension(sourcePath, { main: "src/main.tsx" });
  const loaded = await loadExtensionSource(sourcePath);
  const entered = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const released = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const observed: ReturnType<typeof createPreparationScope>[] = [];
  const work: Promise<unknown>[] = [];
  const caller = withBackgroundPreparation(createPreparationScope);
  const manager = createExtensionWebviewBuildManager({
    listInstalledSources: async () => [
      { id: "lab", install_name: "lab", source_path: sourcePath, updated_at: "2026-11-10T00:00:00Z" },
    ],
    loadSource: async () => {
      const index = observed.length;
      if (index < 2) {
        observed.push(createPreparationScope());
        entered[index]!.resolve();
        await released[index]!.promise;
      }
      return loaded;
    },
    reportBuildFailure: async () => "reported",
    reportBuildSuccess: async () => "reported",
    buildWebview: async (input) => {
      writeManagedBuildOutput(input);
      return { success: true, details: "" };
    },
    webviewCacheRoot: join(root, "cache"),
  });
  let release: (() => void) | undefined;
  try {
    work.push(manager.refresh(sourcePath));
    await entered[0]!.promise;
    work.push(manager.refresh(sourcePath));
    await entered[1]!.promise;
    work.push(caller.run(() => manager.ensure("lab")));
    expect(observed.map((scope) => scope.requested)).toEqual([false, false]);
    release = caller.request();
    for (let tick = 0; tick < 200 && !observed.every((scope) => scope.requested); tick++) await Bun.sleep(5);
    expect(observed.map((scope) => scope.requested)).toEqual([true, true]);
    release();
    expect(observed.map((scope) => scope.requested)).toEqual([false, false]);
    release = caller.request();
    expect(observed.map((scope) => scope.requested)).toEqual([true, true]);
    released[0]!.resolve();
    released[1]!.resolve();
    await Promise.all(work);
    expect(observed.map((scope) => scope.requested)).toEqual([false, false]);
  } finally {
    release?.();
    caller.dispose();
    manager.dispose();
    for (const gate of released) gate.resolve();
    await Promise.allSettled(work);
    for (const scope of observed) scope.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("native-only source adoption records an empty completed frontend set", async () => {
  const root = mkdtempSync(join(tmpdir(), "native-only-webview-completion-"));
  const sourcePath = join(root, "extension");
  writeExtension(sourcePath, {});
  const manager = createExtensionWebviewBuildManager({
    listInstalledSources: async () => [
      { id: "lab", install_name: "lab", source_path: sourcePath, updated_at: "2026-11-10T00:00:00Z" },
    ],
    reportBuildFailure: async () => "reported",
    reportBuildSuccess: async () => "reported",
    webviewCacheRoot: join(root, "cache"),
  });
  try {
    await loadExtensionSource(sourcePath, { accepted: true });
    expect((await readAcceptedRevision(sourcePath))?.webviews).toBeUndefined();
    await manager.adopt(sourcePath);
    expect((await readAcceptedRevision(sourcePath))?.webviews).toEqual({});
    manager.dispose();
    // A fresh manager must use the durable completion without loading source again.
    const fresh = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { id: "lab", install_name: "lab", source_path: sourcePath, updated_at: "2026-11-10T00:00:00Z" },
      ],
      loadSource: async () => {
        throw new Error("Completed source should not need reinspection");
      },
      onError: (error) => {
        throw error;
      },
      reportBuildFailure: async () => "reported",
      reportBuildSuccess: async () => "reported",
      webviewCacheRoot: join(root, "cache"),
    });
    try {
      await fresh.ensure("lab");
    } finally {
      fresh.dispose();
    }
  } finally {
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("a native-only adopted graph needs no mutable runtime inspection for frontend refresh", async () => {
  const root = mkdtempSync(join(tmpdir(), "native-only-frontend-refresh-"));
  const sourcePath = join(root, "extension");
  writeExtension(sourcePath, {});
  const errors: unknown[] = [];
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
  const blockedSource = join(root, "blocked");
  writeExtension(blockedSource, {});
  writeFileSync(
    join(blockedSource, "extension.ts"),
    `await fetch(${JSON.stringify(gate.url.href)}); export default {};`,
  );
  const manager = createExtensionWebviewBuildManager({
    listInstalledSources: async () => [
      { id: "native", install_name: "lab", source_path: sourcePath, updated_at: "initial" },
    ],
    reportBuildFailure: async () => "reported",
    reportBuildSuccess: async () => "reported",
    onError: (error) => errors.push(error),
    webviewCacheRoot: join(root, "cache"),
  });
  let blocked: Promise<unknown> | undefined;
  let refresh: Promise<void> | undefined;
  try {
    const loaded = await loadExtensionSource(sourcePath, { accepted: true });
    await manager.adopt(sourcePath);
    rmSync(join(sourcePath, "package.json"));
    blocked = withBackgroundPreparation(() =>
      runExtensionPreparation("source.validate", { sourcePath: blockedSource }),
    );
    await entered.promise;
    refresh = manager.refresh(sourcePath);
    expect(await Promise.race([refresh.then(() => "refreshed"), Bun.sleep(1000).then(() => "blocked")])).toBe(
      "refreshed",
    );
    expect(errors).toEqual([]);
    expect((await readAcceptedRevision(sourcePath))?.id).toBe(loaded.preparedRevision!.id);
    expect((await readAcceptedRevision(sourcePath))?.webviews).toEqual({});
  } finally {
    release.resolve();
    await Promise.allSettled([blocked, refresh]);
    await gate.stop(true);
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});
