import type {
  HarnessCommandContext,
  HarnessExit,
  HarnessOperation,
  HarnessParams,
  HarnessSession,
  PreparedHarnessOperation,
} from "pstdio-api-contracts";
import { HarnessDisposedError } from "pstdio-api-runtime-host";
import { readCurrentHarness } from "../harnesses/read-current-harness";
import { workspaceSessionReadiness } from "../workspaces/workspace-session-readiness";
import type { SessionsRouteDeps } from "./deps";
import { getSessionHarness } from "./get-session-harness";
import { type HarnessCommandDiscovery, unavailableWorkspaceCommands } from "./harness-command-discovery";
import { initializeConversation } from "./initialize-conversation";
import { emitSessionCommandsChanged } from "./session-command-events";
import {
  bindSessionCancellation,
  rejectPersistedSessionCancellation,
  rejectStoreSessionCancellation,
} from "./session-request-cancellation";
import { hasCreateCapacity, withSchedulingLock } from "./session-scheduler-internals";
import type { ActiveSession } from "./session-store";
import { toHarnessWorkspaceContext } from "./session-workspace-context";
import { trackHarnessSession } from "./track-harness-session";

export class HarnessOperationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

class HarnessOperationRefused extends HarnessOperationError {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), 400);
    this.name = "HarnessOperationRefused";
  }
}

const resolve = async (deps: SessionsRouteDeps, id: string, operation = false) => {
  const session = await deps.sessionService.get(id);
  if (!session) throw new HarnessOperationError("Session not found.", 404);
  const record = await deps.workspaceSessionService.getWorkspaceBySessionId(
    id,
    operation ? { forLaunch: true } : undefined,
  );
  const readiness = workspaceSessionReadiness(record);
  if (operation && readiness.kind !== "ready") throw new HarnessOperationError(readiness.message, 409);
  const harness = await getSessionHarness(deps.harnessRegistry, session);
  if (!harness) throw new HarnessOperationError("The selected harness is not enabled for this project.", 400);
  const workspace = readiness.kind === "ready" ? toHarnessWorkspaceContext(record, harness.cwdRequirement) : undefined;
  if (workspace?.executionTarget.kind === "remote" && harness.cwdRequirement === "required")
    throw new HarnessOperationError("This harness requires a local workspace.", 400);
  const input: HarnessCommandContext = {
    sessionId: id,
    agentSessionId: session.agent_session_id ?? undefined,
    cwd: workspace?.executionTarget.kind === "local" ? workspace.executionTarget.rootPath : (session.cwd ?? undefined),
    workspace,
    model: session.last_selected_model,
    params: session.params_json ?? undefined,
  };
  return { session, harness, input, readiness, options: { projectId: session.project_id ?? undefined } };
};
export const observeSessionHarnessCommands = async (deps: SessionsRouteDeps, id: string, changed: () => void) => {
  const { harness, input, options, readiness } = await resolve(deps, id);
  if (readiness.kind !== "ready") return () => {};
  if (harness.watchCommandState) return harness.watchCommandState(input, changed, options);
  // Providers without complete notifications get command-only discovery, never a full session read.
  const timer = harness.supportsCommandState ? setInterval(changed, 30_000) : undefined;
  return () => clearInterval(timer);
};
export const getSessionHarnessCommands = async (
  deps: SessionsRouteDeps,
  id: string,
): Promise<HarnessCommandDiscovery> => {
  const { harness, input, options, readiness } = await resolve(deps, id);
  if (readiness.kind !== "ready") return unavailableWorkspaceCommands(harness.id, harness.supportsCommandState);
  try {
    const state = await readCurrentHarness(deps.harnessRegistry, harness.id, options, async (current) => {
      if (input.workspace?.executionTarget.kind === "remote" && current.cwdRequirement === "required")
        throw new HarnessOperationError("This harness requires a local workspace.", 400);
      return { ...(await current.getCommandState(input, options)), harnessId: current.id };
    });
    if (!state) throw new HarnessOperationError("The selected harness is not enabled for this project.", 400);
    return state;
  } catch (error) {
    if (error instanceof HarnessDisposedError)
      throw new HarnessOperationError("The harness changed during discovery. Try again.", 409);
    throw error;
  }
};
const saveParams = (deps: SessionsRouteDeps, id: string, params: HarnessParams | undefined, harnessId: string) => {
  if (!params) return;
  return withSchedulingLock(async () => {
    const current = await deps.sessionService.get(id);
    if (!current) return;
    const selected = await getSessionHarness(deps.harnessRegistry, current);
    if (selected?.id !== harnessId) throw new HarnessOperationError("The harness changed during this operation.", 409);
    await deps.sessionService.update(id, { params_json: { ...current.params_json, ...params } });
  });
};
const invokeControl = async (
  deps: SessionsRouteDeps,
  id: string,
  prepared: PreparedHarnessOperation & { release(): void },
  harnessId: string,
  entry: ActiveSession,
  control: { signal: AbortSignal; release(): void },
  signal?: AbortSignal,
) => {
  try {
    const controlSignal = signal ? AbortSignal.any([signal, control.signal]) : control.signal;
    controlSignal.throwIfAborted();
    const conversation = await entry.conversationReady;
    const result = await prepared.invoke({
      events: conversation,
      approvals: entry.approvalService,
      questions: entry.questionService,
      signal: controlSignal,
    });
    if (result.kind !== "completed") throw new Error("A harness control cannot start exclusive work.");
    await saveParams(deps, id, result.params, harnessId);
    controlSignal.throwIfAborted();
    return { status: "completed" as const, message: result.message };
  } catch (error) {
    if (error instanceof HarnessOperationError) throw error;
    throw new HarnessOperationError(error instanceof Error ? error.message : String(error), 400);
  } finally {
    control.release();
    prepared.release();
    emitSessionCommandsChanged(deps.eventBus, id);
  }
};
const emitOperationLifecycle = async (deps: SessionsRouteDeps, id: string, lifecycle: "started" | "resumed") => {
  const session = (await deps.sessionService.get(id))!;
  if (lifecycle === "started") deps.sessionService.emitStartedHook?.(session);
  else deps.sessionService.emitResumedHook?.(session);
};
// Admits a prepared operation into the session: a control joins the running session; any other
// operation needs an idle session and, when exclusive, a free execution slot.
const admitPreparedOperation = async <P extends PreparedHarnessOperation>(
  deps: SessionsRouteDeps,
  id: string,
  session: { status: string },
  harnessId: string,
  prepared: P,
  signal?: AbortSignal,
) => {
  const active = deps.sessionService.store.get(id);
  if (active?.cancellationRequested) throw new HarnessOperationError("The session is stopping.", 409);
  if (prepared.execution === "control" && active?.session) {
    const finished = Promise.withResolvers<void>();
    const invocation = { done: finished.promise, abort: new AbortController() };
    active.controlInvocations.add(invocation);
    const release = () => {
      active.controlInvocations.delete(invocation);
      finished.resolve();
    };
    return {
      harnessId,
      prepared,
      entry: null,
      control: { entry: active, release, signal: invocation.abort.signal },
    };
  }
  if (["in_progress", "awaiting_input", "queued"].includes(session.status))
    throw new HarnessOperationError("Finish or stop the current work before running this command.", 409);
  const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(id);
  if (prepared.execution === "exclusive" && !(await hasCreateCapacity(deps, workspace?.id)))
    throw new HarnessOperationError("All execution slots are in use. Try again when one is free.", 409);
  const resumed = await deps.sessionService.resume(id, {
    expectedStatus: session.status as "completed" | "failed" | "cancelled" | "disconnected",
    emitResumedHook: false,
  });
  if (!resumed) throw new HarnessOperationError("Session changed before the command started.", 409);
  const entry = initializeConversation(id, deps, async () => {}, signal);
  return { harnessId, prepared, entry, control: null };
};

