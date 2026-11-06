import { parseJsonPointer, pathsOverlap } from "./ordered-json";
import type { OrderedRecord } from "./ordered-operation";

/** Pending and canonical delivery name the same authored field occurrence. */
const authored = (stamp: string) => {
  if (stamp === "initial") return stamp;
  const parts = JSON.parse(stamp) as string[];
  if (parts[0] === "pending") return ["operation", parts[1]];
  if (parts[0] === "canonical") return ["operation", parts[2]];
  return parts;
};

export const orderedTextLifetime = (record: OrderedRecord | undefined, path: string[]) => {
  if (!record) return "initial";
  const writes = Object.entries(record.stamps)
    .filter(([pointer]) => pathsOverlap(parseJsonPointer(pointer), path))
    .map(([pointer, stamp]) => [pointer, authored(stamp)])
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
  return JSON.stringify([authored(record.lifetime), writes]);
};
