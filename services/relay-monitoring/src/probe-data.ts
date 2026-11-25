import {
  openBlob,
  openState,
  openUpdate,
  type SyncSpace,
  sealBlob,
  sealState,
  sealUpdate,
} from "pstdio-sync/encryption";
import type { createDocumentRelay } from "pstdio-sync/relay";
import type { createCheckpoint } from "./checkpoint";

const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
interface Input {
  a: SyncSpace;
  b: SyncSpace;
  writer: ReturnType<typeof createDocumentRelay>;
  reader: ReturnType<typeof createDocumentRelay>;
  journal: Awaited<ReturnType<typeof createCheckpoint>>;
}
export const syncRound = async ({ a, b, writer, reader, journal: { state, save } }: Input) => {
  if (!state.pendingUpdate) {
    const bytes = crypto.getRandomValues(new Uint8Array(256));
    state.pendingUpdate = { envelope: await sealUpdate(a, state.documentId, bytes, []), expected: hash(bytes) };
    await save(); // Reuse the sealed ID after lost replies or a process restart.
  }
  const pending = state.pendingUpdate;
  const acknowledgement = await writer.update(pending.envelope);
  const read = await reader.read(Math.max(0, acknowledgement.sequence - 1));
  const update =
    read.status === "updates" ? read.updates.find((value) => value.updateId === pending.envelope.updateId) : undefined;
  if (!update || hash(await openUpdate(b, state.documentId, update)) !== pending.expected)
    throw new Error("Sync integrity failed");
  const current = await writer.read(acknowledgement.sequence);
  const bytes = await openUpdate(b, state.documentId, update);
  const checkpoint = await sealState(a, state.documentId, {
    baseStateId: current.state?.stateId ?? null,
    through: acknowledgement.sequence,
    state: bytes,
    summary: new Uint8Array(),
    blobIds: [],
  });
  if (!(await writer.replace(checkpoint))) throw new Error("State publication refused");
  const latest = await reader.read(0);
  if (
    !latest.state ||
    hash(await openState(b, state.documentId, latest.state, await reader.state(latest.state))) !== pending.expected
  )
    throw new Error("State integrity failed");
  delete state.pendingUpdate;
  await save();
};
export const blobRound = async ({ a, b, writer, reader, journal: { state, save } }: Input, multipart: boolean) => {
  if (!state.pendingBlob) {
    const bytes = new Uint8Array(multipart ? 6 * 1024 ** 2 : 4096);
    // A unique prefix checks decryption and the full byte hash without a multi-megabyte random allocation.
    bytes.set(crypto.getRandomValues(new Uint8Array(256)));
    const sealed = await sealBlob(a, bytes);
    state.pendingBlob = {
      blobId: sealed.blobId,
      bytes: Buffer.from(sealed.bytes).toString("base64"),
      expectedHash: hash(bytes),
      multipart,
    };
    await save();
  }
  const pending = state.pendingBlob;
  await writer.blobs.put(pending.blobId, new Uint8Array(Buffer.from(pending.bytes, "base64")));
  const stored = await reader.blobs.get(pending.blobId);
  if (hash(await openBlob(b, pending.blobId, stored)) !== pending.expectedHash)
    throw new Error("Blob integrity failed");
  state.lastBlobAt = Date.now();
  if (pending.multipart) state.lastMultipartAt = Date.now();
  delete state.pendingBlob;
  await save();
};
