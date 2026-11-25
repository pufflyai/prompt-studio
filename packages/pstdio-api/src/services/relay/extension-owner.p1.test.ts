import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as mountWatcher from "../../features/extensions/artifact-mount-watch/mount-watcher";
import { loadExtensionSource } from "../../features/extensions/extension-runtime";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestExtensionSource } from "../../features/extensions/test-utils/create-test-extension-source";
import { initializeProjectWorkspace } from "../../features/projects/project-folder";
import { createTestApp } from "../../test-utils/create-test-app";
import { startRelayExtension } from "./extension-owner";

const waitFor = async (check: () => boolean | Promise<boolean>) => {
  const end = Date.now() + 3_000;
  while (!(await check())) {
    if (Date.now() >= end) throw new Error("Timed out waiting for relay progress");
    await Bun.sleep(10);
  }
};

test.each([false, true])("documents sync during a failed flat watch; close before recovery: %s", async (closeEarly) => {
  const root = await mkdtemp(join(tmpdir(), "relay-watch-failure-"));
  const app = await createTestApp({ storageRoot: join(root, "home") });
  const peer = documentPeer();
  const controller = new AbortController();
  let relay: Awaited<ReturnType<typeof startRelayExtension>> | undefined;
  const nativeWatch = fs.watch;
  const watchMount = mountWatcher.watchArtifactMount;
  let failing = true;
  let attempts = 0;
  const handles = new Set<fs.FSWatcher>();
  let registration: ReturnType<typeof spyOn<typeof fs, "watch">> | undefined;
  let paired: ReturnType<typeof spyOn<typeof mountWatcher, "watchArtifactMount">> | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "Independent watch recovery" });
    const folder = join(root, "checkout");
    await mkdir(folder);
    await initializeProjectWorkspace(
      app.deps,
      project.id,
      { provider_id: "pstdio.root", params: { path: folder } },
      async () => [],
    );
    const path = createTestExtensionSource({ root, installName: "notes", name: "notes", displayName: "Notes" });
    await writeFile(
      join(path, "extension.ts"),
      `export default { artifactMounts: [
      { id: "documents", ref: { kind: "artifact-mount", id: "documents" }, path: "documents", label: "Documents" },
      { id: "other", ref: { kind: "artifact-mount", id: "other" }, path: "other", label: "Other" }
    ] };`,
    );
    const source = await loadExtensionSource(path);
    await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath: path,
      extensionId: source.metadata.id,
      installName: "notes",
      name: "notes",
      displayName: "Notes",
      manifest: source.manifest,
      version: "0.0.0",
    });
    const snapshot = await app.deps.extensionRuntimeCatalog.get(project.id);
    const owner = { workbenchId: project.id, extensionId: source.metadata.id };
    const { records } = await app.deps.extensionStorageService.open({ owner });
    await records.commit({
      operationId: "initial",
      edits: [{ recordId: "note", replace: "Saved despite failed watch" }],
    });
    // Exercise the real paired-watch failure and partial-handle cleanup on every host.
    paired = spyOn(mountWatcher, "watchArtifactMount").mockImplementation((input) =>
      watchMount({ ...input, platform: "darwin" }),
    );
    registration = spyOn(fs, "watch").mockImplementation(((...args: [fs.PathLike, unknown?, unknown?]) => {
      const [path, options] = args;
      if (typeof path !== "string" || !path.includes(join("test.notes", "")))
        return Reflect.apply(nativeWatch, fs, args);
      if (
        path.endsWith("documents") &&
        options &&
        typeof options === "object" &&
        "recursive" in options &&
        options.recursive === false
      ) {
        attempts++;
        if (failing) throw Object.assign(new Error("Native flat watch unavailable"), { code: "ENOSPC" });
      }
      const handle = Reflect.apply(nativeWatch, fs, args);
      handles.add(handle);
      handle.once("close", () => handles.delete(handle));
      return handle;
    }) as typeof fs.watch);
    relay = await startRelayExtension({
      config: {
        accountId: "owner",
        workbenchId: project.id,
        environmentId: "device",
        managerOrigin: peer.origin,
        relayOrigin: peer.origin,
        renewalGrant: "fixture",
      },
      source: snapshot.enabledSources[0]!,
      snapshot,
      deps: app.deps,
      signal: controller.signal,
      contextKey: "fixture",
      statusChanged: () => {},
      access: async () => ({ token: "fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
    await waitFor(async () => (await records.outcome("initial"))?.state === "synced");
    expect(attempts).toBeGreaterThan(0);
    await waitFor(() => attempts >= 2);
    expect(failing).toBe(true);
    expect((await relay.status()).error).toBeUndefined();
    await waitFor(() => handles.size === 2);
    await records.commit({ operationId: "while-failing", edits: [{ recordId: "note", replace: "Still syncing" }] });
    relay.wake();
    await waitFor(async () => (await records.outcome("while-failing"))?.state === "synced");
    if (!closeEarly) {
      const documentsRoot = join(folder, ".pstdio/extension-storage/test.notes/documents");
      await writeFile(join(documentsRoot, "gap.txt"), "Saved before recovery");
      failing = false;
      await waitFor(() => handles.size === 4);
      await waitFor(async () => (await records.read('["artifact-file","documents/gap.txt"]')).exists);
      await Bun.sleep(100);
      await writeFile(join(documentsRoot, "outside.txt"), "External save");
      await waitFor(async () => (await records.read('["artifact-file","documents/outside.txt"]')).exists);
    }
    // Parent cancellation owns timers and handles even without an explicit close call.
    controller.abort();
    await relay.done;
    await waitFor(() => handles.size === 0);
    const stoppedAttempts = attempts;
    // The second failed open schedules a two-second retry.
    await Bun.sleep(closeEarly ? 2_100 : 100);
    expect(attempts).toBe(stoppedAttempts);
  } finally {
    relay?.close();
    controller.abort();
    await relay?.done;
    registration?.mockRestore();
    paired?.mockRestore();
    await app.close();
    await peer.close();
    await rm(root, { recursive: true, force: true });
  }
}, 10_000);
