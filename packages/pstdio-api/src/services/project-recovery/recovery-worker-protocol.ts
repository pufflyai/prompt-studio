import type { SyncSpaceTransfer } from "pstdio-sync/encryption";
import type { captureRecoveryFolder } from "./capture";
import type { RecoveryManifest } from "./manifest";

/** A worker job opens the device's private chunk store under `chunksRoot` with the transferred space. */
interface ChunkStoreAccess {
  chunksRoot: string;
  space: SyncSpaceTransfer;
}

export type RecoveryWorkerRequest =
  | ({ type: "capture"; root: string; gitRoots: string[] } & ChunkStoreAccess)
  | ({ type: "verify"; manifest: RecoveryManifest } & ChunkStoreAccess)
  | { type: "abort" };

export type CapturedFolder = Awaited<ReturnType<typeof captureRecoveryFolder>>;

// Errors cross the thread as data; the client rebuilds the kinds `folderRecoveryError` reads.
export interface RecoveryWorkerFailure {
  type: "failed";
  aborted: boolean;
  message: string;
  code?: string;
  /** Set for `RecoveryCaptureError`, with the source error it wraps. */
  path?: string;
  cause?: { message: string; code?: string };
}

export type RecoveryWorkerMessage =
  | { type: "captured"; captured: CapturedFolder }
  | { type: "verified" }
  | RecoveryWorkerFailure;
