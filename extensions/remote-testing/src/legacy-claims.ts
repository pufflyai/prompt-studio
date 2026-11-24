import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { connectionApi } from "./connection";
import { hasEnvironmentCleanup, rememberEnvironmentCleanup } from "./environment-cleanup";
import { type Claim, durableClaim, listEnvironments } from "./environments";
import type { RunRecord } from "./runs";

type LegacyContext = Pick<ExtensionContextBase, "storage" | "logger"> &
  Partial<Pick<ExtensionContextBase, "connections" | "projectId">>;

export async function handoffLegacyRun(store: ExtensionStorageApi, environmentId: string, runId: string) {
  const run = await store.get<RunRecord>(`run:${runId}`);
  if (!run || run.environmentId !== environmentId) return false;
  const claims = store.collection<Claim>("environment-claims");
  while (true) {
    const current = await claims.read(environmentId);
    if (current?.value.runId !== runId || !current.value.legacy) return true;
    if (await claims.updateIfUnchanged(environmentId, current.revision, durableClaim(runId))) return true;
  }
}

async function rememberOrphan(store: ExtensionStorageApi, environmentId: string, runId: string) {
  if (await handoffLegacyRun(store, environmentId, runId)) return;
  await rememberEnvironmentCleanup(store, { environmentId, runId, stop: true, orphan: true });
}

function expiredLease(claim: Claim) {
  return (
    !claim.setup &&
    !claim.legacy &&
    typeof claim.until === "number" &&
    Number.isFinite(claim.until) &&
    claim.until <= Date.now()
  );
}

async function reconcileTerminalClaim(store: ExtensionStorageApi, claim: Claim, run: RunRecord) {
  const summary = run.summary;
  // The old collector persisted logs only after a finalized receipt. Logged
  // errors therefore prove completion; launch errors (no log) and synthetic
  // deadlines still cannot prove that accepted work has stopped.
  if (
    run.runId !== claim.runId ||
    run.pendingResult ||
    run.submissionPending ||
    !summary ||
    summary.runId !== run.runId ||
    summary.environmentId !== run.environmentId ||
    (!["passed", "failed", "canceled", "timed_out"].includes(summary.status) &&
      !(summary.status === "error" && summary.logPath)) ||
    (summary.status === "timed_out" && summary.error)
  )
    return;
  const claims = store.collection<Claim>("environment-claims");
  const current = await claims.read(run.environmentId);
  if (!current || current.value.runId !== claim.runId || !expiredLease(current.value)) return;
  const cleanup = { environmentId: run.environmentId, runId: run.runId, stop: true };
  if (await hasEnvironmentCleanup(store, cleanup)) return;
  if (run.stopAfterRun) await rememberEnvironmentCleanup(store, cleanup);
  else await claims.deleteIfValue(run.environmentId, current.value);
}

export async function recoverLegacyClaims(ctx: LegacyContext) {
  const claims = ctx.storage.collection<Claim>("environment-claims");
  const orphans = new Set<string>();
  for (const claim of await claims.list()) {
    if (claim.legacy) {
      await rememberOrphan(ctx.storage, claim.legacy.environmentId, claim.runId);
    } else if (expiredLease(claim)) {
      const run = await ctx.storage.get<RunRecord>(`run:${claim.runId}`);
      if (run) await reconcileTerminalClaim(ctx.storage, claim, run);
      else orphans.add(claim.runId);
    }
  }
  if (!orphans.size || !ctx.connections || !ctx.projectId) return;
  // Inventory supplies keys without interpreting the storage's opaque addresses.
  const inventory = await listEnvironments(connectionApi(ctx.connections), ctx.projectId, true);
  for (const environment of inventory) {
    const current = await claims.read(environment.id);
    if (
      !current ||
      !orphans.has(current.value.runId) ||
      current.value.setup ||
      current.value.legacy ||
      typeof current.value.until !== "number" ||
      current.value.until > Date.now()
    )
      continue;
    if (await ctx.storage.get(`run:${current.value.runId}`)) continue;
    const fenced = { ...durableClaim(current.value.runId), legacy: { environmentId: environment.id } };
    if (!(await claims.updateIfUnchanged(environment.id, current.revision, fenced))) continue;
    await rememberOrphan(ctx.storage, environment.id, current.value.runId);
  }
}
