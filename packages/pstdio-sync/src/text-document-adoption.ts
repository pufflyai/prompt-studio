import * as Y from "yjs";
import { isEmptyDocument } from "./document-types";
import { missingUpdate } from "./relay/document-merge";
import {
  type CharacterMapping,
  characterId,
  characterKey,
  isDeletedCharacter,
  mapDeletedCharacter,
  mapOriginalCharacters,
  textCharacters,
  translateCharacters,
} from "./text-document-characters";
import { ownTextDeletions } from "./text-document-edits";
import { normalizeTextEquivalence } from "./text-document-equivalence";
import {
  cloneTextDocument,
  decodeCharacterMapping,
  encodeCharacterMapping,
  loadTextCheckpoint,
  saveTextReceipt,
  type TextAdoptionReceipt,
  textAdoptionsKey,
  textCheckpoint,
} from "./text-document-receipts";
import { readTextDocumentSeed } from "./text-document-seed";

export { seedTextDocument } from "./text-document-seed";

const initialSource = (state: Uint8Array) => {
  const document = new Y.Doc();
  Y.applyUpdate(document, state);
  return document;
};

const restoreOriginalHistory = (target: Y.Doc, state: string) => {
  const receipts = [...target.getMap<TextAdoptionReceipt>(textAdoptionsKey)];
  const original = loadTextCheckpoint(state);
  try {
    Y.applyUpdate(target, Y.encodeStateAsUpdate(original));
    for (const [key, receipt] of receipts) saveTextReceipt(target, key, receipt);
  } finally {
    original.destroy();
  }
};

const combineMapping = (
  mapping: CharacterMapping,
  source: string,
  target: Y.ID | null,
  pairs: Array<[Y.ID, Y.ID]>,
  genesis: Map<number, number>,
  deleted: boolean,
  exactDeletes: Y.ID[],
) => {
  const previous = mapping.get(source);
  if (mapping.has(source) && previous === null) return;
  const [client, clock] = source.split(":").map(Number);
  const initial = (genesis.get(client!) ?? 0) > clock!;
  if (deleted && !initial) {
    if (previous) exactDeletes.push(previous);
    if (target) exactDeletes.push(target);
  }
  if (previous && target && characterKey(previous) !== characterKey(target)) {
    // Initial-source alignment is heuristic. It cannot identify duplicate user insertions.
    if (initial) return;
    pairs.push([previous, target]);
    return;
  }
  if (!mapping.has(source)) mapping.set(source, target);
};

const reverseKnownHistory = (input: {
  source: Y.Doc;
  target: Y.Doc;
  targetSeed: string;
  mapping: CharacterMapping;
  genesis: Map<number, number>;
  exactDeletes: Y.ID[];
  pairs: Array<[Y.ID, Y.ID]>;
}) => {
  const receipt = input.source.getMap<TextAdoptionReceipt>(textAdoptionsKey).get(input.targetSeed);
  if (!receipt) return;
  restoreOriginalHistory(input.target, receipt.state);
  const ownSource = ownTextDeletions(input.source);
  const ownTarget = ownTextDeletions(input.target);
  for (const [source, target] of decodeCharacterMapping(receipt.mapping))
    if (target) {
      const [client, clock] = source.split(":").map(Number);
      combineMapping(
        input.mapping,
        characterKey(target),
        Y.createID(client!, clock!),
        input.pairs,
        input.genesis,
        (ownSource(target) && isDeletedCharacter(input.source.getText("content"), target)) ||
          ownTarget(Y.createID(client!, clock!)),
        input.exactDeletes,
      );
    }
};

const carryReceipts = async (
  source: Y.Doc,
  target: Y.Doc,
  targetSeed: string,
  translated: CharacterMapping,
  exactDeletes: Y.ID[],
  pairs: Array<[Y.ID, Y.ID]>,
) => {
  const map = target.getMap<TextAdoptionReceipt>(textAdoptionsKey);
  const ownSource = ownTextDeletions(source);
  for (const [seed, receipt] of source.getMap<TextAdoptionReceipt>(textAdoptionsKey)) {
    if (seed === targetSeed) continue;
    const previous = map.get(seed);
    const old = loadTextCheckpoint(receipt.state);
    const mapping = previous ? decodeCharacterMapping(previous.mapping) : new Map<string, Y.ID | null>();
    try {
      if (previous) {
        const known = loadTextCheckpoint(previous.state);
        try {
          Y.applyUpdate(old, Y.encodeStateAsUpdate(known));
        } finally {
          known.destroy();
        }
      }
      const initial = await readTextDocumentSeed(old);
      const genesis = Y.decodeStateVector(Y.encodeStateVectorFromUpdate(initial.state));
      const ownOld = ownTextDeletions(old);
      for (const [key, via] of decodeCharacterMapping(receipt.mapping)) {
        const next = via
          ? mapDeletedCharacter(source.getText("content"), target.getText("content"), translated, via)
          : null;
        if (next !== undefined)
          combineMapping(
            mapping,
            key,
            next,
            pairs,
            genesis,
            Boolean(via && ownSource(via) && isDeletedCharacter(source.getText("content"), via)) ||
              ownOld(characterId(key)),
            exactDeletes,
          );
      }
      exactDeletes.push(...translateCharacters(old.getText("content"), target.getText("content"), mapping, genesis));
      saveTextReceipt(target, seed, { state: textCheckpoint(old), mapping: encodeCharacterMapping(mapping) });
    } finally {
      old.destroy();
    }
  }
};

