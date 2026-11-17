// Worker entry point: the folder-recovery work that reads, hashes or decrypts every file of a copy runs here,
// off the API's main thread. The compiled binary bundles this file as an extra entry point
// (scripts/build/build-compile.ts).
import { restoreSyncSpace } from "pstdio-sync/encryption";
import { captureRecoveryFolder } from "./capture";
import { createRecoveryChunkStore } from "./chunks";
import type { RecoveryWorkerMessage, RecoveryWorkerRequest } from "./recovery-worker-protocol";
import { RecoveryCaptureError } from "./scan";
import { verifyRecoveryCapture } from "./verify-capture";

declare const self: Worker;

const controller = new AbortController();
const reply = (message: RecoveryWorkerMessage) => self.postMessage(message);
const described = (error: unknown) => ({
  message: error instanceof Error ? error.message : String(error),
  code: (error as NodeJS.ErrnoException | undefined)?.code,
});

self.onmessage = async (event: MessageEvent<RecoveryWorkerRequest>) => {
  const request = event.data;
  if (request.type === "abort") {
    controller.abort();
    return;
  }
  try {
    const chunks = await createRecoveryChunkStore({ root: request.chunksRoot, space: restoreSyncSpace(request.space) });
    if (request.type === "verify") {
      await verifyRecoveryCapture(chunks, request.manifest, controller.signal);
      reply({ type: "verified" });
      return;
    }
    const captured = await captureRecoveryFolder({
      root: request.root,
      chunks,
      gitRoots: request.gitRoots,
      signal: controller.signal,
    });
    reply({ type: "captured", captured });
  } catch (error) {
    reply({
      type: "failed",
      aborted: controller.signal.aborted,
      ...described(error),
      ...(error instanceof RecoveryCaptureError ? { path: error.path, cause: described(error.cause) } : {}),
    });
  }
};
