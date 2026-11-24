import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { waitForControllerPoll } from "./connection";
import { enqueueEnvironmentCleanup, rememberEnvironmentCleanup } from "./environment-cleanup";
import { type Claim, durableClaim } from "./environments";
import { readRun } from "./run-store";
import type { RunRecord } from "./runs";

export async function readRunSetup(store: ExtensionStorageApi, record: RunRecord) {
  const claim = await store.collection<Claim>("environment-claims").get(record.environmentId);
  return claim?.runId === record.runId ? claim.setup : undefined;
}

export async function activateEnvironment(store: ExtensionStorageApi, environmentId: string, runId: string) {
  const claims = store.collection<Claim>("environment-claims");
  const current = await claims.read(environmentId);
  if (
    current?.value.runId !== runId ||
    !current.value.setup ||
    current.value.setup.until <= Date.now() ||
    !(await claims.updateIfUnchanged(environmentId, current.revision, durableClaim(runId)))
  )
    throw new Error("Environment setup expired or was recovered before submission.");
}

async function saveSetupFailure(store: ExtensionStorageApi, environmentId: string, runId: string) {
  const recordId = store.records.id(`run:${runId}`);
  while (true) {
    const current = await store.records.read(recordId);
    const run = current.value as unknown as RunRecord;
    if (!current.exists || current.deleted || !run || run.summary || run.environmentId !== environmentId) return;
    const saved = await store.records.commitIfCurrent({
      operationId: crypto.randomUUID(),
      edits: [
        {
          recordId,
          expectedRevision: current.revision,
          set: {
            "/summary": {
              runId,
              environmentId,
              status: "error",
              exitCode: null,
              durationMs: Math.max(0, Date.now() - Date.parse(run.startedAt)),
              logPath: null,
              tail: "",
              error: "Environment setup expired before request submission.",
            },
          },
        },
      ],
    });
    if (saved) return;
  }
}

export async function recoverRunSetup(store: ExtensionStorageApi, environmentId: string, runId: string) {
  const claims = store.collection<Claim>("environment-claims");
  const current = await claims.read(environmentId);
  if (current?.value.runId !== runId || !current.value.setup || current.value.setup.until > Date.now()) return;
  const setup = { ...current.value.setup, until: 0 };
  if (!(await claims.updateIfUnchanged(environmentId, current.revision, { ...current.value, setup }))) return;
  // This exact setup is fenced before local result/cleanup writes. Activation that
  // wins the CAS remains an ordinary admitted run and must never enter this path.
  await saveSetupFailure(store, environmentId, runId);
  await rememberEnvironmentCleanup(store, { environmentId, runId, stop: setup.stop });
}

export async function recoverSetupClaims(ctx: Pick<ExtensionContextBase, "storage">) {
  for (const claim of await ctx.storage.collection<Claim>("environment-claims").list()) {
    if (claim.setup && claim.setup.until <= Date.now())
      await recoverRunSetup(ctx.storage, claim.setup.environmentId, claim.runId);
  }
}

export async function waitForRunSetup(
  ctx: Pick<ExtensionContextBase, "storage" | "automation" | "logger">,
  runId: string,
  signal?: AbortSignal,
) {
  while (true) {
    signal?.throwIfAborted();
    const record = await readRun(ctx.storage, runId);
    const setup = await readRunSetup(ctx.storage, record);
    if (!setup || record.pendingResult) return record;
    if (record.summary) {
      await enqueueEnvironmentCleanup(ctx, { environmentId: record.environmentId, runId, stop: setup.stop }).catch(
        () => {},
      );
      return record;
    }
    await recoverRunSetup(ctx.storage, record.environmentId, runId);
    const latest = await readRun(ctx.storage, runId);
    if (latest.summary || !(await readRunSetup(ctx.storage, latest))) continue;
    await waitForControllerPoll(signal);
  }
}