const sameReceipts = (left: Y.Doc, right: Y.Doc) => {
  const first = left.getMap<TextAdoptionReceipt>(textAdoptionsKey);
  const second = right.getMap<TextAdoptionReceipt>(textAdoptionsKey);
  return (
    first.size === second.size &&
    [...first].every(([seed, receipt]) => JSON.stringify(receipt) === JSON.stringify(second.get(seed)))
  );
};

const identityMapping = (document: Y.Doc) => {
  const mapping: CharacterMapping = new Map(
    textCharacters(document.getText("content")).map(({ id }) => [characterKey(id), id]),
  );
  const vector = Y.decodeStateVector(Y.encodeStateVector(document));
  for (const receipt of document.getMap<TextAdoptionReceipt>(textAdoptionsKey).values())
    for (const id of decodeCharacterMapping(receipt.mapping).values())
      if (id && (vector.get(id.client) ?? 0) > id.clock) mapping.set(characterKey(id), id);
  return mapping;
};

const mergeSharedHistory = async (local: Y.Doc, remote: Y.Doc, merged: Y.Doc, seed: string) => {
  const receipts = new Map(remote.getMap<TextAdoptionReceipt>(textAdoptionsKey));
  Y.applyUpdate(merged, Y.encodeStateAsUpdate(local));
  if (sameReceipts(local, remote)) return merged;
  const map = merged.getMap<TextAdoptionReceipt>(textAdoptionsKey);
  for (const key of map.keys()) if (!receipts.has(key)) map.delete(key);
  for (const [key, receipt] of receipts) saveTextReceipt(merged, key, receipt);
  const exactDeletes: Y.ID[] = [];
  const pairs: Array<[Y.ID, Y.ID]> = [];
  await carryReceipts(local, merged, seed, identityMapping(local), exactDeletes, pairs);
  await normalizeTextEquivalence({ local, remote, target: merged, seed, pairs, deleted: exactDeletes });
  return merged;
};

/** Build a candidate. Different-root candidates must be serialized by latest-state CAS. */
export const mergeTextDocuments = async (local: Y.Doc, remote: Y.Doc) => {
  const remoteSeed = await readTextDocumentSeed(remote);
  if (isEmptyDocument(local)) return cloneTextDocument(remote);
  const localSeed = await readTextDocumentSeed(local);
  const merged = cloneTextDocument(remote);
  if (localSeed.id === remoteSeed.id) {
    try {
      return await mergeSharedHistory(local, remote, merged, remoteSeed.id);
    } catch (error) {
      merged.destroy();
      throw error;
    }
  }
  const receipts = merged.getMap<TextAdoptionReceipt>(textAdoptionsKey);
  const receipt = receipts.get(localSeed.id);
  const source = receipt ? loadTextCheckpoint(receipt.state) : initialSource(localSeed.state);
  const targetGenesis = initialSource(remoteSeed.state);
  const mapping = receipt
    ? decodeCharacterMapping(receipt.mapping)
    : mapOriginalCharacters(source.getText("content"), targetGenesis.getText("content"));
  try {
    const exactDeletes: Y.ID[] = [];
    const pairs: Array<[Y.ID, Y.ID]> = [];
    const genesis = Y.decodeStateVector(Y.encodeStateVectorFromUpdate(localSeed.state));
    reverseKnownHistory({
      source: local,
      target: merged,
      targetSeed: remoteSeed.id,
      mapping,
      genesis,
      exactDeletes,
      pairs,
    });
    Y.applyUpdate(source, Y.encodeStateAsUpdate(local));
    exactDeletes.push(...translateCharacters(source.getText("content"), merged.getText("content"), mapping, genesis));
    await carryReceipts(local, merged, remoteSeed.id, mapping, exactDeletes, pairs);
    saveTextReceipt(merged, localSeed.id, {
      state: textCheckpoint(source),
      mapping: encodeCharacterMapping(mapping),
    });
    await normalizeTextEquivalence({
      local,
      remote,
      target: merged,
      seed: remoteSeed.id,
      pairs,
      deleted: exactDeletes,
    });
    return merged;
  } catch (error) {
    merged.destroy();
    throw error;
  } finally {
    source.destroy();
    targetGenesis.destroy();
  }
};

export const prepareTextDocumentAdoption = async (local: Y.Doc, remote: Y.Doc) => {
  if (isEmptyDocument(local)) return null;
  const localSeed = await readTextDocumentSeed(local);
  const remoteSeed = await readTextDocumentSeed(remote);
  const shared = localSeed.id === remoteSeed.id;
  if (shared && sameReceipts(local, remote)) return null;
  const candidate = await mergeTextDocuments(local, remote);
  if (shared) {
    const ordinary = cloneTextDocument(remote);
    try {
      Y.applyUpdate(ordinary, Y.encodeStateAsUpdate(local));
      if (missingUpdate(candidate, ordinary) || !sameReceipts(candidate, remote)) return candidate;
    } finally {
      ordinary.destroy();
    }
  } else if (missingUpdate(candidate, remote)) return candidate;
  candidate.destroy();
  return null;
};
