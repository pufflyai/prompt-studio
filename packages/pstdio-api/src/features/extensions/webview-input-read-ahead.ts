import { isAbsolute } from "node:path";
import { isRuntimeModuleImportHints, type RuntimeModuleImportHint } from "pstdio-extensions/revision-dependencies";

const maxBytes = 64 * 1024 * 1024;
const maxFileBytes = 2 * 1024 * 1024;
const maxFiles = 12_288;
const maxHintBytes = 2 * 1024 * 1024;
export type WebviewReadHint = [path: string, size: number];
export interface WebviewInputHints {
  reads: WebviewReadHint[];
  imports: RuntimeModuleImportHint[];
}

const encodedHintBytes = (value: WebviewReadHint) => Buffer.byteLength(JSON.stringify(value)) + 1;

export const captureWebviewReadHints = (contents: ReadonlyMap<string, Buffer>) => {
  const hints: WebviewReadHint[] = [];
  let bytes = 2;
  for (const [path, value] of contents) {
    if (hints.length >= maxFiles) break;
    if (value.byteLength > maxFileBytes) continue;
    const hint: WebviewReadHint = [path, value.byteLength];
    const length = encodedHintBytes(hint);
    if (bytes + length > maxHintBytes) break;
    bytes += length;
    hints.push(hint);
  }
  return hints;
};

const isBoundedHint = (value: unknown): value is WebviewReadHint =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === "string" &&
  isAbsolute(value[0]) &&
  Number.isSafeInteger(value[1]) &&
  value[1] >= 0 &&
  value[1] <= maxFileBytes;

const isWebviewReadHints = (value: unknown): value is WebviewReadHint[] => {
  if (!Array.isArray(value) || value.length > maxFiles) return false;
  let bytes = 2;
  for (const hint of value) {
    if (!isBoundedHint(hint)) return false;
    bytes += encodedHintBytes(hint);
    if (bytes > maxHintBytes) return false;
  }
  return true;
};

export const isWebviewInputHints = (value: unknown): value is WebviewInputHints =>
  value !== null &&
  typeof value === "object" &&
  "reads" in value &&
  isWebviewReadHints(value.reads) &&
  "imports" in value &&
  isRuntimeModuleImportHints(value.imports);

export const readWebviewHints = async (hints: WebviewReadHint[], signal?: AbortSignal) => {
  const contents = new Map<string, Buffer>();
  const paths = new Map(hints);
  const pending = paths.entries();
  let scheduledBytes = 0;
  const readers = await Promise.allSettled(
    Array.from({ length: 8 }, async () => {
      for (const [path, size] of pending) {
        signal?.throwIfAborted();
        if (scheduledBytes + size > maxBytes) continue;
        scheduledBytes += size;
        try {
          // Only filenames and size hints cross checks. Read new bytes and leave
          // resized or unavailable files to the fresh graph traversal.
          const data = await Bun.file(path)
            .slice(0, size + 1)
            .arrayBuffer();
          if (data.byteLength === size) contents.set(path, Buffer.from(data));
        } catch {
          // A now-missing path may have left the graph entirely.
        }
      }
    }),
  );
  for (const reader of readers) if (reader.status === "rejected") throw reader.reason;
  signal?.throwIfAborted();
  return contents;
};
