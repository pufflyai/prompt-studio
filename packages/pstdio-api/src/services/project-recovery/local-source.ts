import { createHash } from "node:crypto";
import { hostname } from "node:os";
import type { createDocumentRelay } from "pstdio-sync/relay";
import { captureRecoveryFolder } from "./capture";
import { sourceRecoveryPolicy } from "./capture-source";
import type { createRecoveryCatalog } from "./catalog";
import type { RecoveryChunk } from "./chunks";
import { openRecoveryJournal } from "./journal";
import { type RecoveryChunkStore, readRecoveryManifest } from "./manifest";
import { pruneRecoveryStore } from "./retention";
import { createRecoveryScheduler } from "./schedule";
import { openRecoverySource } from "./source-posix";
import { prepareRecoveryCapture, RecoveryCandidateInvalid } from "./transfer";
import { watchRecoveryFolder } from "./watch";

interface LocalWorkspace {
  id: string;
  root_path: string | null;
  execution_kind: string;
  initializing: boolean;
  provider_state: string;
}
type Transport = Awaited<ReturnType<ReturnType<typeof createDocumentRelay>["manifestBlobs"]>>;
// Superseded local ciphertext stays this long, like the relay's grace copy.
const localGraceMs = 60 * 60_000;

const sameCapture = (
  a: Awaited<ReturnType<typeof readRecoveryManifest>>["capture"],
  b: Awaited<ReturnType<typeof captureRecoveryFolder>>,
) =>
  a.inventory.blobId === b.inventory.blobId &&
  a.exclusions?.blobId === b.exclusions?.blobId &&
  a.policy === b.policy &&
  a.rootMode === b.rootMode &&
  JSON.stringify(a.git) === JSON.stringify(b.git);

/** This device's project folder: enrollment, scheduled capture, the durable candidate
 * awaiting acknowledgement and local retention. It runs without a relay connection. */
