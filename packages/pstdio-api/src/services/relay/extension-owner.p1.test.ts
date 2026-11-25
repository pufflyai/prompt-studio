import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultLocalWorkspaceCapabilities } from "pstdio-db";
import * as mountWatcher from "../../features/extensions/artifact-mount-watch/mount-watcher";
import { loadExtensionSource } from "../../features/extensions/extension-runtime";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestExtensionSource } from "../../features/extensions/test-utils/create-test-extension-source";
import { initializeProjectWorkspace } from "../../features/projects/project-folder";
import { apiLogger } from "../../lib/logger";
import { createTestApp } from "../../test-utils/create-test-app";
import { startRelayExtension } from "./extension-owner";

const waitFor = async (check: () => boolean | Promise<boolean>) => {
  const end = Date.now() + 3_000;
  while (!(await check())) {
    if (Date.now() >= end) throw new Error("Timed out waiting for relay progress");
    await Bun.sleep(10);
  }
};

type TestApp = Awaited<ReturnType<typeof createTestApp>>;
type RelayOwner = Awaited<ReturnType<typeof startRelayExtension>>;
type Records = Awaited<ReturnType<TestApp["deps"]["extensionStorageService"]["open"]>>["records"];

const checkWriteAccessRecovery = async (input: {
  mode: string;
  app: TestApp;
  workspaceId: string;
  folder: string;
  relay: RelayOwner;
  records: Records;
  attempts: () => number;
  writeDenials: () => number;
  watchCount: () => number;
  allowWatch: () => void;
}) => {
  const { mode, app, workspaceId, folder, relay, records } = input;
  const initiallyReadOnly = mode === "initially read-only";
  if (!initiallyReadOnly) {
    await waitFor(() => input.attempts() > 0);
    await app.deps.workspaceService.updateProviderProjection(workspaceId, {
      provider_capabilities_json: { ...defaultLocalWorkspaceCapabilities, files: "read" },
    });
  }
  await waitFor(() => input.writeDenials() === 1);
  expect(input.attempts()).toBe(initiallyReadOnly ? 0 : 1);
  if (mode === "read-only checkout") {
    // The earlier native failure would schedule a two-second repeat if writes were temporary.
    await Bun.sleep(2_100);
    expect(input.writeDenials()).toBe(1);
    expect((await relay.status()).error).toBeUndefined();
    return;
  }
  const documentsRoot = join(folder, ".pstdio/extension-storage/test.notes/documents");
  const file = join(documentsRoot, "restored-write.txt");
  if (initiallyReadOnly) {
    await waitFor(async () => !(await relay.status()).busy);
    await mkdir(documentsRoot, { recursive: true });
    await writeFile(file, "Written before the first watch");
  }
  await app.deps.workspaceService.updateProviderProjection(workspaceId, {
    provider_capabilities_json: defaultLocalWorkspaceCapabilities,
  });
  input.allowWatch();
  relay.resumeArtifactWatches?.();
  await waitFor(() => input.watchCount() === 4);
  if (!initiallyReadOnly) {
    await Bun.sleep(100);
    await writeFile(file, "External write after restoring access");
  }
  await waitFor(async () => (await records.read('["artifact-file","documents/restored-write.txt"]')).exists);
};

