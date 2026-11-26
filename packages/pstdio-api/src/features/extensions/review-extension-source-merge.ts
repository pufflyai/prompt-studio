import { diffArrays } from "diff";

type FileBytes = Uint8Array | null;
type MergeDecision =
  | { kind: "unchanged" | "keep-local" | "take-incoming" | "conflict" }
  | { kind: "merged"; text: string };

interface LineEdit {
  start: number;
  end: number;
  replacement: string[];
}

const lines = (text: string) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
const equalBytes = (left: FileBytes, right: FileBytes) =>
  left === right || (left !== null && right !== null && Buffer.from(left).equals(right));

const lineEdits = (base: string[], side: string[]) => {
  const difference = diffArrays(base, side, { maxEditLength: 4_000, timeout: 200 });
  if (!difference) return null;
  let cursor = 0;
  let pending: LineEdit | undefined;
  const edits: LineEdit[] = [];
  for (const part of difference) {
    if (part.added || part.removed) {
      if (!pending) {
        pending = { start: cursor, end: cursor, replacement: [] };
        edits.push(pending);
      }
      if (part.added) pending.replacement.push(...part.value);
      else pending.end = cursor + part.count;
    } else pending = undefined;
    if (!part.added) cursor += part.count;
  }
  return edits;
};

const combineLineEdits = (local: LineEdit[], incoming: LineEdit[]) => {
  const result: LineEdit[] = [];
  for (const edit of [...local, ...incoming].sort((left, right) => left.start - right.start || left.end - right.end)) {
    const previous = result.at(-1);
    if (previous && previous.start === edit.start) {
      if (previous.end === edit.end && previous.replacement.join("") === edit.replacement.join("")) continue;
      return null;
    }
    if (previous && previous.end > edit.start) return null;
    result.push(edit);
  }
  return result;
};

const mergeText = (base: string, local: string, incoming: string) => {
  const original = lines(base);
  const localLines = lines(local);
  const incomingLines = lines(incoming);
  if (original.length + localLines.length + incomingLines.length > 50_000) return null;
  const left = lineEdits(original, localLines);
  const right = lineEdits(original, incomingLines);
  if (!left || !right) return null;
  const edits = combineLineEdits(left, right);
  if (!edits) return null;
  const result: string[] = [];
  let cursor = 0;
  for (const { start, end, replacement } of edits) {
    result.push(...original.slice(cursor, start), ...replacement);
    cursor = end;
  }
  result.push(...original.slice(cursor));
  return result.join("");
};

const readText = (bytes: FileBytes) => {
  if (!bytes || bytes.byteLength > 1024 * 1024 || bytes.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return null;
  }
};

/** Undefined base means there is no verified ancestry. Null means this file was absent in a known base. */
export const mergeExtensionReviewFile = (
  base: FileBytes | undefined,
  local: FileBytes,
  incoming: FileBytes,
): MergeDecision => {
  if (equalBytes(local, incoming)) return { kind: "unchanged" };
  if (base === undefined) return { kind: "conflict" };
  if (equalBytes(local, base)) return { kind: "take-incoming" };
  if (equalBytes(incoming, base)) return { kind: "keep-local" };
  const original = readText(base);
  const left = readText(local);
  const right = readText(incoming);
  if (original === null || left === null || right === null) return { kind: "conflict" };
  const text = mergeText(original, left, right);
  return text === null ? { kind: "conflict" } : { kind: "merged", text };
};
