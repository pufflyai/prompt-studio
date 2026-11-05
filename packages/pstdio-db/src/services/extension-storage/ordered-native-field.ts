import type { DocumentState, StorageOwner } from "pstdio-sync";
import { NativeSourceRecoveryError, NativeSourceRetiredError } from "pstdio-sync";
import { jsonPointer, openOrderedText, parseJsonPointer, prepareOrderedOperation } from "pstdio-sync/records";
import { readTextDocumentSeed } from "pstdio-sync/text";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { withOrderedOwner } from "./ordered-journal";
import { exposeOrderedTextFrontier, readOrderedTextFrontier } from "./ordered-native-frontier";
import { type OrderedFieldMarker, orderedFieldMarkerId, readOrderedMarker } from "./ordered-native-metadata";
import { queueOrderedNativeOperation } from "./ordered-native-queue";
import { rememberOrderedTextGeneration } from "./ordered-native-recovery";
import { findOrderedNativeField } from "./ordered-native-source";
import { initializeOrderedOwner } from "./ordered-projection";
import { rebaseOrderedProjection } from "./ordered-rebase";

const prepareField = async (
  document: Y.Doc,
  before: Uint8Array,
  seed: string,
  recordId: string,
  prepare?: (document: Y.Doc) => Promise<Y.Doc | null>,
) => {
  if (!prepare) return;
  const candidate = await prepare(document);
  if (!candidate || candidate === document) return;
  try {
    if ((await readTextDocumentSeed(candidate)).id !== seed)
      throw new NativeSourceRecoveryError("This editor belongs to another text history", recordId);
    Y.applyUpdate(document, Y.encodeStateAsUpdate(candidate, before));
  } finally {
    candidate.destroy();
  }
};

const validateFieldState = async (document: Y.Doc, seed: string, recordId: string) => {
  if (document.store.pendingStructs || document.store.pendingDs || (await readTextDocumentSeed(document)).id !== seed)
    throw new NativeSourceRecoveryError("The editor source is missing its original history", recordId);
};

export const runOrderedNativeField = async <T>(input: {
  db: DbClient;
  owner: StorageOwner;
  key: string;
  action: (state: DocumentState) => Promise<T>;
  prepare?: (local: Y.Doc) => Promise<Y.Doc | null>;
  external?: boolean;
  generation?: string;
}) => {
  if (!(await findOrderedNativeField(input.db, input.owner, input.key))) return undefined;
  return withOrderedOwner(input.db, input.owner, async (journal, tx, created) => {
    await initializeOrderedOwner(journal, tx, input.owner, created);
    const binding = await findOrderedNativeField(tx, input.owner, input.key);
    if (!binding) throw new NativeSourceRetiredError(input.key);
    if (input.external && binding.generation !== input.generation)
      throw new NativeSourceRecoveryError("This editor belongs to an earlier local text replica", binding.recordId);
    const { views } = await rebaseOrderedProjection(journal, tx, input.owner, [binding.recordId]);
    const record = views.get(binding.recordId);
    if (!record || record.deleted || record.lifetime !== binding.lifetime)
      throw new NativeSourceRetiredError(binding.recordId);
    const path = ["value", ...parseJsonPointer(binding.field)];
    const saved = record.texts?.[jsonPointer(path)];
    if (!saved) throw new NativeSourceRecoveryError("This field is missing its ordered text history", binding.recordId);
    const opened = await openOrderedText(record.recordId, record.lifetime, path, record.value, saved);
    try {
      const before = Y.encodeStateVector(opened.document);
      // These structs travel with editor snapshots. Include them in a later queued
      // delta, but exposing the proof alone is not an authored text save.
      exposeOrderedTextFrontier(opened.document, saved.pending);
      let changed = false;
      opened.document.on("update", () => {
        changed = true;
      });
      await prepareField(opened.document, before, opened.seed, binding.recordId, input.prepare);
      const remembered = new Map<string, string>();
      const marker = await readOrderedMarker<OrderedFieldMarker>(tx, input.owner, orderedFieldMarkerId(input.key));
      const value = await input.action({
        document: opened.document,
        revision: marker?.revision ?? 0,
        operation: async (id) => await journal.requestIdentity(id),
        remember: (id, identity) => {
          remembered.set(id, identity);
        },
      });
      if (!changed) return { value, changed: false, projected: 0, generation: binding.generation };
      await validateFieldState(opened.document, opened.seed, binding.recordId);
      const operationId = remembered.keys().next().value ?? crypto.randomUUID();
      const update = Buffer.from(Y.encodeStateAsUpdate(opened.document, before)).toString("base64");
      const dependencies = readOrderedTextFrontier(opened.document, saved.pending);
      const operation = await prepareOrderedOperation(
        {
          operationId,
          edits: [
            { recordId: binding.recordId, changes: [], texts: [{ path, update, seed: opened.seed, dependencies }] },
          ],
        },
        views,
      );
      const identity = remembered.get(operationId) ?? (await fingerprint(operation as unknown as Json));
      if (remembered.size) {
        await rememberOrderedTextGeneration(tx, input.owner, operation);
        await journal.queue(operation, identity);
      } else await queueOrderedNativeOperation(journal, tx, input.owner, operation, identity, views);
      const result = await rebaseOrderedProjection(journal, tx, input.owner, [binding.recordId]);
      return { ...result, value, changed: true, generation: binding.generation };
    } finally {
      opened.document.destroy();
    }
  });
};

export const orderedNativeSnapshot = async (db: DbClient, owner: StorageOwner, key: string) => {
  const result = await runOrderedNativeField({
    db,
    owner,
    key,
    action: async ({ document, revision }) => ({ state: Y.encodeStateAsUpdate(document), revision: revision ?? 0 }),
  });
  return result ? { ...result.value, generation: result.generation } : undefined;
};

export const orderedNativeRevision = async (db: DbClient, owner: StorageOwner, key: string) => {
  if (!(await findOrderedNativeField(db, owner, key))) return undefined;
  return (await readOrderedMarker<OrderedFieldMarker>(db, owner, orderedFieldMarkerId(key)))?.revision ?? 0;
};
