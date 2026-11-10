import type { CaptureWorkerMessage, CaptureWorkerRequest } from "./capture-worker-protocol";
import type { RecoveryChunkStore } from "./manifest";
import { RecoveryCaptureError } from "./scan";

declare const PSTDIO_BUILD_RECOVERY_CAPTURE_WORKER: string | undefined;

// A source run loads the worker beside this module. The compiled binary bundles it as an extra
// entry point and passes its bundled path, which is relative to the build's common root.
const workerSpecifier = () =>
  typeof PSTDIO_BUILD_RECOVERY_CAPTURE_WORKER === "string"
    ? PSTDIO_BUILD_RECOVERY_CAPTURE_WORKER
    : new URL("./capture-worker.ts", import.meta.url).href;

const rebuild = (message: Extract<CaptureWorkerMessage, { type: "failed" }>) => {
  if (message.path !== undefined) return new RecoveryCaptureError(message.path, new Error(message.message));
  return Object.assign(new Error(message.message), message.code ? { code: message.code } : {});
};

/** Captures a project folder in a worker thread, so walking and hashing millions of files never
 * blocks the API's event loop. The result is the same as `captureRecoveryFolder`. */
export const captureRecoveryFolderInWorker = (input: {
  root: string;
  chunks: RecoveryChunkStore;
  gitRoots: string[];
  signal: AbortSignal;
}) =>
  new Promise<Extract<CaptureWorkerMessage, { type: "captured" }>["captured"]>((resolve, reject) => {
    input.signal.throwIfAborted();
    const worker = new Worker(workerSpecifier());
    const send = (request: CaptureWorkerRequest) => worker.postMessage(request);
    const abort = () => send({ type: "abort" });
    const settle = () => {
      input.signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    input.signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<CaptureWorkerMessage>) => {
      const message = event.data;
      settle();
      if (message.type === "captured") resolve(message.captured);
      else reject(message.aborted && input.signal.aborted ? input.signal.reason : rebuild(message));
    };
    worker.onerror = (event) => {
      settle();
      reject(new Error(`Folder capture worker failed: ${event.message}`));
    };
    send({
      type: "capture",
      root: input.root,
      chunksRoot: input.chunks.root,
      space: input.chunks.space.transfer(),
      gitRoots: input.gitRoots,
    });
  });
