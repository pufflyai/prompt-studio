/**
 * Quarantine-growth gate.
 *
 * Fails CI if the UI Playwright quarantine list in `packages/e2e/src/quarantine.ts`
 * has grown beyond the baseline in `packages/e2e/quarantine-baseline.json`.
 *
 * Quarantine should only shrink — every ported dashboard surface re-enables
 * one or more quarantined specs as part of its definition of done.
 * See .pstdio/docs/contributing/tests.md for the quarantine policy.
 *
 * The source quarantine module is read as text rather than imported so that
 * `pstdio-scripts` does not need a runtime dependency on `e2e`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const QUARANTINE_PATH = path.join(ROOT, "packages/e2e/src/quarantine.ts");
const BASELINE_PATH = path.join(ROOT, "packages/e2e/quarantine-baseline.json");
const EXPORT_NAME = "QUARANTINED_WORKBENCH_MIGRATION_SPECS";

interface Baseline {
  specs: string[];
}

function parseQuarantineList() {
  const source = readFileSync(QUARANTINE_PATH, "utf8");
  const arrayMatch = source.match(new RegExp(`export const ${EXPORT_NAME}[^=]*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!arrayMatch?.[1]) {
    throw new Error(`Could not find ${EXPORT_NAME} array in ${QUARANTINE_PATH}`);
  }
  const body = arrayMatch[1];
  const entries = [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1] as string);
  if (entries.length === 0) {
    throw new Error(`${EXPORT_NAME} parsed to an empty list — check the source file`);
  }
  return entries;
}

function readBaseline() {
  const raw = readFileSync(BASELINE_PATH, "utf8");
  const parsed = JSON.parse(raw) as Baseline;
  if (!Array.isArray(parsed.specs)) {
    throw new Error(`Invalid baseline at ${BASELINE_PATH}: expected { specs: string[] }`);
  }
  return parsed.specs;
}

function diff(current: string[], baseline: string[]) {
  const baselineSet = new Set(baseline);
  const currentSet = new Set(current);

  const added = current.filter((spec) => !baselineSet.has(spec));
  const removed = baseline.filter((spec) => !currentSet.has(spec));

  return { added, removed };
}

function main() {
  const current = parseQuarantineList().sort();
  const baseline = readBaseline().sort();

  const { added, removed } = diff(current, baseline);

  if (added.length > 0) {
    console.error("✗ quarantine-growth gate failed");
    console.error("");
    console.error("The following specs were added to the quarantine list in");
    console.error("packages/e2e/src/quarantine.ts but are not present in the baseline");
    console.error("packages/e2e/quarantine-baseline.json:");
    console.error("");
    for (const spec of added) console.error(`  + ${spec}`);
    console.error("");
    console.error("Quarantine should only shrink. If you are intentionally widening");
    console.error("quarantine, document the reason in your PR and update the baseline");
    console.error("in the same change.");
    process.exit(1);
  }

  if (removed.length > 0) {
    console.log(`✓ quarantine-growth gate passed (current: ${current.length}, baseline: ${baseline.length})`);
    console.log("");
    console.log("The following specs were removed from quarantine — please drop them");
    console.log("from packages/e2e/quarantine-baseline.json so the baseline tracks reality:");
    console.log("");
    for (const spec of removed) console.log(`  - ${spec}`);
    return;
  }

  console.log(`✓ quarantine-growth gate passed (${current.length} specs quarantined, unchanged)`);
}

main();
