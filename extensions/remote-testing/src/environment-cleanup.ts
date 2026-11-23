import {
  defineCommand,
  type ExtensionContextBase,
  type ExtensionStorageApi,
  l10n,
  params,
} from "@pstdio/sdk/extensions";
import { type Api, canRetryControllerRequest, connectionApi, waitForControllerPoll } from "./connection";
import { releaseEnvironment, renewEnvironmentClaim, stopEnvironment } from "./environments";
import { changed } from "./events";

export interface EnvironmentCleanupInput {
  environmentId: string;
  runId: string;
  stop: boolean;
}
type CleanupIntent = EnvironmentCleanupInput & { jobId?: string };
const cleanupId = (input: EnvironmentCleanupInput) => `${input.runId}:${input.environmentId}`;
const cleanupIntents = (store: ExtensionStorageApi) => store.collection<CleanupIntent>("environment-cleanups");

async function forgetCleanup(store: ExtensionStorageApi, input: EnvironmentCleanupInput) {
  const intents = cleanupIntents(store);
  const current = await intents.get(cleanupId(input));
  if (current) await intents.deleteIfValue(cleanupId(input), current);
}

export async function cleanupRunEnvironment(
  deps: { api: Api; store: ExtensionStorageApi },
  input: EnvironmentCleanupInput,
  signal?: AbortSignal,
) {
  // Keep ownership through the remote stop, even when a queued job starts after the original lease expired.
  while (true) {
    signal?.throwIfAborted();
    if (!(await renewEnvironmentClaim(deps.store, input.environmentId, input.runId, 1800))) return { stopped: false };
    if (!input.stop) break;
    try {
      await stopEnvironment(deps.api, input.environmentId, signal);
      break;
    } catch (error) {
      signal?.throwIfAborted();
      if (!canRetryControllerRequest(error)) throw error;
    }
    await waitForControllerPoll(signal);
  }
  await releaseEnvironment(deps.store, input.environmentId, input.runId);
  return { stopped: input.stop };
}

export const cleanupEnvironmentCommand = defineCommand({
  id: "environments.cleanup-run",
  title: l10n("remote-testing.stop-test-environment", "Stop test environment"),
  automation: true,
  mutating: true,
  params: {
    environmentId: params.text({ label: l10n("remote-testing.environment-id", "Environment ID"), required: true }),
    runId: params.text({ label: l10n("remote-testing.run-id", "Run ID"), required: true }),
    stop: params.boolean({
      label: l10n("remote-testing.stop-test-environment", "Stop test environment"),
      default: false,
    }),
  },
  async run(ctx, input) {
    const result = await cleanupRunEnvironment(
      { api: connectionApi(ctx.connections), store: ctx.storage },
      {
        ...input,
        stop: input.stop === true,
      },
      ctx.signal,
    );
    await forgetCleanup(ctx.storage, { ...input, stop: input.stop === true });
    await Promise.resolve()
      .then(() => ctx.events.emit(changed, {}))
      .catch(() => {});
    return result;
  },
});

export async function enqueueEnvironmentCleanup(
  ctx: Pick<ExtensionContextBase, "automation" | "logger" | "storage">,
  input: EnvironmentCleanupInput,
) {
  try {
    // This atomic write is not a cancelled read. Persist before admission so both
    // a lost queue reply and a restart before the worker body can be recovered.
    await cleanupIntents(ctx.storage).createIfAbsent(cleanupId(input), { ...input });
    await ctx.automation.enqueue({
      command: cleanupEnvironmentCommand.ref,
      input: { params: { ...input } },
      key: `remote-tests:cleanup:${input.runId}:${input.environmentId}:first`,
    });
  } catch (error) {
    reportCleanupQueueError(ctx, input, error);
    throw error;
  }
}

function reportCleanupQueueError(
  ctx: Pick<ExtensionContextBase, "logger">,
  input: EnvironmentCleanupInput,
  error: unknown,
) {
  try {
    ctx.logger.error(
      `Could not queue cleanup for environment ${input.environmentId} (run ${input.runId}): ${error instanceof Error ? error.message : String(error)}`,
    );
  } catch {}
}

type CleanupJob = NonNullable<Awaited<ReturnType<ExtensionContextBase["automation"]["get"]>>>;
const resumableCleanup = (job: CleanupJob) =>
  ["failed", "cancelled", "rejected"].includes(job.status) &&
  (job.status === "cancelled" || job.error?.code === "host_restarted" || job.error?.retryable === true);
const keepCleanupJob = (job: CleanupJob | undefined) => job && !resumableCleanup(job);

async function resumeCleanup(ctx: Pick<ExtensionContextBase, "automation" | "storage">, id: string) {
  const intents = cleanupIntents(ctx.storage);
  while (true) {
    const current = await intents.read(id);
    if (!current) return;
    const { environmentId, runId, stop, jobId: priorId } = current.value;
    const claim = await ctx.storage.collection<{ runId: string }>("environment-claims").get(environmentId);
    if (claim?.runId !== runId) {
      await intents.deleteIfValue(id, current.value);
      return;
    }
    const prior = priorId ? await ctx.automation.get(priorId) : undefined;
    if (keepCleanupJob(prior)) return;
    const job = await ctx.automation.enqueue({
      command: cleanupEnvironmentCommand.ref,
      input: { params: { environmentId, runId, stop } },
      key: `remote-tests:cleanup:${runId}:${environmentId}:${priorId ?? "first"}`,
    });
    const saved = await intents.updateIfUnchanged(id, current.revision, { ...current.value, jobId: job.id });
    if (!saved || resumableCleanup(job)) continue;
    return;
  }
}

export async function resumeEnvironmentCleanups(ctx: Pick<ExtensionContextBase, "automation" | "logger" | "storage">) {
  for (const intent of await cleanupIntents(ctx.storage).list()) {
    await resumeCleanup(ctx, cleanupId(intent)).catch((error) => reportCleanupQueueError(ctx, intent, error));
  }
}

export const recoverEnvironmentCleanup = defineCommand({
  id: "environments.resume-cleanup",
  title: l10n("remote-testing.resume-environment-cleanup", "Resume environment cleanup"),
  automation: true,
  mutating: true,
  async run(ctx) {
    await resumeEnvironmentCleanups(ctx);
    return { checked: true };
  },
});
