import { type CommandContext, defineCommand, type ExtensionContextBase, l10n, params } from "@pstdio/sdk/extensions";
import { runDeps } from "./context";
import { awaitRun, type RunRecord, readRun } from "./runs";

export const collectRun = defineCommand({
  id: "runs.collect",
  title: l10n("remote-testing.collect-remote-test-result", "Collect remote test result"),
  automation: true,
  params: { runId: params.text({ label: l10n("remote-testing.run-id", "Run ID"), required: true }) },
  async run(ctx, { runId }) {
    await awaitRun(await runDeps(ctx), await readRun(ctx.storage, runId), ctx.signal);
    return { runId };
  },
});

type CollectorJob = NonNullable<Awaited<ReturnType<ExtensionContextBase["automation"]["get"]>>>;
const resumable = (job: CollectorJob) =>
  ["failed", "cancelled", "rejected"].includes(job.status) &&
  (job.status === "cancelled" || job.error?.code === "host_restarted" || job.error?.retryable === true);

export async function startCollection(
  ctx: Pick<ExtensionContextBase, "storage" | "automation">,
  runId: string,
  resumeInterrupted = false,
) {
  const links = ctx.storage.collection<{ jobId: string }>("run-collectors");
  while (true) {
    const current = await links.read(runId);
    // Existing projects used a plain KV link; migrate it when a new job is admitted.
    const priorId = current?.value.jobId ?? (await ctx.storage.get<string>(`collector:${runId}`));
    const prior = priorId ? await ctx.automation.get(priorId) : undefined;
    if (
      prior &&
      (["queued", "running", "succeeded"].includes(prior.status) || (resumeInterrupted && !resumable(prior)))
    )
      return prior.id;
    const job = await ctx.automation.enqueue({
      command: collectRun.ref,
      input: { params: { runId } },
      key: `remote-tests:collect:${runId}:${priorId ?? "first"}`,
    });
    const saved = current
      ? await links.updateIfUnchanged(runId, current.revision, { jobId: job.id })
      : await links.createIfAbsent(runId, { jobId: job.id });
    // New admissions return queued; terminal replies replay an earlier admission.
    const replay = ["failed", "cancelled", "rejected"].includes(job.status);
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
  if (record.summary || record.stopAfterRun === undefined) return;
  try {
    await startCollection(ctx, record.runId, true);
  } catch (error) {
    await Promise.resolve()
      .then(() =>
        ctx.logger.warn(
          `Could not resume collection for run ${record.runId}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      .catch(() => {});
  }
}
