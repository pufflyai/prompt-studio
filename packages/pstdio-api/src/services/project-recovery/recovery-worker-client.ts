import type { RecoveryChunkStore, RecoveryManifest } from "./manifest";
import type {
  CapturedFolder,
  RecoveryWorkerFailure,
  RecoveryWorkerMessage,
  RecoveryWorkerRequest,
} from "./recovery-worker-protocol";
import { RecoveryCaptureError } from "./scan";

declare const PSTDIO_BUILD_RECOVERY_WORKER: string | undefined;

// A source run loads the worker beside this module. The compiled binary bundles it as an extra
// entry point and passes its bundled path (see scripts/build/build-compile.ts).
const workerSpecifier = () =>
  typeof PSTDIO_BUILD_RECOVERY_WORKER === "string"
    ? PSTDIO_BUILD_RECOVERY_WORKER
    : new URL("./recovery-worker.ts", import.meta.url).href;

// A cancelled job that has not answered by then, such as one blocked on a hung network mount, is
// terminated. Retention already removes chunk files a stopped writer left pending.
const abortGraceMs = 5_000;

const withCode = (error: Error, code: string | undefined) => (code ? Object.assign(error, { code }) : error);
const rebuild = (failure: RecoveryWorkerFailure) =>
  failure.path === undefined
    ? withCode(new Error(failure.message), failure.code)
    : new RecoveryCaptureError(
        failure.path,
        withCode(new Error(failure.cause?.message ?? failure.message), failure.cause?.code),
      );

/** Runs one job in its own worker thread and stops the worker when the job settles. */
const run = <T>(request: Exclude<RecoveryWorkerRequest, { type: "abort" }>, signal: AbortSignal) =>
  new Promise<T>((resolve, reject) => {
    signal.throwIfAborted();
    const worker = new Worker(workerSpecifier());
    let settled = false;
    let grace: ReturnType<typeof setTimeout> | undefined;
    const settle = (finish: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(grace);
      signal.removeEventListener("abort", abort);
      worker.terminate();
      finish();
    };
    function abort() {
      worker.postMessage({ type: "abort" } satisfies RecoveryWorkerRequest);
      grace = setTimeout(() => settle(() => reject(signal.reason)), abortGraceMs);
    }
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<RecoveryWorkerMessage>) => {
      const message = event.data;
      if (message.type === "failed")
        settle(() => reject(message.aborted && signal.aborted ? signal.reason : rebuild(message)));
      else settle(() => resolve((message.type === "captured" ? message.captured : undefined) as T));
    };
    worker.onerror = (event) => settle(() => reject(new Error(`Folder recovery worker failed: ${event.message}`)));
    worker.addEventListener("messageerror", () =>
      settle(() => reject(new Error("Folder recovery worker sent an unreadable result"))),
    );
    // A worker that exits without answering must not leave its caller waiting forever.
    worker.addEventListener("close", () =>
      settle(() => reject(signal.aborted ? signal.reason : new Error("Folder recovery worker stopped"))),
    );
    worker.postMessage(request satisfies RecoveryWorkerRequest);
  });

/** Captures a project folder in a worker thread, so walking and hashing millions of files never
 * blocks the API's event loop. The result is the same as `captureRecoveryFolder`. */
export const captureRecoveryFolderInWorker = (input: {
  root: string;
  chunks: RecoveryChunkStore;
  gitRoots: string[];
  signal: AbortSignal;
}) =>
  run<CapturedFolder>(
    {
      type: "capture",
      root: input.root,
      gitRoots: input.gitRoots,
      chunksRoot: input.chunks.root,
      space: input.chunks.space.transfer(),
    },
    input.signal,
  );

/** `verifyRecoveryCapture` in a worker thread: it reads, decrypts and hashes every chunk of a copy. */
export const verifyRecoveryCaptureInWorker = (
  chunks: RecoveryChunkStore,
  manifest: RecoveryManifest,
  signal?: AbortSignal,
) =>
  run<void>(
    { type: "verify", manifest, chunksRoot: chunks.root, space: chunks.space.transfer() },
    signal ?? new AbortController().signal,
  );
