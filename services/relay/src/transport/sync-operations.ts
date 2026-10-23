import {
  blobBeginSchema,
  blobManifestBeginSchema,
  blobReadSchema,
  fingerprintSchema,
  readRequestSchema,
  type SyncRoute,
  stateEnvelopeSchema,
  syncBlobReferencesFeature,
  syncProtocolVersion,
  updateEnvelopeSchema,
} from "pstdio-sync-contracts";
import type { z } from "zod";
import { projectKey, rejection, type SyncCaller } from "../storage/accounts";
import type { RelayOwners } from "./owners";
import { relayResponse } from "./responses";

// Base64 adds a third; the rest covers JSON field names and IDs.
const jsonBound = (bytes: number) => Math.ceil((bytes * 4) / 3) + 64 * 1024;

/** Reads a JSON body without buffering more than `limit` bytes. */
const readJson = async <T extends z.ZodType>(request: Request, schema: T, limit: number) => {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw rejection(413, "too-large");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request.body ?? []) {
    size += chunk.byteLength;
    if (size > limit) throw rejection(413, "too-large");
    chunks.push(chunk);
  }
  let input: unknown;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw rejection(400, "invalid-request");
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw rejection(400, "invalid-request");
  return parsed.data as z.infer<T>;
};

const bytes = (body: ReadableStream<Uint8Array>, headers: Record<string, string>) =>
  new Response(body, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/octet-stream",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });

export const handleSyncOperation = async (
  owners: RelayOwners,
  route: Exclude<SyncRoute, { kind: "live" }>,
  caller: SyncCaller,
  request: Request,
) => {
  const { documents, blobs } = owners.sync;
  const { limits } = owners;
  const signal = request.signal;
  if (route.kind === "capabilities")
    return relayResponse({ protocolVersion: syncProtocolVersion, features: [syncBlobReferencesFeature] });
  const space = { projectKey: projectKey(caller.accountId, route.projectId), spaceOwner: route.spaceOwner };
  if (route.kind === "document" || route.kind === "state") {
    const address = { ...space, documentId: route.documentId };
    if (route.kind === "state") {
      const state = await documents.readState(address, route.stateId, signal);
      if (!state) throw rejection(404, "not-found");
      return bytes(state.body, { "pstdio-byte-length": String(state.state.byteLength) });
    }
    if (route.operation === "updates") {
      const envelope = await readJson(request, updateEnvelopeSchema, jsonBound(limits.maxUpdateBytes));
      return relayResponse(await documents.appendUpdate(address, caller, envelope, signal));
    }
    if (route.operation === "state") {
      const bound = jsonBound(limits.maxStateBytes + limits.maxSummaryBytes);
      const envelope = await readJson(request, stateEnvelopeSchema, bound);
      return relayResponse(await documents.replaceState(address, caller, envelope, signal));
    }
    const { after } = await readJson(request, readRequestSchema, jsonBound(0));
    return relayResponse(await documents.read(address, after, signal));
  }
  const address = { ...space, blobId: route.blobId };
  if (route.kind === "part") {
    const sha256 = fingerprintSchema.safeParse(request.headers.get("pstdio-sha256"));
    const byteLength = Number(request.headers.get("content-length"));
    if (!sha256.success || !request.body || !Number.isSafeInteger(byteLength)) throw rejection(400, "invalid-request");
    await blobs.writePart(address, route.number, { sha256: sha256.data, byteLength, body: request.body, signal });
    return relayResponse({});
  }
  if (route.operation === "begin") {
    const input = await readJson(request, blobBeginSchema, jsonBound(0));
    return relayResponse(await blobs.begin(address, caller, input, signal));
  }
  if (route.operation === "begin-manifest") {
    const input = await readJson(request, blobManifestBeginSchema, jsonBound(0));
    return relayResponse(await blobs.beginManifest(address, caller, input, signal));
  }
  if (route.operation === "finish") {
    await blobs.finish(address, signal);
    return relayResponse({});
  }
  const { offset } = await readJson(request, blobReadSchema, jsonBound(0));
  const blob = await blobs.read(address, offset, signal);
  return bytes(blob.body, { "pstdio-offset": String(offset), "pstdio-byte-length": String(blob.byteLength - offset) });
};
