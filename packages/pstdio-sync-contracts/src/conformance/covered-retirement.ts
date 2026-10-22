import type { Scope } from "../wire";
import {
  type CoveredState,
  type CoveredTransaction,
  recoveryAssets,
  requiredAssets,
  retainedClosure,
  safeCoverage,
  settledCuts,
} from "./covered-state";
import type { TestObjects } from "./objects";

function retireWriter(
  state: CoveredState,
  environmentId: string,
  cut: number,
  protectedKeys: Set<string>,
  settled: Map<string, number>,
) {
  const writer = state.writers[environmentId];
  let next = writer.floor + 1;
  while (true) {
    const key = `${environmentId}:${next}`;
    const settledAt = settled.get(key);
    if (settledAt === undefined || settledAt > cut || protectedKeys.has(key)) break;
    delete state.receipts[key];
    writer.floor = next++;
  }
}
function retire(state: CoveredState) {
  const coverage = safeCoverage(state);
  if (state.barrier) {
    coverage.cut = state.covered;
    coverage.blockers.push("document-barrier");
  }
  if (coverage.cut <= state.covered) return coverage;
  const protectedKeys = retainedClosure(state);
  const settled = settledCuts(state);
  for (const environmentId of Object.keys(state.writers))
    retireWriter(state, environmentId, coverage.cut, protectedKeys, settled);
  for (const [id, conflict] of Object.entries(state.conflicts))
    if (
      conflict.resolvedBy &&
      !state.receipts[conflict.resolvedBy] &&
      conflict.alternativeOperationIds.every((key) => !state.receipts[key])
    )
      delete state.conflicts[id];
  state.covered = coverage.cut;
  state.generation++;
  return coverage;
}
export async function compactCovered(
  transaction: CoveredTransaction,
  objects: TestObjects,
  scope: Scope,
  fault?: string,
  afterRetirement?: () => Promise<void>,
) {
  const coverage = await transaction(scope, async (state) => retire(state));
  await afterRetirement?.();
  await transaction(scope, async (state) => {
    // Every uncovered receipt remains a recovery root, even after its current asset is replaced.
    const roots = new Set(
      [...requiredAssets(state), ...recoveryAssets(state), ...Object.values(state.pins).flat()].map(
        (asset) => asset.sha256,
      ),
    );
    for (const asset of state.assets.filter((asset) => !roots.has(asset.sha256))) {
      if (fault === "before-delete") throw new Error("before delete");
      await objects.remove(scope, asset);
      if (fault === "after-delete") throw new Error("after delete");
    }
    state.assets = state.assets.filter((asset) => roots.has(asset.sha256));
  });
  return coverage;
}