export const invokeSessionHarnessOperation = async (
  deps: SessionsRouteDeps,
  id: string,
  operation: HarnessOperation,
  expectedHarnessId?: string,
  signal?: AbortSignal,
  lifecycle: "started" | "resumed" = "resumed",
) => {
  const context = await withSchedulingLock(async () => {
    const { session, harness, input, options } = await resolve(deps, id, true);
    if (expectedHarnessId && harness.id !== expectedHarnessId)
      throw new HarnessOperationError("The harness changed. Reload its commands before trying again.", 409);
    let prepared: Awaited<ReturnType<typeof harness.prepareOperation>>;
    try {
      prepared = await harness.prepareOperation(input, operation, options);
    } catch (error) {
      throw new HarnessOperationRefused(error);
    }
    // Until it is invoked, the prepared operation holds its children; every refusal here ends them.
    try {
      return await admitPreparedOperation(deps, id, session, harness.id, prepared, signal);
    } catch (error) {
      prepared.release();
      throw error;
    }
  });
  const { harnessId, prepared, entry } = context;
  if (context.control)
    return invokeControl(deps, id, prepared, harnessId, context.control.entry, context.control, signal);
  // Unreachable: admission returns a conversation entry whenever it returns no control.
  if (!entry) throw new Error("Harness command has no conversation owner.");

  const abort = new AbortController();
  const invocationSignal = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal;
  const startup = Promise.withResolvers<HarnessExit>();
  let accepted: HarnessSession | undefined;
  const pending: HarnessSession = {
    done: startup.promise,
    timeoutStrategy: "provider",
    stop: async () => {
      abort.abort();
      await accepted?.stop();
    },
  };
  if (!deps.sessionService.store.setSession(id, pending, entry)) abort.abort();
  try {
    const conversation = await entry.conversationReady;
    invocationSignal.throwIfAborted();
    const result = await prepared.invoke({
      events: conversation,
      approvals: entry.approvalService,
      questions: entry.questionService,
      signal: invocationSignal,
    });
    if (prepared.execution === "control" && result.kind !== "completed")
      throw new Error("A harness control cannot start exclusive work.");
    if (result.kind === "started") {
      accepted = result.session;
      await withSchedulingLock(async () => {
        if (deps.sessionService.store.get(id) !== entry || !accepted?.agentSessionId) return;
        const current = await deps.sessionService.get(id);
        if (current && (await getSessionHarness(deps.harnessRegistry, current))?.id === harnessId)
          await deps.sessionService.update(id, { agent_session_id: accepted.agentSessionId });
      });
    }
    invocationSignal.throwIfAborted();
    await saveParams(deps, id, result.params, harnessId);
    await emitOperationLifecycle(deps, id, lifecycle);
    if (result.kind === "completed") {
      startup.resolve({ status: "completed" });
      const run = { done: Promise.resolve({ status: "completed" as const }), stop: () => {} };
      deps.sessionService.store.setSession(id, run, entry);
      void trackHarnessSession(id, run, entry.eventStore.subscribe({ activityOnly: true }), deps, undefined, entry);
      return { status: "completed" as const, message: result.message };
    }
    const run = result.session;
    void run.done.then(startup.resolve);

    await bindSessionCancellation(signal, run, deps, id, entry);
    await rejectPersistedSessionCancellation(run, deps, id, entry);
    if (!deps.sessionService.store.setSession(id, run, entry))
      await rejectStoreSessionCancellation(run, deps, id, entry);
    void trackHarnessSession(id, run, entry.eventStore.subscribe({ activityOnly: true }), deps, undefined, entry);
    return { status: "started" as const };
  } catch (error) {
    if (accepted && invocationSignal.aborted) await accepted.stop();
    const status = invocationSignal.aborted ? ("cancelled" as const) : ("failed" as const);
    startup.resolve({ status });
    const failed = { done: Promise.resolve({ status }), stop: () => {} };
    deps.sessionService.store.setSession(id, failed, entry);
    await trackHarnessSession(id, failed, entry.eventStore.subscribe({ activityOnly: true }), deps, undefined, entry);
    if (error instanceof HarnessOperationError) throw error;
    throw new HarnessOperationError(error instanceof Error ? error.message : String(error), 400);
  } finally {
    prepared.release();
    emitSessionCommandsChanged(deps.eventBus, id);
  }
};

