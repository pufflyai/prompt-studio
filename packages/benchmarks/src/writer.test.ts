import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RESULTS_FILE_ENV, recordMeasurement } from "./writer";

const previous = process.env[RESULTS_FILE_ENV];
afterEach(() => {
  if (previous === undefined) delete process.env[RESULTS_FILE_ENV];
  else process.env[RESULTS_FILE_ENV] = previous;
});

describe("benchmark writer", () => {
  test("appends finite measurements and leaves out missing ones", () => {
    const file = join(mkdtempSync(join(tmpdir(), "benchmark-writer-")), "results.jsonl");
    process.env[RESULTS_FILE_ENV] = file;
    recordMeasurement({ metric: "cold-start", label: "Cold start", unit: "ms", value: 5400, budget: 8000 });
    recordMeasurement({ metric: "main-cpu", label: "Main CPU", unit: "percent", value: Number.NaN });
    const lines = readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(lines).toEqual([{ metric: "cold-start", label: "Cold start", unit: "ms", value: 5400, budget: 8000 }]);
  });
});