test.each([
  "recover",
  "cancel",
  "workspace setup",
  "checkout missing",
  "read-only checkout",
  "write access returns",
  "initially read-only",
])("documents sync while an artifact watch is unavailable (%s)", async (mode) => {
  const root = await mkdtemp(join(tmpdir(), "relay-watch-failure-"));
  const app = await createTestApp({ storageRoot: join(root, "home") });
  let peerReads = 0;
  const peer = documentPeer([], { onRead: () => peerReads++ });
  const controller = new AbortController();
  let relay: Awaited<ReturnType<typeof startRelayExtension>> | undefined;
  const nativeWatch = fs.watch;
  const watchMount = mountWatcher.watchArtifactMount;
  let failing = true;
  let attempts = 0;
  const handles = new Set<fs.FSWatcher>();
  let registration: ReturnType<typeof spyOn<typeof fs, "watch">> | undefined;
  let paired: ReturnType<typeof spyOn<typeof mountWatcher, "watchArtifactMount">> | undefined;
  let rootRetryError: ((error: unknown) => void) | undefined;
  let pendingWorkspaceRetries = 0;
  let writeDenials = 0;
  const debug = apiLogger.debug;
  const watcherDiagnostics = spyOn(apiLogger, "debug").mockImplementation((data, message) => {
    if (data.event === "relay.artifact_watch.workspace_pending") pendingWorkspaceRetries++;
    if (data.event === "relay.artifact_watch.write_denied") writeDenials++;
    debug(data, message);
  });
  try {
    const project = await app.deps.projectService.create({ name: "Independent watch recovery" });
    const folder = join(root, "checkout");
    await mkdir(folder);
    const workspace = await initializeProjectWorkspace(
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
    paired = spyOn(mountWatcher, "watchArtifactMount").mockImplementation((input) => {
      if (input.root.endsWith("documents")) rootRetryError = input.onRootRetryError;
      return watchMount({ ...input, platform: "darwin" });
    });
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
    const initiallyReadOnly = mode === "initially read-only";
    if (initiallyReadOnly) {
      await app.deps.workspaceService.updateProviderProjection(workspace.id, {
        provider_capabilities_json: { ...defaultLocalWorkspaceCapabilities, files: "read" },
      });
    }
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
    if (["read-only checkout", "write access returns", "initially read-only"].includes(mode)) {
      await checkWriteAccessRecovery({
        mode,
        app,
        workspaceId: workspace.id,
        folder,
        relay,
        records,
        attempts: () => attempts,
        writeDenials: () => writeDenials,
        watchCount: () => handles.size,
        allowWatch: () => {
          failing = false;
        },
      });
      return;
    }
    await waitFor(() => attempts > 0);
    const workspaceSetup = mode === "workspace setup";
    const checkoutMissing = mode === "checkout missing";
    if (workspaceSetup || checkoutMissing) {
      const parked = join(root, "parked-checkout");
      if (workspaceSetup) {
        try {
          await app.deps.workspaceService.setInitializing(workspace.id, true);
          await waitFor(() => pendingWorkspaceRetries === 1);
          expect(attempts).toBe(1);
        } finally {
          await app.deps.workspaceService.setInitializing(workspace.id, false);
        }
      }
      if (checkoutMissing) {
        fs.renameSync(folder, parked);
        failing = false;
        relay.wake();
        // Let the first scheduled retry pass while the registered path is absent.
        await Bun.sleep(1_200);
        expect(attempts).toBe(1);
        expect(fs.existsSync(folder)).toBe(false);
        fs.renameSync(parked, folder);
      }
      failing = false;
      await waitFor(() => handles.size === 4);
    } else {
      await waitFor(() => attempts >= 2);
      expect(failing).toBe(true);
      await waitFor(() => handles.size === 2);
    }
    expect((await relay.status()).error).toBeUndefined();
    await records.commit({ operationId: "while-failing", edits: [{ recordId: "note", replace: "Still syncing" }] });
    relay.wake();
    await waitFor(async () => (await records.outcome("while-failing"))?.state === "synced");
    if (mode !== "cancel") {
      const documentsRoot = join(folder, ".pstdio/extension-storage/test.notes/documents");
      await writeFile(join(documentsRoot, "gap.txt"), "Saved before recovery");
      failing = false;
      await waitFor(() => handles.size === 4);
      await waitFor(async () => (await records.read('["artifact-file","documents/gap.txt"]')).exists);
      await Bun.sleep(100);
      await writeFile(join(documentsRoot, "outside.txt"), "External save");
      await waitFor(async () => (await records.read('["artifact-file","documents/outside.txt"]')).exists);
      if (mode === "recover") {
        await Bun.sleep(1_100);
        await waitFor(async () => !(await relay!.status()).busy);
        const beforeErrors = peerReads;
        expect(rootRetryError).toBeDefined();
        rootRetryError?.(new Error("Still waiting for native root registration"));
        await Bun.sleep(100);
        rootRetryError?.(new Error("Still waiting for native root registration"));
        await Bun.sleep(100);
        expect(peerReads).toBe(beforeErrors);
      }
    }
    // Parent cancellation owns timers and handles even without an explicit close call.
    controller.abort();
    await relay.done;
    await waitFor(() => handles.size === 0);
    const stoppedAttempts = attempts;
    // The second failed open schedules a two-second retry.
    await Bun.sleep(mode === "cancel" ? 2_100 : 100);
    expect(attempts).toBe(stoppedAttempts);
  } finally {
    relay?.close();
    controller.abort();
    await relay?.done;
    watcherDiagnostics.mockRestore();
    registration?.mockRestore();
    paired?.mockRestore();
    await app.close();
    await peer.close();
    await rm(root, { recursive: true, force: true });
  }
}, 10_000);
