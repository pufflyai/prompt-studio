import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPerformanceRecording, readPerformanceRecordings } from "./performance-recording";

test("rotates complete records within the disk bound and stops writing when closed", () => {
  const directory = mkdtempSync(join(tmpdir(), "performance-recording-"));
  try {
    const recorder = createPerformanceRecording(directory);
    const record = { captureId: "capture", kind: "sample", samples: "a".repeat(20_000) };
    for (let i = 0; i < 300; i++) recorder.write(record);
    recorder.close();
    const files = readdirSync(directory).filter((name) => name.endsWith(".jsonl"));
    expect(files.length).toBe(4);
    expect(files.reduce((sum, name) => sum + statSync(join(directory, name)).size, 0)).toBeLessThanOrEqual(
      4 * 1024 * 1024,
    );
    for (const file of files)
      for (const line of readFileSync(join(directory, file), "utf8").trim().split("\n"))
        expect(JSON.parse(line).captureId).toBe("capture");
    const size = files.reduce((sum, name) => sum + statSync(join(directory, name)).size, 0);
    recorder.write(record);
    expect(files.reduce((sum, name) => sum + statSync(join(directory, name)).size, 0)).toBe(size);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("exports saved records after disable without creating an absent recording directory", () => {
  const directory = mkdtempSync(join(tmpdir(), "performance-export-"));
  try {
    const absent = join(directory, "absent");
    expect(readPerformanceRecordings(absent)).toEqual({ directory: absent, files: [] });
    expect(readdirSync(directory)).toEqual([]);
    const recorder = createPerformanceRecording(directory);
    recorder.write({ kind: "start", captureId: "capture" });
    recorder.close();
    const exported = readPerformanceRecordings(directory);
    expect(exported.files).toHaveLength(1);
    expect(JSON.parse(exported.files[0]!.content)).toEqual({ kind: "start", captureId: "capture" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
