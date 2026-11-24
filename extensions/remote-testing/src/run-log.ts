import { setTimeout as delay } from "node:timers/promises";
import {
  defineCommand,
  type ExtensionContextBase,
  type ExtensionStorageApi,
  l10n,
  params,
} from "@pstdio/sdk/extensions";
import { runDeps } from "./context";
import { changed } from "./events";
import { RecoveryBudgetExhausted, recoveryOrder } from "./recovery-budget";
import { collectLog } from "./run-result";
import { readRun } from "./run-store";
import type { RunCollectionDeps, RunRecord } from "./runs";

type LogIntent = { runId: string; jobId?: string; missingUntil?: number };
const intents = (store: ExtensionStorageApi) => store.collection<LogIntent>("pending-run-logs");
export async function rememberRunLog(store: ExtensionStorageApi, runId: string, waitForUpload = false) {
  await intents(store).createIfAbsent(runId, {
    runId,
    ...(waitForUpload ? { missingUntil: Date.now() + 30_000 } : {}),
  });
}

export async function collectSavedRunLog(deps: RunCollectionDeps, runId: string, signal?: AbortSignal) {
  const initial = await readRun(deps.store, runId);
  if (!initial.summary) throw new Error("Save the test result before collecting its log.");
  let log = initial.summary.logPath ? { logPath: null, tail: "" } : await collectLog(deps, runId, signal, true);
  const deadline = (await intents(deps.store).get(runId))?.missingUntil ?? 0;
  while (!initial.summary.logPath && !log.logPath && Date.now() < deadline) {
    await delay(Math.min(3000, deadline - Date.now()), undefined, { signal });
    log = await collectLog(deps, runId, signal, true);
  }
  // Cleanup can already have released the workspace. Only enrich the saved result.
  const recordId = deps.store.records.id(`run:${runId}`);
  while (log.logPath) {
    const current = await deps.store.records.read(recordId);
    const record = current.value as unknown as RunRecord;
    if (current.deleted || !record?.summary || record.summary.logPath) break;
    const saved = await deps.store.records.commitIfCurrent({
      operationId: crypto.randomUUID(),
      edits: [
        {
          recordId,
          expectedRevision: current.revision,
          set: { "/summary/logPath": log.logPath, "/summary/tail": log.tail },
        },
      ],
    });
    if (saved) break;
  }
  const intent = await intents(deps.store).get(runId);
  if (intent) await intents(deps.store).deleteIfValue(runId, intent);
}

export const collectRunLog = defineCommand({
  id: "runs.collect-log",
  title: l10n("remote-testing.collect-remote-test-result", "Collect remote test result"),
  automation: true,
  mutating: true,
  params: { runId: params.text({ label: l10n("remote-testing.run-id", "Run ID"), required: true }) },
  async run(ctx, { runId }) {
    await collectSavedRunLog(await runDeps(ctx), runId, ctx.signal);
    await Promise.resolve()
      .then(() => ctx.events.emit(changed, {}))
      .catch(() => {});
    return { runId };
  },
});

type LogContext = Pick<ExtensionContextBase, "automation" | "storage" | "logger">;
type Job = NonNullable<Awaited<ReturnType<LogContext["automation"]["get"]>>>;
const incomplete = (job: Job) => !["queued", "running"].includes(job.status);

export async function enqueueRunLog(ctx: LogContext, runId: string) {
  await rememberRunLog(ctx.storage, runId);
  const pending = intents(ctx.storage);
  while (true) {
    const current = await pending.read(runId);
    if (!current || !(await readRun(ctx.storage, runId)).summary) return;
    const priorId = current.value.jobId;
    const prior = priorId ? await ctx.automation.get(priorId) : undefined;
    if (prior && !incomplete(prior)) return;
    const job = await ctx.automation.enqueue({
      command: collectRunLog.ref,
      input: { params: { runId } },
      key: `remote-tests:log:${runId}:${priorId ?? "first"}`,
    });
    if (
      !(await pending.updateIfUnchanged(runId, current.revision, { ...current.value, jobId: job.id })) ||
      incomplete(job)
    )
      continue;
    return;
  }
}

export async function resumeRunLogs(ctx: LogContext) {
  for (const intent of await recoveryOrder(
    ctx.storage,
    "log",
    await intents(ctx.storage).list(),
    (item) => item.runId,
  )) {
    try {
      await enqueueRunLog(ctx, intent.runId);
    } catch (error) {
      if (error instanceof RecoveryBudgetExhausted) break;
      ctx.logger.error(`Could not collect log for run ${intent.runId}: ${String(error)}`);
    }
  }
}
