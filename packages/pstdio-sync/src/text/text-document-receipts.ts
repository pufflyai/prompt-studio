import * as Y from "yjs";
import { decodeBytes, encodeBytes } from "../shared";
import {
  type CharacterMapping,
  characterId,
  characterKey,
  validateTextCharacterRange,
} from "./text-document-characters";

export const textAdoptionsKey = "text-adoptions";
type MappingRun = [
  client: number,
  clock: number,
  length: number,
  targetClient: number | null,
  targetClock: number | null,
];
export interface TextAdoptionReceipt {
  state: string;
  mapping: MappingRun[];
}

export const saveTextReceipt = (document: Y.Doc, seed: string, receipt: TextAdoptionReceipt) => {
  const map = document.getMap<TextAdoptionReceipt>(textAdoptionsKey);
  if (JSON.stringify(map.get(seed)) !== JSON.stringify(receipt)) map.set(seed, receipt);
};

export const cloneTextDocument = (document: Y.Doc) => {
  const clone = new Y.Doc();
  Y.applyUpdate(clone, Y.encodeStateAsUpdate(document));
  return clone;
};

/** Receipts retain source operations, never recursively retain other receipts' payloads. */
export const textCheckpoint = (document: Y.Doc) => {
  const copy = cloneTextDocument(document);
  try {
    copy.getMap(textAdoptionsKey).clear();
    return encodeBytes(Y.encodeStateAsUpdate(copy));
  } finally {
    copy.destroy();
  }
};

export const loadTextCheckpoint = (state: string) => {
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, decodeBytes(state));
    return document;
  } catch (error) {
    document.destroy();
    throw error;
  }
};

export const encodeCharacterMapping = (mapping: CharacterMapping) => {
  const runs: MappingRun[] = [];
  const entries = [...mapping].map(([key, target]) => ({ source: characterId(key), target }));
  entries.sort((left, right) => left.source.client - right.source.client || left.source.clock - right.source.clock);
  for (const { source, target } of entries) {
    const previous = runs.at(-1);
    const consecutive = previous && previous[0] === source.client && previous[1] + previous[2] === source.clock;
    const sameTarget =
      previous &&
      previous[3] === (target?.client ?? null) &&
      (previous[4] === null ? target === null : previous[4] + previous[2] === target?.clock);
    if (consecutive && sameTarget) previous[2]++;
    else runs.push([source.client, source.clock, 1, target?.client ?? null, target?.clock ?? null]);
  }
  return runs;
};

const validClock = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const validTarget = (client: number | null, clock: number | null, length: number) =>
  (client === null && clock === null) || (validClock(client) && validClock(clock) && validClock(clock! + length));

export const validateCharacterMapping = (
  runs: MappingRun[],
  source?: Map<number, number>,
  target?: Map<number, number>,
) => {
  if (!Array.isArray(runs)) throw new Error("Invalid text character mapping");
  let previousClient = -1;
  let previousEnd = 0;
  for (const run of runs) {
    if (!Array.isArray(run) || run.length !== 5) throw new Error("Invalid text character mapping");
    const [client, clock, length, targetClient, targetClock] = run;
    const sourceValid =
      validClock(client) && validClock(clock) && validClock(length) && length > 0 && validClock(clock + length);
    const ordered = client > previousClient || (client === previousClient && clock >= previousEnd);
    if (!sourceValid || !validTarget(targetClient, targetClock, length) || !ordered)
      throw new Error("Invalid text character mapping");
    if (source && (source.get(client) ?? 0) < clock + length) throw new Error("Text mapping exceeds source history");
    if (target && targetClient !== null && (target.get(targetClient) ?? 0) < targetClock! + length)
      throw new Error("Text mapping exceeds canonical history");
    previousClient = client;
    previousEnd = clock + length;
  }
};

export const decodeCharacterMapping = (runs: MappingRun[]) => {
  validateCharacterMapping(runs);
  const mapping: CharacterMapping = new Map();
  for (const [client, clock, length, targetClient, targetClock] of runs)
    for (let offset = 0; offset < length; offset++)
      mapping.set(
        characterKey(Y.createID(client, clock + offset)),
        targetClient === null ? null : Y.createID(targetClient, targetClock! + offset),
      );
  return mapping;
};

export const validateMappingContent = (runs: MappingRun[], source: Y.Doc, target: Y.Doc) => {
  for (const [client, clock, length, targetClient, targetClock] of runs) {
    validateTextCharacterRange(source, client, clock, length);
    if (targetClient !== null) validateTextCharacterRange(target, targetClient, targetClock!, length);
  }
};
