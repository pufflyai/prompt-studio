import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { connectionApi } from "./connection";
import { rememberEnvironmentCleanup } from "./environment-cleanup";
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

export async function recoverLegacyClaims(ctx: LegacyContext) {
  const claims = ctx.storage.collection<Claim>("environment-claims");
  const orphans = new Set<string>();
  for (const claim of await claims.list()) {
    if (claim.legacy) {
      await rememberOrphan(ctx.storage, claim.legacy.environmentId, claim.runId);
    } else if (
      !claim.setup &&
      typeof claim.until === "number" &&
      Number.isFinite(claim.until) &&
      claim.until <= Date.now() &&
      !(await ctx.storage.get(`run:${claim.runId}`))
    ) {
      orphans.add(claim.runId);
    }
  }
  if (!orphans.size || !ctx.connections || !ctx.projectId) return;
  // Inventory supplies keys without interpreting the storage's opaque addresses.
  const inventory = await listEnvironments(connectionApi(ctx.connections), ctx.projectId);
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
