import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findBudgetFailures, legacyConversionMacrotaskBudget } from "pstdio-benchmarks";

const root = mkdtempSync(join(tmpdir(), "legacy-backlog-benchmark-"));
const fixture = join(import.meta.dir, "ordered-legacy-backlog.fixture.ts");
const start = (mode: string) =>
  Bun.spawn([process.execPath, fixture, mode, join(root, "db")], { stdout: "pipe", stderr: "inherit" });
const run = async (mode: string) => {
  const child = start(mode);
  try {
    const output = await new Response(child.stdout).text();
    assert.equal(await child.exited, 0, output);
    console.log(output.trim());
    return output
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  } finally {
    child.kill();
    await child.exited;
  }
};

try {
  await run("seed");
  const interrupted = start("interrupt");
  let checkpoint: { checkpoint: { phase: string; after: string }; firstVersion: string } | undefined;
  try {
    let output = "";
    for await (const chunk of interrupted.stdout) {
      output += new TextDecoder().decode(chunk);
      if (!output.includes("\n")) continue;
      const lines = output.split("\n");
      output = lines.pop()!;
      for (const line of lines) {
        const message = JSON.parse(line);
        if (message.checkpoint) checkpoint = message;
      }
      if (checkpoint) break;
    }
    assert.equal(checkpoint?.checkpoint.phase, "records");
    assert.ok(checkpoint?.checkpoint.after);
    console.log(JSON.stringify({ killedAfter: checkpoint }));
  } finally {
    interrupted.kill("SIGKILL");
    await interrupted.exited;
  }

  const result = (await run("convert")).at(-1)!;
  // An unchanged xmin proves that the completed record batch was not imported again.
  assert.equal(result.firstVersion, checkpoint!.firstVersion);
  assert.equal(result.completed, true);
  assert.equal(result.unrelatedDuring, true);
  assert.ok(result.turns > 0);
  assert.deepEqual(result.counts, {
    records: 20_000,
    operations: 80_000,
    legacy: 80_000,
    projects: 1,
    projected: 60_000,
    tombstones: 48_000,
  });
  const measurement = {
    metric: "legacy-conversion-macrotask-gap",
    label: "Legacy conversion largest macrotask gap",
    unit: "ms" as const,
    value: result.maxGap,
    budget: legacyConversionMacrotaskBudget.value,
  };
  const failures = findBudgetFailures([{ name: measurement.label, ...measurement }]);
  assert.deepEqual(failures, []);
} finally {
  rmSync(root, { recursive: true, force: true });
}
