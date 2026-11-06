import type {
  FolderRecoveryError,
  ProjectFolderRecoveryStatus,
  ProjectFolderSource,
  ProjectFolderSourceRef,
} from "pstdio-api-contracts";
import type { createDocumentRelay } from "pstdio-sync/relay";
import type { createRecoveryCatalog } from "./catalog";
import type { RecoveryChunk } from "./chunks";
import { type RecoveryChunkStore, readRecoveryManifest } from "./manifest";
import { checkRecoveryDestination, restoreRecoveryCapture } from "./restore";
import { RecoveryRestoreError } from "./restore-error";
import { RecoveryCaptureError } from "./scan";
import { downloadRecoveryCapture } from "./transfer";
import { walkRecoveryGraph } from "./transfer-graph";

type Transport = Awaited<ReturnType<ReturnType<typeof createDocumentRelay>["manifestBlobs"]>>;
type Status = ProjectFolderRecoveryStatus;
/** Attaches a published folder; returns whether it became the project's folder. */
export type RecoveryAttach = (path: string, enroll: (workspaceId: string) => Promise<void>) => Promise<boolean>;

const idle = { state: "idle" as const, source: null, bytes: { completed: 0, total: null }, error: null };
const progressMs = 250;

/** Turns any failure into a code and message a person can act on. Paths stay folder-relative. */
export const folderRecoveryError = (error: unknown, signal?: AbortSignal): FolderRecoveryError => {
  // A specific failure, such as binding a folder that was already published, outranks a late cancel.
  if (error instanceof RecoveryRestoreError) return { code: error.code, message: error.message, path: error.path };
  if (signal?.aborted) return { code: "cancelled", message: "The operation was cancelled.", path: null };
  if (error instanceof RecoveryCaptureError)
    return { code: "capture_incomplete", message: error.message, path: error.path || null };
  const text = error instanceof Error ? error.message : "";
  if (/does not match its complete reference|failed verification|does not match its/i.test(text))
    return { code: "integrity", message: "Downloaded bytes failed verification. Download the copy again.", path: null };
  if ((error as NodeJS.ErrnoException).code === "ENOENT")
    return {
      code: "not_downloaded",
      message: "Part of this copy is not on this device. Download it first.",
      path: null,
    };
  if ((error as NodeJS.ErrnoException).code === "ENOTSUP")
    return { code: "unsupported", message: "This system cannot recover folders safely yet.", path: null };
  if ((error as NodeJS.ErrnoException).code === "ENAMETOOLONG")
    return { code: "destination_too_long", message: "A restored path is longer than this disk allows.", path: null };
  if ((error as NodeJS.ErrnoException).code === "ENOSPC")
    return { code: "failed", message: "This disk is full. Free space and try again.", path: null };
  return { code: "failed", message: "The operation failed. Try again.", path: null };
};

/**
 * Download and restore of completed folder copies for one project. Progress lives only in
 * this process and is read through the project's derived sync status. One operation runs
 * at a time; cancelling it removes only what it staged.
 */
