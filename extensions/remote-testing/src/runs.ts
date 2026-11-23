import type { ExtensionProcessApi, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { BranchKind, BranchSource, TemplateRef } from "./branch-templates";
import { type Api, canRetryControllerRequest, waitForControllerPoll } from "./connection";
import type { EnvironmentCleanupInput } from "./environment-cleanup";
import {
  claimEnvironment,
  createEnvironment,
  readEnvironment,
  releaseEnvironment,
  renewEnvironmentClaim,
  stopEnvironment,
  waitUntilReady,
} from "./environments";
import { readRunReceipt, runDeadline, TRANSFER_ALLOWANCE_SECONDS } from "./run-deadline";
import { type Receipt, summarize, timeoutReceipt } from "./run-result";
import type { Settings } from "./settings";
import { withSourceArchive } from "./source";
import type { RunStorage } from "./storage";

export interface RunDeps {
  projectId: string;
  api: Api;
  cleanupEnvironment(input: EnvironmentCleanupInput): Promise<void>;
  publishTemplate?(kind: BranchKind, source: BranchSource, signal?: AbortSignal): Promise<TemplateRef>;
  storage: RunStorage;
  store: ExtensionStorageApi;
  process: ExtensionProcessApi;
  settings: Settings;
  saveLog(runId: string, text: string): Promise<string>;
  /** Tells open views that a run or environment changed. */
  changed?(): Promise<unknown>;
}

export type RunCollectionDeps = Pick<RunDeps, "api" | "store" | "saveLog" | "changed"> & {
  storage: Pick<RunStorage, "download">;
};

export interface RunRecord {
  runId: string;
  environmentId: string;
  requestId: string;
  conversationId: string;
  command: string;
  root: string;
  startedAt: string;
  timeoutSeconds: number;
  stopAfterRun?: boolean;
  /** The Prompt Studio session whose agent started the run, when one did. */
  sessionId?: string;
  summary?: RunSummary;
  template?: TemplateRef;
}

export interface RunSummary {
  runId: string;
  environmentId: string;
  status: "passed" | "failed" | "timed_out" | "canceled" | "error";
  exitCode: number | null;
  durationMs: number;
  logPath: string | null;
  tail: string;
  error?: string;
}

const sources = (runId: string) => `sources/${runId}.tar.gz`;
const logs = (runId: string) => `logs/${runId}.log`;

const notifyRunChange = (deps: Pick<RunDeps, "changed">) =>
  Promise.resolve()
    .then(() => deps.changed?.())
    .catch(() => {});

async function saveSubmissionFailure(deps: RunDeps, record: RunRecord | undefined, error: unknown) {
  if (!record) return;
  const summary: RunSummary = {
    runId: record.runId,
    environmentId: record.environmentId,
    status: "error",
    exitCode: null,
    durationMs: Math.max(0, Date.now() - Date.parse(record.startedAt)),
    logPath: null,
    tail: "",
    error: error instanceof Error ? error.message : String(error),
  };
  await deps.store.set(`run:${record.runId}`, { ...record, summary });
}

export async function startRun(
  deps: RunDeps,
  input: {
    root: string;
    command?: string;
    environmentId?: string;
    timeoutMinutes?: number;
    sessionId?: string;
    keepEnvironment?: boolean;
    ref?: string;
    kind?: BranchKind;
    branchTemplate?: boolean;
  },
  signal?: AbortSignal,
) {
  const runId = crypto.randomUUID();
  const command = input.command?.trim() || deps.settings.testCommand;
  const timeoutSeconds = Math.round((input.timeoutMinutes ?? deps.settings.timeoutMinutes) * 60);
  const kind = input.kind ?? "tests";
  const publish = kind === "preview" || input.branchTemplate || input.ref !== undefined;
  if (publish && input.environmentId) throw new Error("A branch template needs a new environment.");
  const { template, revision, sha256, files, bytes } = await withSourceArchive(
    deps.process,
    input.root,
    input.ref,
    async (source) => {
      const template = publish ? await deps.publishTemplate?.(kind, source, signal) : undefined;
      if (publish && !template) throw new Error("Branch template publishing is unavailable.");
      await deps.storage.upload(sources(runId), source.archive);
      return {
        template,
        revision: source.revision,
        sha256: source.sha256,
        files: source.files,
        bytes: source.archive.size,
      };
    },
  );

  const environment = template
    ? await createEnvironment(
        deps.api,
        { ...deps.settings, templateName: template.name, templateVersion: template.version },
        signal,
        {
          pstdio_project_id: deps.projectId,
          purpose: kind === "preview" ? "pstdio-preview" : "remote-testing",
          revision,
          source_sha256: sha256,
        },
      )
    : await pickEnvironment(deps, runId, timeoutSeconds, input.environmentId, signal);
  let ownsEnvironment = !template;
  let record: RunRecord | undefined;
  try {
    if (template) {
      ownsEnvironment = await claimEnvironment(deps.store, environment.id, runId, timeoutSeconds + 1800);
      if (!ownsEnvironment) throw new Error(`Environment ${environment.id} is running another test run.`);
    }
    const ready = await waitUntilReady(deps.api, environment, signal);
    // The source URL must outlive a cold start; the log URL must outlive the run.
    const message = JSON.stringify({
      type: "pocketcoder.remote-test/v1",
      runId,
      source: { url: await deps.storage.signedUrl("GET", sources(runId), TRANSFER_ALLOWANCE_SECONDS), sha256 },
      command,
      timeoutSeconds,
      log: { url: await deps.storage.signedUrl("PUT", logs(runId), timeoutSeconds + TRANSFER_ALLOWANCE_SECONDS) },
    });
    record = {
      runId,
      environmentId: ready.id,
      requestId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      command,
      root: input.root,
      startedAt: new Date().toISOString(),
      timeoutSeconds,
      stopAfterRun: !input.keepEnvironment,
      ...(template ? { template } : {}),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    };
    await deps.store.set(`run:${runId}`, record);
    await deps.api({
      method: "POST",
      path: `/v1/workspaces/${ready.id}/requests`,
      body: { requestId: record.requestId, conversationId: record.conversationId, message, files: [] },
      signal,
    });
    await notifyRunChange(deps);
    return { record, files, bytes };
  } catch (error) {
    await Promise.allSettled([
      saveSubmissionFailure(deps, record, error),
      Promise.resolve().then(() =>
        deps.cleanupEnvironment({
          environmentId: environment.id,
          runId,
          stop: !input.environmentId && ownsEnvironment,
        }),
      ),
    ]);
    await notifyRunChange(deps);
    throw error;
  }
}

async function pickEnvironment(
  deps: RunDeps,
  runId: string,
  seconds: number,
  requested: string | undefined,
  signal?: AbortSignal,
) {
  // Claims cover the wait for readiness too.
  const hold = seconds + 1800;
  if (requested) {
    const selected = await readEnvironment(deps.api, requested, signal);
    if (selected.metadata.pstdio_project_id !== deps.projectId)
      throw new Error("Select an environment created by this project.");
    if (!(await claimEnvironment(deps.store, requested, runId, hold)))
      throw new Error(`Environment ${requested} is running another test run.`);
    return selected;
  }
  // Claims live in one project's storage, while the controller lists all projects.
  // Start isolated unless the caller explicitly selects a workspace to reuse.
  const created = await createEnvironment(deps.api, deps.settings, signal, { pstdio_project_id: deps.projectId });
  if (!(await claimEnvironment(deps.store, created.id, runId, hold)))
    throw new Error(`Environment ${created.id} is running another test run.`);
  return created;
}

const requestPath = (record: RunRecord) =>
  `/v1/workspaces/${record.environmentId}/requests/${record.requestId}?conversationId=${record.conversationId}`;

export async function awaitRun(deps: RunDeps, record: RunRecord, signal?: AbortSignal): Promise<RunSummary> {
  let summary = await checkRun(deps, record, signal, true);
  while (!summary) {
    await waitForControllerPoll(signal);
    signal?.throwIfAborted();
    summary = await checkRun(deps, record, signal, true);
  }
  return summary;
}

async function stopCollectedEnvironment(
  deps: RunCollectionDeps,
  record: RunRecord,
  signal: AbortSignal | undefined,
  retryController: boolean,
) {
  while (true) {
    signal?.throwIfAborted();
    if (!(await renewEnvironmentClaim(deps.store, record.environmentId, record.runId, 1800))) return;
    try {
      await stopEnvironment(deps.api, record.environmentId, signal);
      return;
    } catch (error) {
      signal?.throwIfAborted();
      if (!retryController || !canRetryControllerRequest(error)) throw error;
    }
    await waitForControllerPoll(signal);
  }
}

// One look at a run: collects its result once the controller has finished it, so a run
// whose caller went away still gets its summary and log.
export async function checkRun(
  deps: RunCollectionDeps,
  record: RunRecord,
  signal?: AbortSignal,
  retryTransient = false,
) {
  if (record.summary) return record.summary;
  let receipt = await readRunReceipt<Receipt>(deps.api, requestPath(record), record, signal, retryTransient);
  const expired = !receipt?.finalizedAt && Date.now() >= runDeadline(record);
  if (!receipt?.finalizedAt && !expired) return null;
  if (expired) {
    if (!record.stopAfterRun && (await renewEnvironmentClaim(deps.store, record.environmentId, record.runId, 1800))) {
      // Cancellation acknowledges intent. Keep a reusable workspace claimed until
      // a terminal receipt proves the old command can no longer write its files.
      if (receipt) await cancelOverdueRequest(deps.api, record, receipt, signal);
      return null;
    }
    receipt = timeoutReceipt(record);
  }
  // The runner uploads its log before the controller finalizes the request.
  if (record.stopAfterRun) await stopCollectedEnvironment(deps, record, signal, retryTransient);
  const summary = await summarize(deps, record, receipt!, signal, retryTransient);
  if (expired) summary.error = "The remote runner did not return a final receipt before the run deadline.";
  await deps.store.set(`run:${record.runId}`, { ...record, summary });
  await releaseEnvironment(deps.store, record.environmentId, record.runId);
  await notifyRunChange(deps);
  return summary;
}

export async function cancelRun(deps: RunDeps, record: RunRecord) {
  const receipt = await deps.api<Receipt>({ method: "GET", path: requestPath(record) });
  if (receipt.finalizedAt) return false;
  if (receipt.cancel) return true;
  await cancelRequest(deps.api, record, receipt);
  return true;
}

async function cancelOverdueRequest(api: Api, record: RunRecord, receipt: Receipt, signal?: AbortSignal) {
  if (receipt.cancel) return;
  try {
    await cancelRequest(api, record, receipt, signal);
  } catch (error) {
    signal?.throwIfAborted();
    if (!canRetryControllerRequest(error)) throw error;
  }
}

async function cancelRequest(api: Api, record: RunRecord, receipt: Receipt, signal?: AbortSignal) {
  await api({
    method: "POST",
    path: `/v1/workspaces/${record.environmentId}/executions/${record.requestId}/cancel`,
    body: { execution: receipt.acceptance.execution as never, cancelId: record.runId, scope: "operation" },
    signal,
  });
}

export async function listRuns(store: ExtensionStorageApi) {
  const runs = (await store.records.list()).flatMap(({ recordId, value, deleted }) => {
    if (deleted || !value || typeof value !== "object" || Array.isArray(value) || typeof value.runId !== "string")
      return [];
    if (recordId !== store.records.id(`run:${value.runId}`)) return [];
    return [value as unknown as RunRecord];
  });
  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50);
}

export async function readRun(store: ExtensionStorageApi, runId: string) {
  const record = await store.get<RunRecord>(`run:${runId}`);
  if (!record) throw new Error(`Unknown run ${runId}. List runs with: pst pocketcoder.remote-testing runs list`);
  return record;
}