export const createLocalRecoverySource = (input: {
  workbenchId: string;
  accountId: string;
  deviceId: string;
  root: string;
  workspaces: {
    getDefault(projectId: string): Promise<LocalWorkspace | null | undefined>;
    list(projectId: string): Promise<Pick<LocalWorkspace, "root_path" | "execution_kind">[]>;
  };
  catalog: ReturnType<typeof createRecoveryCatalog>;
  chunks: () => RecoveryChunkStore | undefined;
  signal: AbortSignal;
  schedule?: { quietMs?: number; gapMs?: number };
  captured: () => void;
  failed: (error: unknown) => void;
  statusChanged?: () => void;
}) => {
  // Local retention and capture never overlap: a capture may reuse cached ciphertext.
  let pruning: Promise<void> | undefined;
  let lastError: unknown = null;
  const sourceId = (workspaceId: string, folder: string) =>
    `${workspaceId}:${createHash("sha256").update(folder).digest("hex").slice(0, 16)}`;
  const journalFor = (id: string) =>
    openRecoveryJournal({ root: input.root, source: [input.workbenchId, input.accountId, input.deviceId, id] });
  const source = async () => {
    const workspace = await input.workspaces.getDefault(input.workbenchId);
    if (!workspace?.root_path || workspace.execution_kind !== "local") return null;
    // A folder still being provisioned is not the project's folder yet; never seed or read it.
    if (workspace.initializing || workspace.provider_state !== "ready") return null;
    const id = sourceId(workspace.id, workspace.root_path);
    return { id, folder: workspace.root_path, journal: await journalFor(id) };
  };
  const gitRoots = async () =>
    (await input.workspaces.list(input.workbenchId)).flatMap((workspace) =>
      workspace.root_path && workspace.execution_kind === "local" ? [workspace.root_path] : [],
    );
  const ownRoot = async (sourceId: string) =>
    (await input.catalog.list()).find((entry) => entry.deviceId === input.deviceId && entry.sourceId === sourceId)
      ?.root;

  // This process owns the source's capture and publication until the owner stops.
  let ownership: { id: string; release: () => Promise<void> } | undefined;
  const disown = async () => {
    const held = ownership;
    ownership = undefined;
    await held?.release().catch(() => {});
  };
  const own = async (current: NonNullable<Awaited<ReturnType<typeof source>>>) => {
    if (ownership?.id === current.id) return;
    await disown();
    const release = await current.journal.acquire();
    if (!release) throw new Error("Another Prompt Studio process owns this folder's recovery");
    ownership = { id: current.id, release };
  };
  const cataloged = async (store: RecoveryChunkStore, current: { id: string; folder: string }) => {
    for (const entry of await input.catalog.list()) {
      if (entry.deviceId === input.deviceId && entry.sourceId === current.id) return true;
      const manifest = await readRecoveryManifest(store, entry.root).catch(() => null);
      if (manifest?.source.folder === current.folder) return true;
    }
    return false;
  };
  // The source the last scan read. A workspace change to another source scans at once.
  let scanned: string | undefined;
  const capture = async (runSignal: AbortSignal) => {
    const store = input.chunks();
    // Private-project keys arrive with the first relay pass; that pass requests a scan.
    if (!store) return;
    await pruning;
    const current = await source();
    if (!current) return;
    scanned = current.id;
    restartWatch(current.folder);
    await own(current);
    if (!(await current.journal.read()).enrolled) {
      // A source already in the catalog keeps its applied policy, including deliberate absence.
      if (!(await cataloged(store, current))) {
        const opened = await openRecoverySource(current.folder);
        try {
          await sourceRecoveryPolicy(opened.root, true, store.directory);
        } finally {
          opened.close();
        }
      }
      await current.journal.update({ enrolled: true });
    }
    const captured = await captureRecoveryFolder({
      root: current.folder,
      chunks: store,
      gitRoots: await gitRoots(),
      signal: runSignal,
    });
    const pending = (await current.journal.read()).candidate;
    const previous = pending ?? (await ownRoot(current.id));
    const prior = previous && (await readRecoveryManifest(store, previous).catch(() => null));
    if (prior && sameCapture(prior.capture, captured)) {
      // An unchanged folder can still have a saved candidate awaiting publication.
      if (pending) input.captured();
      return;
    }
    const candidate = await prepareRecoveryCapture({
      chunks: store,
      source: {
        id: current.id,
        deviceId: input.deviceId,
        name: hostname() || "This device",
        folder: current.folder,
      },
      capture: captured,
    });
    await current.journal.update({ candidate });
    input.captured();
  };
  let watching: { folder: string; handle: { close(): void } } | undefined;
  let watchHints: { changed: () => void; lost: () => void } | undefined;
  const restartWatch = (next: string) => {
    const hints = watchHints;
    if (!hints || watching?.folder === next) return;
    watching?.handle.close();
    watching = undefined;
    const handle = watchRecoveryFolder(next, hints.changed, hints.lost);
    // A watch that failed while starting already reported its loss.
    if (watchHints === hints) watching = { folder: next, handle };
    else handle.close();
  };
  const scheduler = createRecoveryScheduler({
    ...input.schedule,
    run: async (_reasons, runSignal) => {
      try {
        await capture(AbortSignal.any([runSignal, input.signal]));
        lastError = null;
      } catch (error) {
        lastError = error;
        input.failed(error);
        throw error;
      } finally {
        input.statusChanged?.();
      }
    },
    watch: (changed, lost) => {
      watchHints = { changed, lost };
      return {
        close: () => {
          watchHints = undefined;
          watching?.handle.close();
          watching = undefined;
        },
      };
    },
  });

  const publish = async (store: RecoveryChunkStore, transport: Transport, attempt: AbortSignal) => {
    const current = await source();
    const candidate = current && (await current.journal.read()).candidate;
    if (!current || !candidate) return;
    await own(current);
    // A newer capture may replace the candidate during the upload.
    const clear = () =>
      current.journal.update((state) => (state.candidate?.blobId === candidate.blobId ? { candidate: null } : {}));
    let valid = await readRecoveryManifest(store, candidate).then(
      () => true,
      () => false,
    );
    if (valid)
      try {
        await input.catalog.publish({ chunks: store, candidate, transport, signal: attempt });
      } catch (error) {
        if (!(error instanceof RecoveryCandidateInvalid)) throw error;
        valid = false;
      }
    await clear();
    if (!valid) scheduler.request("reconnect");
  };
  const prune = async (store: RecoveryChunkStore) => {
    if (scheduler.status().running || pruning) return;
    pruning = (async () => {
      const current = await source();
      // Another process owning this source may be staging ciphertext.
      if (current && ownership?.id !== current.id) return;
      const candidate = current && (await current.journal.read()).candidate;
      const roots: RecoveryChunk[] = (await input.catalog.list()).map((entry) => entry.root);
      if (candidate) roots.push(candidate);
      await pruneRecoveryStore({ chunks: store, roots, graceMs: localGraceMs });
    })()
      .catch(() => {})
      .finally(() => {
        pruning = undefined;
      });
    await pruning;
  };

  return {
    request: scheduler.request,
    /** The project's workspaces changed here. A different folder, such as a restored one that
     * became the project's folder, is scanned at once; the folder scanned last rescans after the gap. */
    async workspaceChanged() {
      const current = await source();
      scheduler.request(current && current.id !== scanned ? "folder" : "watcher-lost");
    },
    publish,
    prune,
    async status() {
      const current = await source();
      const pending = !!current && (!!(await current.journal.read()).candidate || scheduler.status().pending);
      return {
        folder: current?.folder ?? null,
        pending,
        capturing: scheduler.status().running,
        needsAttention: scheduler.status().failed,
        error: scheduler.status().failed ? lastError : null,
      };
    },
    /** A restored folder keeps the policy of its copy, including deliberate absence: its
     * starter decision is already made before it becomes this device's source. */
    async enroll(workspaceId: string, folder: string) {
      await (await journalFor(sourceId(workspaceId, folder))).update({ enrolled: true });
    },
    async close() {
      await scheduler.close();
      await disown();
    },
  };
};