export const createRecoveryOperations = (input: {
  workRoot: string;
  deviceId: string;
  catalog: ReturnType<typeof createRecoveryCatalog>;
  chunks: () => RecoveryChunkStore | undefined;
  /** The current relay pass's blob transport, when connected. */
  transport: () => { transport: Transport; signal: AbortSignal } | undefined;
  /** Records the restored folder's capture policy as already decided, so it is never seeded. */
  enroll: (workspaceId: string, folder: string) => Promise<void>;
  changed: () => void;
  signal: AbortSignal;
}) => {
  let download: Status["download"] = idle;
  let restore: Status["restore"] = { ...idle, destination: null, files: { completed: 0, total: null }, result: null };
  let active: { controller: AbortController; done: Promise<void> } | undefined;
  const available = new Set<string>();
  /** Copies whose local bytes failed verification; their next download re-reads every chunk. */
  const damaged = new Set<string>();
  let notified = 0;
  const changed = (throttle = false) => {
    if (throttle && Date.now() - notified < progressMs) return;
    notified = Date.now();
    input.changed();
  };
  const store = () => {
    const chunks = input.chunks();
    if (!chunks)
      throw new RecoveryRestoreError(
        "keys_unavailable",
        "Connect to Cloud once after starting Prompt Studio so this device can unlock its folder copies.",
      );
    return chunks;
  };
  const entry = async (ref: ProjectFolderSourceRef) => {
    const found = (await input.catalog.list()).find(
      (item) => item.deviceId === ref.deviceId && item.sourceId === ref.sourceId,
    );
    if (!found) throw new RecoveryRestoreError("source_not_found", "No folder copy matches this device and source.");
    return found;
  };
  const isAvailable = async (chunks: RecoveryChunkStore, root: RecoveryChunk) => {
    if (available.has(root.blobId)) return true;
    try {
      await walkRecoveryGraph({
        chunks,
        root,
        signal: input.signal,
        before: async (reference) => {
          if (!(await chunks.has(reference))) throw Object.assign(new Error("Missing"), { code: "ENOENT" });
        },
      });
    } catch {
      return false;
    }
    available.add(root.blobId);
    return true;
  };
  /** `verify` re-reads every local chunk and fetches any that is missing or damaged. */
  const fetch = async (
    chunks: RecoveryChunkStore,
    ref: ProjectFolderSourceRef,
    root: RecoveryChunk,
    signal: AbortSignal,
    verify = false,
  ) => {
    download = { state: "running", source: ref, bytes: { completed: 0, total: null }, error: null };
    changed();
    const check = verify || damaged.has(root.blobId);
    if (check || !(await isAvailable(chunks, root))) {
      const connected = input.transport();
      if (!connected)
        throw new RecoveryRestoreError(
          check ? "integrity" : "not_downloaded",
          check
            ? "Part of this copy on this device is damaged. Connect to Cloud to download it again."
            : "This copy is not fully on this device. Connect to Cloud to download it; the source device can stay offline.",
        );
      await downloadRecoveryCapture({
        chunks,
        candidate: root,
        transport: connected.transport,
        signal: AbortSignal.any([signal, connected.signal]),
        progress: ({ bytes }) => {
          download = { ...download, bytes: { completed: bytes, total: null } };
          changed(true);
        },
      });
      available.add(root.blobId);
      damaged.delete(root.blobId);
    }
    download = { ...download, state: "complete" };
    changed();
  };
  const run = (work: (signal: AbortSignal) => Promise<void>, failed: (error: FolderRecoveryError) => void) => {
    if (active)
      throw new RecoveryRestoreError("busy", "Another folder download or restore is running. Wait or cancel it.");
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, input.signal]);
    const done = work(signal)
      .catch((error) => {
        failed(folderRecoveryError(error, signal));
        changed();
      })
      .finally(() => {
        if (active?.controller === controller) active = undefined;
      });
    active = { controller, done };
  };
  const fail = (error: FolderRecoveryError) =>
    ({ state: error.code === "cancelled" ? "cancelled" : "failed", error }) as const;

  return {
    async sources(): Promise<ProjectFolderSource[]> {
      const chunks = input.chunks();
      const result: ProjectFolderSource[] = [];
      for (const item of await input.catalog.list()) {
        const manifest = chunks && (await readRecoveryManifest(chunks, item.root).catch(() => null));
        const capture = manifest?.capture;
        result.push({
          deviceId: item.deviceId,
          sourceId: item.sourceId,
          current: item.deviceId === input.deviceId,
          name: manifest?.source.name ?? null,
          folder: manifest?.source.folder ?? null,
          startedAt: capture?.startedAt ?? null,
          completedAt: capture?.completedAt ?? null,
          files: capture ? capture.files + capture.git.dependencies.reduce((sum, item) => sum + item.files, 0) : null,
          bytes: capture ? capture.bytes + capture.git.dependencies.reduce((sum, item) => sum + item.bytes, 0) : null,
          policy: capture?.policy ?? null,
          git: capture?.git.state ?? null,
          available: !!chunks && !!manifest && (await isAvailable(chunks, item.root)),
        });
      }
      return result;
    },
    async download(ref: ProjectFolderSourceRef) {
      const chunks = store();
      const { root } = await entry(ref);
      run(
        (signal) => fetch(chunks, ref, root, signal, true),
        (error) => {
          download = { ...download, ...fail(error) };
        },
      );
    },
    /** Refuses an existing destination before starting, then downloads if needed, restores and attaches. */
    async restore(ref: ProjectFolderSourceRef & { path: string }, attach: RecoveryAttach) {
      const chunks = store();
      const { root } = await entry(ref);
      const { destination } = await checkRecoveryDestination(ref.path);
      const source = { deviceId: ref.deviceId, sourceId: ref.sourceId };
      run(
        async (signal) => {
          restore = {
            ...idle,
            state: "running",
            source,
            destination,
            files: { completed: 0, total: null },
            result: null,
          };
          await fetch(chunks, source, root, signal);
          const restored = await restoreRecoveryCapture({
            chunks,
            root,
            destination,
            workRoot: input.workRoot,
            signal,
            progress: (progress) => {
              restore = {
                ...restore,
                bytes: { completed: progress.bytes, total: progress.totalBytes },
                files: { completed: progress.files, total: progress.totalFiles },
              };
              changed(true);
            },
          }).catch((error) => {
            if (folderRecoveryError(error).code === "integrity") {
              available.delete(root.blobId);
              damaged.add(root.blobId);
            }
            throw error;
          });
          restore = { ...restore, result: { ...restored, attached: false } };
          let attached: boolean;
          try {
            attached = await attach(restored.path, (workspaceId) => input.enroll(workspaceId, restored.path));
          } catch (error) {
            // The verified folder stays where it was published; only binding it failed.
            throw new RecoveryRestoreError(
              "failed",
              `The folder was restored at ${restored.path}, but it could not become the project's folder: ${error instanceof Error ? error.message : String(error)}. It stays on disk; attach it with chooseFolder.`,
              null,
              { cause: error },
            );
          }
          restore = { ...restore, state: "complete", result: { ...restored, attached } };
          changed();
        },
        (error) => {
          if (download.state === "running") download = { ...download, ...fail(error) };
          restore = { ...restore, ...fail(error) };
        },
      );
    },
    /** Resolves once the cancelled operation removed its staging. */
    async cancel() {
      const current = active;
      current?.controller.abort();
      await current?.done;
    },
    status: () => ({ download, restore }),
  };
};