export const createSessionHarnessOperation = async (
  deps: SessionsRouteDeps,
  input: Parameters<SessionsRouteDeps["sessionService"]["create"]>[0] & {
    workspaceId?: string;
  },
  operation: HarnessOperation,
  onCreated: (session: { id: string; title: string; status: string }) => Promise<void>,
  signal?: AbortSignal,
) => {
  const { workspaceId, ...sessionInput } = input;
  const workspace = workspaceId ? await deps.workspaceService.get(workspaceId) : null;
  if (workspaceId && (!workspace || workspace.deleted_at || workspace.archived))
    throw new HarnessOperationError("Choose an active workspace before running this command.", 409);
  const readiness = workspaceSessionReadiness(workspace);
  if (readiness.kind !== "ready") throw new HarnessOperationError(readiness.message, 409);
  if (workspace && (await deps.workspaceService.maintenance.isRunning(workspace.id)))
    throw new HarnessOperationError("Workspace files are being updated. Try the command again shortly.", 409);
  const session = await deps.sessionService.create(
    { ...sessionInput, status: "completed" },
    { emitStartedHook: false },
  );
  try {
    await onCreated(session);
  } catch (error) {
    await deps.sessionService.transitionStatus(session.id, "failed");
    throw error;
  }
  try {
    const operation_result = await invokeSessionHarnessOperation(
      deps,
      session.id,
      operation,
      input.agent,
      signal,
      "started",
    );
    return { ...(await deps.sessionService.get(session.id))!, operation_result };
  } catch (error) {
    if (!(error instanceof HarnessOperationError)) throw error;
    const current = (await deps.sessionService.get(session.id))!;
    if (current.status === "completed") await deps.sessionService.transitionStatus(session.id, "failed");
    return {
      ...(await deps.sessionService.get(session.id))!,
      operation_result: { status: "completed" as const, message: error.message },
    };
  }
};
