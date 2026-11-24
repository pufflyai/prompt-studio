import { type CommandContext, defineCommand, type ExtensionContextBase, l10n, params } from "@pstdio/sdk/extensions";
import { readSavedLog, runDeps } from "./context";
import { resumeEnvironmentCleanups } from "./environment-cleanup";
import { changed } from "./events";
import { RecoveryBudgetExhausted, recoveryCursor } from "./recovery-budget";
import { finishPendingResult, prepareResultStorage } from "./result-persistence";
import { unfinishedRuns } from "./run-recovery";
import { awaitRun, type RunRecord, readRun } from "./runs";
import { readRunSetup, waitForRunSetup } from "./setup-claims";

export const collectRun = defineCommand({
  id: "runs.collect",
  title: l10n("remote-testing.collect-remote-test-result", "Collect remote test result"),
  automation: true,
  params: { runId: params.text({ label: l10n("remote-testing.run-id", "Run ID"), required: true }) },
  async run(ctx, { runId }) {
    const record = await prepareResultStorage(() => waitForRunSetup(ctx, runId, ctx.signal), ctx.signal);
    if (record.pendingResult) {
      await finishPendingResult(
        {
          store: ctx.storage,
          readSavedLog: (id) => readSavedLog(ctx, id),
          changed: () => ctx.events.emit(changed, {}),
        },
        record,
      );
      await resumeEnvironmentCleanups(ctx).catch((error) =>
        Promise.resolve()
          .then(() =>
            ctx.logger.warn(`Result saved; background recovery admission failed for ${runId}: ${String(error)}`),
          )
          .catch(() => {}),
      );
    } else if (!record.summary) await awaitRun(await runDeps(ctx), record, ctx.signal);
    return { runId };
  },
});

type CollectorJob = NonNullable<Awaited<ReturnType<ExtensionContextBase["automation"]["get"]>>>;
const resumable = (job: CollectorJob) =>
  ["failed", "cancelled", "rejected"].includes(job.status) &&
  (job.status === "cancelled" || job.error?.code === "host_restarted" || job.error?.retryable === true);

function keepCollector(job: CollectorJob | undefined, resumeInterrupted: boolean, recoverSavedResult: boolean) {
  if (!job) return false;
  if (["queued", "running"].includes(job.status)) return true;
  if (!recoverSavedResult && job.status === "succeeded") return true;
  return resumeInterrupted && !resumable(job);
}

export async function startCollection(
  ctx: Pick<ExtensionContextBase, "storage" | "automation">,
  runId: string,
  resumeInterrupted = false,
  recoverSavedResult = false,
) {
  const links = ctx.storage.collection<{ jobId: string }>("run-collectors");
  while (true) {
    const record = await readRun(ctx.storage, runId);
    if (!record.summary && !record.pendingResult && (await readRunSetup(ctx.storage, record)))
      throw new Error("Run setup is still in progress. Wait with runs show before collecting it.");
    const current = await links.read(runId);
    // Existing projects used a plain KV link; migrate it when a new job is admitted.
    const priorId = current?.value.jobId ?? (await ctx.storage.get<string>(`collector:${runId}`));
    const prior = priorId ? await ctx.automation.get(priorId) : undefined;
    if (keepCollector(prior, resumeInterrupted, recoverSavedResult)) return prior!.id;
    const job = await ctx.automation.enqueue({
      command: collectRun.ref,
      input: { params: { runId } },
      key: `remote-tests:collect:${runId}:${priorId ?? "first"}`,
    });
    const saved = current
      ? await links.updateIfUnchanged(runId, current.revision, { jobId: job.id })
      : await links.createIfAbsent(runId, { jobId: job.id });
    // New admissions return queued; terminal replies replay an earlier admission.
    const replay =
      ["failed", "cancelled", "rejected"].includes(job.status) || (recoverSavedResult && job.status === "succeeded");
    if (!saved || (resumeInterrupted ? resumable(job) : replay)) continue;
    return job.id;
  }
}

export async function waitForCollection(ctx: CommandContext, runId: string, jobId: string) {
  while (true) {
    ctx.signal.throwIfAborted();
    const job = await ctx.automation.get(jobId);
    if (!job) throw new Error("The remote test collector is unavailable.");
    if (job.status === "succeeded") {
      const result = (await readRun(ctx.storage, runId)).summary;
      if (!result) throw new Error("The remote test collector did not save a result.");
      return result;
    }
    if (job.status !== "queued" && job.status !== "running")
      throw new Error(job.error?.message ?? `Could not collect the remote test result. Status ${job.status}.`);
    await Bun.sleep(1000);
  }
}

export async function resumeCollection(
  ctx: Pick<ExtensionContextBase, "storage" | "automation" | "logger">,
  record: RunRecord,
) {
  if (!record.pendingResult && (record.summary || record.stopAfterRun === undefined)) return true;
  if (await readRunSetup(ctx.storage, record)) return true;
  try {
    await startCollection(ctx, record.runId, !record.pendingResult, Boolean(record.pendingResult));
  } catch (error) {
    if (error instanceof RecoveryBudgetExhausted) return false;
    await Promise.resolve()
      .then(() =>
        ctx.logger.warn(
          `Could not resume collection for run ${record.runId}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      .catch(() => {});
  }
  return true;
}

export async function resumeUnfinishedCollection(ctx: Pick<ExtensionContextBase, "storage" | "automation" | "logger">) {
  const cursor = await recoveryCursor(ctx.storage, "collector");
  for await (const record of unfinishedRuns(ctx.storage, cursor)) if (!(await resumeCollection(ctx, record))) return;
  if (cursor)
    for await (const record of unfinishedRuns(ctx.storage, undefined, cursor))
      if (!(await resumeCollection(ctx, record))) return;
}
