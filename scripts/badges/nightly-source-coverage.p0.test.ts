import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { summarizeCoverage } from "./coverage-badge";
import { collectNightlySourceCoverage } from "./nightly-source-coverage";

const source = "a".repeat(40);
const evidence = (overrides = {}) => ({
  sourceSha: source,
  priority: "P0",
  platform: "linux",
  arch: "x64",
  lane: "stable",
  complete: true,
  exitCode: 0,
  packageDir: "packages/example",
  reportedFiles: ["packages/example/src/value.p0.test.ts"],
  coverage: { file: "coverage/lcov.info", sourceRoot: "repository" },
  ...overrides,
});
const writeProducer = (root: string, name: string, metadata: object, hits = 1) => {
  const path = join(root, name);
  mkdirSync(join(path, "coverage"), { recursive: true });
  writeFileSync(join(path, "cases.json"), JSON.stringify(metadata));
  writeFileSync(
    join(path, "selection.json"),
    JSON.stringify({
      sourceSha: source,
      outcome: "success",
      selectedFiles: (metadata as { reportedFiles: string[] }).reportedFiles,
    }),
  );
  writeFileSync(join(path, "coverage/lcov.info"), `SF:packages/example/src/value.ts\nDA:1,${hits}\nend_of_record\n`);
};

test("nightly merges stable source hits across priorities and platforms without quarantine or P3", () => {
  const root = mkdtempSync(join(tmpdir(), "nightly-source-"));
  try {
    writeProducer(root, "linux", evidence(), 0);
    writeProducer(root, "windows", evidence({ priority: "P2", platform: "win32" }), 3);
    writeProducer(root, "linux/quarantine", evidence({ lane: "quarantine" }), 9);
    writeProducer(root, "windows/performance", evidence({ priority: "P3" }), 9);
    writeProducer(root, "unexpected", evidence({ sourceSha: "b".repeat(40) }), 9);
    const reports = collectNightlySourceCoverage(root, root, source, ["linux", "windows"]);
    expect(reports).toHaveLength(2);
    expect(summarizeCoverage(root, reports)).toEqual({ coveredLines: 1, totalLines: 1 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("each producer needs execution evidence or an explicit empty selection", () => {
  const root = mkdtempSync(join(tmpdir(), "nightly-source-"));
  try {
    writeProducer(root, "valid", evidence());
    mkdirSync(join(root, "empty"));
    expect(() => collectNightlySourceCoverage(root, root, source, ["valid", "empty"])).toThrow(
      "Missing nightly source selection",
    );
    writeFileSync(
      join(root, "empty/selection.json"),
      JSON.stringify({ sourceSha: source, outcome: "success", selectedFiles: [] }),
    );
    writeProducer(root, "no-imports", evidence({ coverage: { file: null, sourceRoot: "repository" } }), 9);
    expect(collectNightlySourceCoverage(root, root, source, ["valid", "empty", "no-imports"])).toHaveLength(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an API aggregate cannot hide a missing selected file's process evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "nightly-api-source-"));
  const apiEvidence = evidence({
    packageDir: "packages/pstdio-api",
    reportedFiles: ["packages/pstdio-api/src/first.p1.test.ts"],
  });
  try {
    writeProducer(root, "api/files/0", apiEvidence);
    rmSync(join(root, "api/files/0/selection.json"));
    writeFileSync(
      join(root, "api/selected.json"),
      JSON.stringify({ files: ["src/first.p1.test.ts", "src/missing.p1.test.ts"] }),
    );
    writeFileSync(
      join(root, "api/results.json"),
      JSON.stringify({
        sourceSha: source,
        outcome: "success",
        complete: true,
        files: ["src/first.p1.test.ts", "src/missing.p1.test.ts"].map((file) => ({
          file,
          outcome: "success",
          report: "present",
          cases: apiEvidence,
        })),
      }),
    );
    expect(() => collectNightlySourceCoverage(root, root, source, ["api"])).toThrow("Missing nightly source execution");
    writeProducer(
      root,
      "api/files/1",
      evidence({
        packageDir: "packages/pstdio-api",
        reportedFiles: ["packages/pstdio-api/src/missing.p1.test.ts"],
      }),
    );
    rmSync(join(root, "api/files/1/selection.json"));
    expect(collectNightlySourceCoverage(root, root, source, ["api"])).toHaveLength(2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stale, failed, partial and uninstrumented source producers cannot publish nightly coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "nightly-source-"));
  try {
    expect(() => collectNightlySourceCoverage(root, root, source, [])).toThrow("No nightly source coverage");
    expect(() => collectNightlySourceCoverage(root, root, source, ["missing"])).toThrow(
      "Missing nightly source producer",
    );
    for (const overrides of [{ sourceSha: "b".repeat(40) }, { complete: false }, { exitCode: 1 }, { coverage: null }]) {
      writeProducer(root, "producer", evidence(overrides));
      expect(() => collectNightlySourceCoverage(root, root, source, ["producer"])).toThrow(
        "Invalid nightly source evidence",
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
