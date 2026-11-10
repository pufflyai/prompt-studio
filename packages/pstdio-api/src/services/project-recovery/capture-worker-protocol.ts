import type { SyncSpaceTransfer } from "pstdio-sync/encryption";
import type { captureRecoveryFolder } from "./capture";

export type CaptureWorkerRequest =
  | { type: "capture"; root: string; chunksRoot: string; space: SyncSpaceTransfer; gitRoots: string[] }
  | { type: "abort" };

export type CaptureWorkerMessage =
  | { type: "captured"; captured: Awaited<ReturnType<typeof captureRecoveryFolder>> }
  // Errors cross the thread as data; the caller rebuilds the kinds `folderRecoveryError` reads.
  | { type: "failed"; aborted: boolean; message: string; code?: string; path?: string };
