import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStorageDiagnosticSink } from "./storage-diagnostic-sink";

test("diagnostic capture is immediately readable and identifies process, ordering and durable source", () => {
  const root = mkdtempSync(join(tmpdir(), "storage-diagnostics-"));
  try {
    const path = join(root, "events.jsonl");
    const sink = createStorageDiagnosticSink(path);
    const owner = { workbenchId: "project", extensionId: "extension" };
    sink({ phase: "document-captured", owner, documentId: "records", sourceRevision: 7, bytes: 42 });
    sink({ phase: "receiver-persisted", owner, documentId: "records", sourceRevision: 8 });
    const rows = readFileSync(path, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(rows.map((row) => row.phase)).toEqual(["capture-start", "document-captured", "receiver-persisted"]);
    expect(rows.map((row) => row.sequence)).toEqual([1, 2, 3]);
    expect(rows.every((row) => row.processId === process.pid && row.capture === "storage")).toBe(true);
    expect(rows[1].monotonicMs).toBeGreaterThanOrEqual(rows[0].monotonicMs);
    expect(rows[2]).toMatchObject({ owner, documentId: "records", sourceRevision: 8 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
