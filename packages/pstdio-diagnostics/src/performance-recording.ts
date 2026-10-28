import { appendFileSync, existsSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { securePerformanceDirectory } from "./secure-performance-directory";

const MAX_FILE_BYTES = 1024 * 1024;
const FILE_COUNT = 4;

/** One writer owned by the device capture. Small synchronous writes cannot queue after disable. */
export const createPerformanceRecording = (directory: string) => {
  securePerformanceDirectory(directory);
  const path = (index: number) => join(directory, `performance-${index}.jsonl`);
  let bytes = existsSync(path(0)) ? statSync(path(0)).size : 0;
  let closed = false;
  return {
    write: (record: unknown) => {
      if (closed) return;
      const line = `${JSON.stringify(record)}\n`;
      const length = Buffer.byteLength(line);
      if (length > MAX_FILE_BYTES) throw new Error("Performance record exceeds the recording bound");
      if (bytes + length > MAX_FILE_BYTES) {
        rmSync(path(FILE_COUNT - 1), { force: true });
        for (let index = FILE_COUNT - 2; index >= 0; index--) {
          if (existsSync(path(index))) renameSync(path(index), path(index + 1));
        }
        bytes = 0;
      }
      appendFileSync(path(0), line, { mode: 0o600 });
      bytes += length;
    },
    close: () => {
      closed = true;
    },
  };
};

/** Explicit export reads saved files without starting collection or creating directories. */
export const readPerformanceRecordings = (directory: string) => ({
  directory,
  files: Array.from({ length: FILE_COUNT }, (_, index) => {
    const name = `performance-${index}.jsonl`;
    const path = join(directory, name);
    if (!existsSync(path)) return null;
    if (statSync(path).size > MAX_FILE_BYTES) throw new Error("Performance recording exceeds the file bound");
    return { name, content: readFileSync(path, "utf8") };
  }).filter((file) => file !== null),
});
