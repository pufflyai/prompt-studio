import * as Y from "yjs";
import { decodeBytes, encodeBytes, isEmptyDocument } from "../shared";
import { ownTextDeletions, ownTextInsertions } from "./text-document-edits";
import { textDocumentKeys } from "./text-document-keys";
import {
  loadTextCheckpoint,
  type TextAdoptionReceipt,
  textAdoptionsKey,
  validateCharacterMapping,
  validateMappingContent,
} from "./text-document-receipts";

const seedMap = textDocumentKeys.seeds;
const seedId = async (state: Uint8Array) => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(state)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/** The genesis identifies actual original characters, not just equal source strings. */
const readGenesis = async (document: Y.Doc) => {
  ownTextDeletions(document);
  ownTextInsertions(document);
  const entries = [...document.getMap<string>(seedMap)];
  if (entries.length !== 1) throw new Error("A text document must have exactly one initial history");
  const [id, encoded] = entries[0]!;
  if (typeof encoded !== "string") throw new Error("Invalid text document genesis");
  const state = decodeBytes(encoded);
  if ((await seedId(state)) !== id) throw new Error("Text document genesis does not match its identity");
  const genesis = new Y.Doc();
  try {
    Y.applyUpdate(genesis, state);
    const source = genesis.getText("content").toString();
    const current = Y.decodeStateVector(Y.encodeStateVector(document));
    const initial = Y.decodeStateVector(Y.encodeStateVector(genesis));
    if ([...initial].some(([client, clock]) => (current.get(client) ?? 0) < clock))
      throw new Error("Text document is missing its original characters");
    return { id, state, source };
  } finally {
    genesis.destroy();
  }
};

export const readTextDocumentSeed = async (document: Y.Doc) => {
  const seed = await readGenesis(document);
  const current = Y.decodeStateVector(Y.encodeStateVector(document));
  for (const [expected, receipt] of document.getMap<TextAdoptionReceipt>(textAdoptionsKey)) {
    if (!receipt || typeof receipt.state !== "string") throw new Error("Invalid text adoption receipt");
    const source = loadTextCheckpoint(receipt.state);
    try {
      if (source.getMap(textAdoptionsKey).size)
        throw new Error("Text checkpoints cannot contain nested adoption receipts");
      const original = await readGenesis(source);
      if (original.id !== expected) throw new Error("Adoption receipt has another source history");
      validateCharacterMapping(receipt.mapping, Y.decodeStateVector(Y.encodeStateVector(source)), current);
      validateMappingContent(receipt.mapping, source, document);
    } finally {
      source.destroy();
    }
  }
  return seed;
};

/** Called under the host's durable document transaction, including for an empty source. */
export const seedTextDocument = async (document: Y.Doc, source: string) => {
  if (document.getMap(seedMap).size) {
    await readTextDocumentSeed(document);
    return false;
  }
  if (!isEmptyDocument(document)) throw new Error("Cannot seed over existing unseeded text");
  const genesis = new Y.Doc();
  try {
    genesis.getText("content").insert(0, source);
    const state = Y.encodeStateAsUpdate(genesis);
    const id = await seedId(state);
    genesis.getMap<string>(seedMap).set(id, encodeBytes(state));
    Y.applyUpdate(document, Y.encodeStateAsUpdate(genesis));
    return true;
  } finally {
    genesis.destroy();
  }
};

/** The original characters of this exact history, with their validated seed metadata. */
export const initialTextDocumentState = async (document: Y.Doc) => {
  const seed = await readTextDocumentSeed(document);
  const initial = new Y.Doc();
  try {
    Y.applyUpdate(initial, seed.state);
    initial.getMap<string>(seedMap).set(seed.id, encodeBytes(seed.state));
    return Y.encodeStateAsUpdate(initial);
  } finally {
    initial.destroy();
  }
};
