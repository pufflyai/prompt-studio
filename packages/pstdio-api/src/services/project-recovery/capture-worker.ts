// Worker entry point: walks, hashes and seals one project folder off the API's main thread.
// The compiled binary bundles this file as an extra entry point (scripts/build/build-compile.ts).
import { restoreSyncSpace } from "pstdio-sync/encryption";
import { captureRecoveryFolder } from "./capture";
import type { CaptureWorkerMessage, CaptureWorkerRequest } from "./capture-worker-protocol";
import { createRecoveryChunkStore } from "./chunks";
import { RecoveryCaptureError } from "./scan";

declare const self: Worker;

const controller = new AbortController();
const reply = (message: CaptureWorkerMessage) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<CaptureWorkerRequest>) => {
  const request = event.data;
  if (request.type === "abort") {
    controller.abort();
    return;
  }
  try {
    const chunks = await createRecoveryChunkStore({ root: request.chunksRoot, space: restoreSyncSpace(request.space) });
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
      message: error instanceof Error ? error.message : String(error),
      code: (error as NodeJS.ErrnoException).code,
      path: error instanceof RecoveryCaptureError ? error.path : undefined,
    });
  }
};
