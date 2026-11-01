import { openBlob, openUpdate, type SyncSpace, sealBlob, sealUpdate } from "pstdio-sync";
import type { DocumentRelay } from "pstdio-sync/relay";
import type { StoredUpdate } from "pstdio-sync-contracts";
import { z } from "zod";

const frameSchema = z.union([z.object({ lines: z.array(z.string()) }), z.object({ blobId: z.string() })]);

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Large messages use the existing blob protocol, referenced by a small encrypted log entry. */
export const publishLogUpdate = async (space: SyncSpace, id: string, relay: DocumentRelay, lines: string[]) => {
  const bytes = encoder.encode(lines.join("\n"));
  const inline = encoder.encode(JSON.stringify({ lines }));
  if (inline.length <= 700_000) return relay.update(await sealUpdate(space, id, inline, []));
  if (!relay.blobs) throw new Error("Session log blob transport unavailable");
  const blob = await sealBlob(space, bytes);
  await relay.blobs.put(blob.blobId, blob.bytes);
  return relay.update(
    await sealUpdate(space, id, encoder.encode(JSON.stringify({ blobId: blob.blobId })), [blob.blobId]),
  );
};

export const readLogUpdate = async (space: SyncSpace, id: string, relay: DocumentRelay, update: StoredUpdate) => {
  const frame = frameSchema.parse(JSON.parse(decoder.decode(await openUpdate(space, id, update))));
  if ("lines" in frame) return frame.lines;
  if (!relay.blobs) throw new Error("Session log blob transport unavailable");
  const bytes = await openBlob(space, frame.blobId, await relay.blobs.get(frame.blobId));
  return decoder.decode(bytes).split("\n");
};
