// PGlite parses a statement's JSON payload inside its WASM heap, so a few multi-megabyte
// records in one statement exhaust it. Batches are bounded by encoded size, not row count.
const maxBatchBytes = 4_000_000;

/** JSON arrays of the rows. Each stays under the limit unless one row alone is larger. */
export const jsonBatches = (rows: unknown[]) => {
  const batches: string[] = [];
  let current: string[] = [];
  let size = 0;
  for (const row of rows) {
    const json = JSON.stringify(row);
    const bytes = Buffer.byteLength(json);
    if (current.length && size + bytes > maxBatchBytes) {
      batches.push(`[${current.join(",")}]`);
      current = [];
      size = 0;
    }
    current.push(json);
    size += bytes;
  }
  if (current.length) batches.push(`[${current.join(",")}]`);
  return batches;
};
