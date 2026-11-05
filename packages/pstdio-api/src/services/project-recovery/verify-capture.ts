import { createHash } from "node:crypto";
import type { RecoveryChunkStore, RecoveryManifest } from "./manifest";
import { createRecoveryPages, type RecoveryEntry } from "./pages";

const verifyFile = async (
  chunks: RecoveryChunkStore,
  entry: Extract<RecoveryEntry, { kind: "file" }>,
  signal?: AbortSignal,
) => {
  const hash = createHash("sha256");
  let size = 0;
  for await (const reference of createRecoveryPages(chunks).parts(entry.content)) {
    signal?.throwIfAborted();
    const part = await chunks.read(reference);
    hash.update(part);
    size += part.length;
    if (size > entry.size) throw new Error("Recovery file exceeds its declared extent");
  }
  const sha256 = hash.digest("hex");
  if (size !== entry.size || sha256 !== entry.sha256) throw new Error("Recovery file integrity verification failed");
  return { size, sha256 };
};

/** Availability is a property of the verified local graph, never a persisted
 * "downloaded" flag that could outlive its bytes. */
export const verifyRecoveryCapture = async (
  chunks: RecoveryChunkStore,
  manifest: RecoveryManifest,
  signal?: AbortSignal,
) => {
  const pages = createRecoveryPages(chunks);
  let files = 0;
  let bytes = 0;
  let policyFound = false;
  const expectedPolicy = manifest.capture.policy === null ? null : new TextEncoder().encode(manifest.capture.policy);
  for await (const entry of pages.entries(manifest.capture.inventory)) {
    signal?.throwIfAborted();
    if (entry.path === ".pstignore" && entry.kind !== "file") throw new Error("Recovery policy is not a regular file");
    if (entry.kind !== "file") continue;
    const { size, sha256 } = await verifyFile(chunks, entry, signal);
    if (entry.path === ".pstignore") {
      if (
        !expectedPolicy ||
        size !== expectedPolicy.length ||
        sha256 !== createHash("sha256").update(expectedPolicy).digest("hex")
      )
        throw new Error("Recovery inventory does not match its applied policy");
      policyFound = true;
    }
    files++;
    bytes += size;
    if (!Number.isSafeInteger(bytes)) throw new Error("Recovery capture exceeds supported byte counts");
  }
  if (files !== manifest.capture.files || bytes !== manifest.capture.bytes || policyFound !== (expectedPolicy !== null))
    throw new Error("Recovery inventory does not match its completed capture");
};
