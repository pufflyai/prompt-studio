import type { ExtensionProcessApi, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { BranchKind, BranchSource, TemplateRef } from "./branch-templates";
import { type Api, canRetryControllerRequest, waitForControllerPoll } from "./connection";
import { type EnvironmentCleanupInput, rememberEnvironmentCleanup } from "./environment-cleanup";
import {
  claimEnvironment,
  createEnvironment,
  ownsEnvironment,
  readEnvironment,
  releaseEnvironment,
  stopEnvironment,
  waitUntilReady,
} from "./environments";
import { readRunReceipt, runDeadline, TRANSFER_ALLOWANCE_SECONDS } from "./run-deadline";
import { rememberRunLog } from "./run-log";
import { type Receipt, receiptSummary, summarize, timeoutSummary } from "./run-result";
import { saveSubmissionFailure } from "./run-submission";
import type { Settings } from "./settings";
import { activateEnvironment } from "./setup-claims";
import { withSourceArchive } from "./source";
import type { RunStorage } from "./storage";

export interface RunDeps {
  projectId: string;
  api: Api;
  cleanupEnvironment(input: EnvironmentCleanupInput): Promise<void>;
  collectRunLog?(runId: string): Promise<void>;
  publishTemplate?(kind: BranchKind, source: BranchSource, signal?: AbortSignal): Promise<TemplateRef>;
  storage: RunStorage;
  store: ExtensionStorageApi;
  process: ExtensionProcessApi;
  settings: Settings;
  saveLog(runId: string, text: string): Promise<string>;
  /** Tells open views that a run or environment changed. */
  changed?(): Promise<unknown>;
}

export type RunCollectionDeps = Pick<RunDeps, "api" | "store" | "saveLog" | "changed"> &
  Partial<Pick<RunDeps, "cleanupEnvironment" | "collectRunLog">> & {
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
  submissionPending?: boolean;
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

  const setup = { until: Date.now() + TRANSFER_ALLOWANCE_SECONDS * 1000, stop: !input.environmentId };
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
    : await pickEnvironment(deps, input.environmentId, signal);
  let ownsEnvironment = false;
  let record: RunRecord | undefined;
  try {
    ownsEnvironment = await claimEnvironment(deps.store, environment.id, runId, setup);
    if (!ownsEnvironment) throw new Error(`Environment ${environment.id} is running another test run.`);
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
      submissionPending: true,
      ...(template ? { template } : {}),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    };
    await deps.store.set(`run:${runId}`, record);
    await activateEnvironment(deps.store, environment.id, runId);
    await deps.api({
      method: "POST",
      path: `/v1/workspaces/${ready.id}/requests`,
      body: { requestId: record.requestId, conversationId: record.conversationId, message, files: [] },
      signal,
    });
    record = { ...record, submissionPending: false };
    await deps.store.records.commit({
      operationId: crypto.randomUUID(),
      edits: [{ recordId: deps.store.records.id(`run:${runId}`), set: { "/submissionPending": false } }],
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

async function pickEnvironment(deps: RunDeps, requested: string | undefined, signal?: AbortSignal) {
  // Ownership covers provisioning as well as execution.
  if (requested) {
    const selected = await readEnvironment(deps.api, requested, signal);
    if (selected.metadata.pstdio_project_id !== deps.projectId)
      throw new Error("Select an environment created by this project.");
    return selected;
  }
  // Claims live in one project's storage, while the controller lists all projects.
  // Start isolated unless the caller explicitly selects a workspace to reuse.
  return createEnvironment(deps.api, deps.settings, signal, { pstdio_project_id: deps.projectId });
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
    if (!(await ownsEnvironment(deps.store, record.environmentId, record.runId))) return;
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

async function saveTimedOutRun(deps: RunCollectionDeps, record: RunRecord, summary: RunSummary, finalized: boolean) {
  // Independent cleanup and log workers own remote retries. A network outage must
  // not keep an overdue result looking like an active test run.
  if (record.stopAfterRun && (await ownsEnvironment(deps.store, record.environmentId, record.runId)))
    await rememberEnvironmentCleanup(deps.store, {
      environmentId: record.environmentId,
      runId: record.runId,
      stop: true,
    });
  await rememberRunLog(deps.store, record.runId);
  await deps.store.set(`run:${record.runId}`, { ...record, summary });
  if (finalized && !record.stopAfterRun) await releaseEnvironment(deps.store, record.environmentId, record.runId);
  await notifyRunChange(deps);
  await Promise.allSettled([
    ...(record.stopAfterRun
      ? [
          Promise.resolve().then(() =>
            deps.cleanupEnvironment?.({
              environmentId: record.environmentId,
              runId: record.runId,
              stop: true,
            }),
          ),
        ]
      : []),
    Promise.resolve().then(() => deps.collectRunLog?.(record.runId)),
  ]);
  return summary;
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
  const receipt = await readRunReceipt<Receipt>(deps.api, requestPath(record), record, signal, retryTransient);
  const terminal = receipt?.finalizedAt ? receiptSummary(record, receipt) : null;
  const expired = !receipt?.finalizedAt && Date.now() >= runDeadline(record);
  if (!receipt?.finalizedAt && !expired) return null;
  if (expired || terminal?.status === "timed_out") {
    if (expired && !record.stopAfterRun && (await ownsEnvironment(deps.store, record.environmentId, record.runId))) {
      // Cancellation acknowledges intent. Keep a reusable workspace claimed until
      // a terminal receipt proves the old command can no longer write its files.
      if (receipt) await cancelOverdueRequest(deps.api, record, receipt, signal);
      return null;
    }
    return saveTimedOutRun(deps, record, terminal ?? timeoutSummary(record), terminal !== null);
  }
  // The runner uploads its log before the controller finalizes the request.
  if (record.stopAfterRun) await stopCollectedEnvironment(deps, record, signal, retryTransient);
  const summary = await summarize(deps, record, receipt!, signal, retryTransient);
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

export { listRuns, readRun } from "./run-store";
