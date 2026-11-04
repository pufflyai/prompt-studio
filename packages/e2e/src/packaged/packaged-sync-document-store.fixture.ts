import { expect } from "bun:test";
import type { StateEnvelope, StateInfo, StoredUpdate } from "pstdio-sync-contracts";
import type { createPeerLive } from "./packaged-live.fixture";

/** Blind document storage and explicit fault controls for the packaged wire peer. */
export const createPackagedDocumentStore = (
  blobs: { complete: (id: string) => boolean },
  changed: ReturnType<typeof createPeerLive>["changed"],
) => {
  const documents = new Map<
    string,
    { state: StateInfo | null; payload?: string; blobIds?: string[]; updates: StoredUpdate[] }
  >();
  const sequences = new Map<string, number>();
  const statePayloads = new Map<string, Map<string, string>>();
  const updateSequences = new Map<string, Map<string, number>>();
  let storedStates = 0;
  const personalDocumentIds = new Set<string>();
  // While set, document reads fail, so a device cannot finish its first download. A function picks the
  // documents whose reads fail.
  let failReads: boolean | ((documentId: string) => boolean) = false;
  let failedReads = 0;
  let completedReads = 0;
  const document = (id: string) => {
    let value = documents.get(id);
    if (!value) {
      value = { state: null, updates: [] };
      documents.set(id, value);
    }
    return value;
  };
  const json = (body: unknown) => Response.json(body);
  const lastSequence = (id: string) => {
    const doc = document(id);
    const sequence = Math.max(
      sequences.get(id) ?? 0,
      doc.state?.through ?? 0,
      doc.updates.reduce((maximum, update) => Math.max(maximum, update.sequence), 0),
    );
    sequences.set(id, sequence);
    return sequence;
  };
  const trim = (documentId: string) => {
    const id = documentId.startsWith("~") ? documentId : `~${documentId}`;
    const doc = document(id);
    lastSequence(id);
    doc.updates = doc.updates.filter((update) => update.sequence > (doc.state?.through ?? 0));
  };
  const saveState = (id: string, body: StateEnvelope, deviceId: string) => {
    const doc = document(id);
    storedStates++;
    const payloads = statePayloads.get(id) ?? new Map<string, string>();
    payloads.set(body.stateId, body.payload);
    statePayloads.set(id, payloads);
    doc.payload = body.payload;
    doc.blobIds = [...body.blobIds];
    doc.state = {
      stateId: body.stateId,
      baseStateId: body.baseStateId,
      through: body.through,
      summary: body.summary,
      byteLength: Buffer.from(body.payload, "base64").length,
      deviceId,
      createdAt: new Date().toISOString(),
    };
  };
  // Like the relay, tell connected devices that a document changed so they read it again.
  const publishChange = (documentId: string, spaceOwner: string | null, created = false) => {
    const doc = document(documentId);
    const notice = {
      spaceOwner,
      documentId: documentId.slice(1),
      lastSequence: lastSequence(documentId),
      stateId: doc.state?.stateId ?? null,
    };
    changed(notice, created);
  };
  const readDocument = async (id: string, request: Request) => {
    const doc = document(id);
    if (typeof failReads === "function" ? failReads(id.slice(1)) : failReads) {
      failedReads++;
      return new Response(null, { status: 503 });
    }
    const { after } = (await request.json()) as { after: number };
    completedReads++;
    const sequence = lastSequence(id);
    const updates = doc.updates.filter((update) => update.sequence > Number(after));
    if (Number(after) > sequence || updates.length !== sequence - Number(after))
      return json({ status: "state-required", state: doc.state, lastSequence: sequence });
    return json({
      status: "updates",
      state: doc.state,
      lastSequence: sequence,
      more: false,
      updates,
    });
  };
  const saveUpdate = (
    id: string,
    body: Record<string, unknown>,
    deviceId: string,
    spaceOwner: string | null,
    created: boolean,
  ) => {
    const doc = document(id);
    let receipts = updateSequences.get(id);
    if (!receipts) {
      receipts = new Map();
      updateSequences.set(id, receipts);
    }
    const duplicate = receipts.get(String(body.updateId));
    if (duplicate !== undefined) return json({ sequence: duplicate, duplicate: true });
    const sequence = lastSequence(id) + 1;
    sequences.set(id, sequence);
    receipts.set(String(body.updateId), sequence);
    doc.updates.push({
      updateId: String(body.updateId),
      payload: String(body.payload),
      sequence,
      deviceId,
      createdAt: new Date().toISOString(),
    });
    publishChange(id, spaceOwner, created);
    return json({ sequence, duplicate: false });
  };
  const replaceState = (
    id: string,
    body: Record<string, unknown>,
    deviceId: string,
    spaceOwner: string | null,
    created: boolean,
  ) => {
    const doc = document(id);
    expect(body.summary).toBeString();
    if (body.stateId === doc.state?.stateId) return json({ state: doc.state });
    if (body.baseStateId !== (doc.state?.stateId ?? null))
      return Response.json({ error: "stale-state", state: doc.state }, { status: 409 });
    if (
      statePayloads.get(id)?.has(String(body.stateId)) ||
      Number(body.through) < (doc.state?.through ?? 0) ||
      Number(body.through) > lastSequence(id)
    )
      return Response.json({ error: "invalid-request" }, { status: 400 });
    saveState(id, body as unknown as StateEnvelope, deviceId);
    publishChange(id, spaceOwner, created);
    return json({ state: doc.state });
  };
  const documentRequest = async (
    request: Request,
    path: string,
    parts: string[],
    spaceOwner: string | null,
    deviceId: string,
  ) => {
    const id = parts[5]!;
    if (spaceOwner) personalDocumentIds.add(id);
    if (path.endsWith("/read")) return readDocument(id, request);
    const doc = document(id);
    if (parts[6] === "states") {
      const payload = statePayloads.get(id)?.get(decodeURIComponent(parts[7]!.slice(1)));
      return payload === undefined ? new Response(null, { status: 404 }) : new Response(Buffer.from(payload, "base64"));
    }
    const body = (await request.json()) as Record<string, unknown>;
    const created = doc.updates.length === 0 && doc.state === null;
    for (const blobId of body.blobIds as string[]) expect(blobs.complete(`~${blobId}`)).toBe(true);
    expect(String(body.payload)).not.toContain("packaged-secret");
    if (path.endsWith("/updates")) return saveUpdate(id, body, deviceId, spaceOwner, created);
    return replaceState(id, body, deviceId, spaceOwner, created);
  };
  return {
    request: documentRequest,
    documents,
    states: () => storedStates,
    retainedStates: () =>
      [...statePayloads].flatMap(([documentId, states]) =>
        [...states].map(([stateId, payload]) => ({ documentId, stateId, payload })),
      ),
    reads: () => completedReads,
    announceUnchanged() {
      for (const id of documents.keys()) publishChange(id, personalDocumentIds.has(id) ? "owner" : null);
    },
    failedReads: () => failedReads,
    personalDocuments: () => [...personalDocumentIds].map((id) => documents.get(id)!),
    failReads(value: boolean | ((documentId: string) => boolean)) {
      failReads = value;
    },
    /** Explicitly models expiry of covered updates; default fixtures retain their existing tail. */
    trim,
    captureSnapshot(documentId: string) {
      const id = documentId.startsWith("~") ? documentId : `~${documentId}`;
      const doc = documents.get(id);
      if (!doc?.state || !doc.payload) throw new Error(`Document ${documentId} has no latest state`);
      return structuredClone({ state: doc.state, payload: doc.payload, blobIds: doc.blobIds ?? [] });
    },
    /**
     * Installs a client-sealed faulty latest state and removes its covered tail. The harness must reseal
     * earlier bytes with the new authenticated headers; relabelling ciphertext would test corruption.
     */
    installSnapshot(documentId: string, state: StateEnvelope) {
      const id = documentId.startsWith("~") ? documentId : `~${documentId}`;
      const doc = document(id);
      if (state.baseStateId !== (doc.state?.stateId ?? null) || statePayloads.get(id)?.has(state.stateId))
        throw new Error("Fault snapshot must replace the current state with a new state ID");
      if (state.through < (doc.state?.through ?? 0) || state.through > lastSequence(id))
        throw new Error("Fault snapshot must cover a valid update sequence");
      for (const blobId of state.blobIds) expect(blobs.complete(`~${blobId}`)).toBe(true);
      saveState(id, state, "fixture-incomplete-state");
      trim(id);
      publishChange(id, personalDocumentIds.has(id) ? "owner" : null);
    },
    corrupt() {
      for (const [documentId, doc] of documents) {
        doc.updates.push({
          updateId: "invalidciphertext000000",
          payload: "AAAA",
          sequence: lastSequence(documentId) + 1,
          deviceId: "fixture-corrupt",
          createdAt: new Date().toISOString(),
        });
        publishChange(documentId, null);
      }
    },
  };
};
