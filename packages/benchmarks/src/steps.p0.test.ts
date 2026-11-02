import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sampleOrder } from "./schedule";
import { sampleSuite } from "./steps";
import type { BenchmarkSuite } from "./suite-types";

test("benchmark steps retain P3 selection and finish independent work after failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchmark-priority-"));
  try {
    const observed = join(root, "environment.json");
    const continued = join(root, "continued.txt");
    const suite: BenchmarkSuite = {
      id: "priority",
      label: "Priority",
      files: [],
      sample: () => [
        {
          command: [
            process.execPath,
            "-e",
            `await Bun.write(${JSON.stringify(observed)},JSON.stringify({priority:process.env.CI_PRIORITY,priorities:process.env.TEST_PRIORITIES}));process.exit(1);`,
          ],
          env: { CI_PRIORITY: "P1", TEST_PRIORITIES: "P1" },
        },
        { command: [process.execPath, "-e", `await Bun.write(${JSON.stringify(continued)},"executed");`] },
      ],
    };
    const context = { root, cacheDir: root, sha: "priority", platform: `${process.platform}-${process.arch}` };
    expect(await sampleSuite(context, suite, join(root, "results.jsonl"))).toBe(false);
    expect(JSON.parse(await readFile(observed, "utf8"))).toEqual({ priority: "P3", priorities: "P3" });
    expect(await readFile(continued, "utf8")).toBe("executed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ten runner samples execute a standalone benchmark ten times without nested repeats", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchmark-sampling-"));
  try {
    const benchmark = join(root, "example.p3.bench.ts");
    const output = join(root, "samples.jsonl");
    const sampling = JSON.stringify(resolve(import.meta.dir, "sampling.ts"));
    const writer = JSON.stringify(resolve(import.meta.dir, "writer.ts"));
    await writeFile(
      benchmark,
      `import { benchmarkSampleCount, benchmarkSampleIndex } from ${sampling};\nimport { recordMeasurement } from ${writer};\nfor (let index = 0; index < benchmarkSampleCount(3); index++) recordMeasurement({metric:"work",label:"Work",unit:"ms",value:benchmarkSampleIndex()+1});\n`,
    );
    const suite: BenchmarkSuite = {
      id: "example",
      label: "Example",
      files: [benchmark],
      sample: (_context, files) => files.map((file) => ({ command: ["bun", file] })),
    };
    const context = { root, cacheDir: root, sha: "example", platform: `${process.platform}-${process.arch}` };
    for (const { sample } of sampleOrder(["example"], 10))
      expect(await sampleSuite(context, suite, output, sample)).toBe(true);
    const measurements = (await readFile(output, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(measurements).toHaveLength(10);
    expect(measurements.map((value) => value.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
