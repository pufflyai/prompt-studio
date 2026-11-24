import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { rememberEnvironmentCleanup } from "./environment-cleanup";
import type { Claim } from "./environments";
import type { RunRecord } from "./runs";

export async function activateEnvironment(store: ExtensionStorageApi, environmentId: string, runId: string) {
  const claims = store.collection<Claim>("environment-claims");
  const current = await claims.read(environmentId);
  if (
    current?.value.runId !== runId ||
    !current.value.setup ||
    current.value.setup.until <= Date.now() ||
    !(await claims.updateIfUnchanged(environmentId, current.revision, { runId }))
  )
    throw new Error("Environment setup expired or was recovered before submission.");
}

export async function recoverSetupClaims(ctx: Pick<ExtensionContextBase, "storage" | "automation" | "logger">) {
  const claims = ctx.storage.collection<Claim>("environment-claims");
  for (const claim of await claims.list()) {
    if (!claim.setup || claim.setup.until > Date.now()) continue;
    const environmentId = claim.setup.environmentId;
    const current = await claims.read(environmentId);
    if (!current?.value.setup || current.value.setup.until > Date.now()) continue;
    const setup = { ...current.value.setup, until: 0 };
    if (!(await claims.updateIfUnchanged(environmentId, current.revision, { ...current.value, setup }))) continue;
    // The expired marker remains recoverable even if the host exits before enqueue.
    const run = await ctx.storage.get<RunRecord>(`run:${current.value.runId}`);
    if (run && !run.summary)
      await ctx.storage.set(`run:${current.value.runId}`, {
        ...run,
        summary: {
          runId: run.runId,
          environmentId,
          status: "error",
          exitCode: null,
          durationMs: Math.max(0, Date.now() - Date.parse(run.startedAt)),
          logPath: null,
          tail: "",
          error: "Environment setup expired before request submission.",
        },
      });
    await rememberEnvironmentCleanup(ctx.storage, { environmentId, runId: current.value.runId, stop: setup.stop });
  }
}
