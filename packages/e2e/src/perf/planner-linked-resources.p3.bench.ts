import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { benchmarkSampleCount, findBudgetFailures, plannerBudget } from "pstdio-benchmarks";
import { buildBinary } from "../packaged/packaged-helpers";
import { startPackagedServe, stopProcess } from "../packaged/packaged-serve-helpers";
import { measureLinkedResources } from "./planner-linked-resources-browser";
import {
  linkedResourceCount,
  linkedResourcesApi,
  readLinkedFixture,
  seedPackagedLinkedResources,
} from "./planner-linked-resources-fixture";

async function main() {
  if (process.argv.includes("--help")) {
    console.info(`Open a real Tickets board with 200 tickets, 200 Git workspaces, 200 synthetic PRs and 200 builds.
bun run --cwd packages/e2e perf:planner-linked-resources
bun run --cwd packages/e2e perf:planner-linked-resources -- --home <dir>  # keep/reuse the board and screenshots
BENCHMARK_SAMPLES=1 bun run --cwd packages/e2e perf:planner-linked-resources
Uses locally packed SDK/UI packages and the existing ${plannerBudget.value} ms Planner cold-open budget.
Seeding is outside the clock. Each sample restarts the runtime and uses a fresh Chromium browser at 4x CPU throttle.`);
    return;
  }
  buildBinary();
  const homeIndex = process.argv.indexOf("--home");
  const kept = homeIndex >= 0;
  if (kept) assert(process.argv[homeIndex + 1], "--home needs a directory");
  const root = kept ? resolve(process.argv[homeIndex + 1]!) : mkdtempSync(join(tmpdir(), "pstdio-linked-resources-"));
  mkdirSync(root, { recursive: true });
  const evidence = resolve(import.meta.dir, "../../../../__test-tmp__/planner-linked-resources", String(Date.now()));
  mkdirSync(evidence, { recursive: true });
  console.info(`Evidence: ${evidence}`);
  const samples: Awaited<ReturnType<typeof measureLinkedResources>>[] = [];
  let phase = "seeding";
  let result: Record<string, unknown> = {
    tickets: linkedResourceCount,
    workspaces: 200,
    pullRequests: 200,
    builds: 200,
    budgetMs: plannerBudget.value,
    evidence,
    ...(kept ? { home: root } : {}),
  };
  try {
    let fixture = readLinkedFixture(root);
    if (!fixture) {
      const runtime = await startPackagedServe(root, { PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" });
      runtime.child.stdout?.on("data", () => {});
      runtime.child.stderr?.on("data", (data) => process.stderr.write(data));
      try {
        fixture = await seedPackagedLinkedResources(
          linkedResourcesApi(runtime.baseUrl, runtime.descriptor.token),
          root,
          runtime.baseUrl,
          runtime.descriptor.token,
        );
      } finally {
        await stopProcess(runtime.child);
      }
    }
    assert.equal(fixture.tickets.length, linkedResourceCount);
    for (let sample = 0; sample < benchmarkSampleCount(3); sample++) {
      phase = `sample-${sample + 1}`;
      const runtime = await startPackagedServe(root, { PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" });
      runtime.child.stdout?.on("data", () => {});
      runtime.child.stderr?.on("data", (data) => process.stderr.write(data));
      const sampleEvidence = join(evidence, `sample-${sample + 1}`);
      mkdirSync(sampleEvidence);
      try {
        const measured = await measureLinkedResources(
          runtime.baseUrl,
          runtime.descriptor.token,
          fixture,
          sampleEvidence,
        );
        samples.push(measured);
      } finally {
        await stopProcess(runtime.child);
      }
    }
    phase = "budget";
    const failures = findBudgetFailures(
      samples.map((sample) => ({
        name: "Planner linked resources cold open",
        unit: "ms" as const,
        value: sample.readyMs,
        budget: plannerBudget.value,
      })),
    );
    result = { ...result, status: failures.length ? "failed" : "passed", samples, failures };
    writeFileSync(join(evidence, "results.json"), JSON.stringify(result, null, 2));
    console.info(JSON.stringify(result, null, 2));
    assert.deepEqual(failures, []);
  } catch (error) {
    writeFileSync(
      join(evidence, "results.json"),
      JSON.stringify(
        { ...result, status: "failed", phase, samples, error: error instanceof Error ? error.stack : String(error) },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    if (!kept) rmSync(root, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
