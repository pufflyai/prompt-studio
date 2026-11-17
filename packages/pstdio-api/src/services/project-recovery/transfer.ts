import type { createDocumentRelay } from "pstdio-sync/relay";
import type { RecoveryChunk } from "./chunks";
import {
  type RecoveryChunkStore,
  type RecoveryManifest,
  readRecoveryManifest,
  recoveryManifestSchema,
} from "./manifest";
import { verifyRecoveryCaptureInWorker } from "./recovery-worker-client";
import { walkRecoveryGraph } from "./transfer-graph";

type Transport = Awaited<ReturnType<ReturnType<typeof createDocumentRelay>["manifestBlobs"]>>;
interface TransferInput {
  chunks: RecoveryChunkStore;
  candidate: RecoveryChunk;
  transport: Transport;
  signal?: AbortSignal;
  progress?: (event: { direction: "upload" | "download"; bytes: number }) => void;
}

export const prepareRecoveryCapture = async (input: {
  chunks: RecoveryChunkStore;
  source: RecoveryManifest["source"];
  capture: RecoveryManifest["capture"];
}) => {
  const manifest = recoveryManifestSchema.parse({
    version: 1,
    kind: "folder-capture",
    projectId: input.chunks.space.projectId,
    accountId: input.chunks.space.spaceOwner,
    source: input.source,
    capture: input.capture,
  });
  return input.chunks.stage(new TextEncoder().encode(JSON.stringify(manifest)), "metadata");
};

/** The retained candidate itself is unreadable or fails verification locally.
 * A fresh capture replaces it; retrying the same upload cannot succeed. */
export class RecoveryCandidateInvalid extends Error {
  constructor(cause: unknown) {
    super("The saved folder capture is incomplete locally and will be captured again", { cause });
    this.name = "RecoveryCandidateInvalid";
  }
}

/** The only completion boundary is after acknowledged upload of the entire DAG.
 * A retained candidate and the transport's resumable immutable IDs survive lost
 * acknowledgements without reading a changed source or minting new ciphertext. */
export const publishRecoveryCapture = async (
  input: TransferInput & { complete: (reference: RecoveryChunk, manifest: RecoveryManifest) => Promise<void> },
) => {
  let manifest: RecoveryManifest;
  try {
    manifest = await readRecoveryManifest(input.chunks, input.candidate);
    await verifyRecoveryCaptureInWorker(input.chunks, manifest, input.signal);
  } catch (error) {
    if (input.signal?.aborted) throw error;
    throw new RecoveryCandidateInvalid(error);
  }
  let bytes = 0;
  await walkRecoveryGraph({
    chunks: input.chunks,
    root: input.candidate,
    signal: input.signal,
    after: async (reference, children) => {
      await input.transport.put(reference.blobId, await input.chunks.encrypted(reference), children);
      bytes += reference.encryptedByteLength;
      input.progress?.({ direction: "upload", bytes });
    },
  });
  input.signal?.throwIfAborted();
  await input.complete(input.candidate, manifest);
  return manifest;
};

export const downloadRecoveryCapture = async (input: TransferInput) => {
  let bytes = 0;
  await walkRecoveryGraph({
    chunks: input.chunks,
    root: input.candidate,
    signal: input.signal,
    before: async (reference) => {
      try {
        await input.chunks.read(reference);
        return;
      } catch (error) {
        // A missing or damaged local chunk is fetched again and verified.
        if (input.signal?.aborted) throw error;
      }
      await input.chunks.receive(reference, await input.transport.get(reference.blobId, reference.encryptedByteLength));
      bytes += reference.encryptedByteLength;
      input.progress?.({ direction: "download", bytes });
    },
  });
  const manifest = await readRecoveryManifest(input.chunks, input.candidate);
  await verifyRecoveryCaptureInWorker(input.chunks, manifest, input.signal);
  return manifest;
};
