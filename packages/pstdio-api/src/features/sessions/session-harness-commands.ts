import type {
  HarnessCommandContext,
  HarnessExit,
  HarnessOperation,
  HarnessOperationResult,
  HarnessParams,
  HarnessSession,
  PreparedHarnessOperation,
} from "pstdio-api-contracts";
import { waitForWorkspaceReady } from "../workspaces/wait-for-ready";
import type { SessionsRouteDeps } from "./deps";
import { getSessionHarness } from "./get-session-harness";
import { initializeConversation } from "./initialize-conversation";
import {
  bindSessionCancellation,
  rejectPersistedSessionCancellation,
  rejectStoreSessionCancellation,
} from "./session-request-cancellation";
import { hasCreateCapacity, withSchedulingLock } from "./session-scheduler-internals";
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
const resolve = async (deps: SessionsRouteDeps, id: string) => {
  const session = await deps.sessionService.get(id);
  if (!session) throw new HarnessOperationError("Session not found.", 404);
  const harness = await getSessionHarness(deps.harnessRegistry, session);
  if (!harness) throw new HarnessOperationError("The selected harness is not enabled for this project.", 400);
  const record = await waitForWorkspaceReady({ workspaceSessionService: deps.workspaceSessionService }, id);
  if (record?.initializing || record?.setup_error || (record?.provider_state && record.provider_state !== "ready"))
    throw new HarnessOperationError("The workspace is not ready.", 409);
  const workspace = toHarnessWorkspaceContext(record);
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
  return { session, harness, input, options: { projectId: session.project_id ?? undefined } };
};
export const getSessionHarnessCommands = async (deps: SessionsRouteDeps, id: string) => {
  const { harness, input, options } = await resolve(deps, id);
  return { ...(await harness.getCommandState(input, options)), harnessId: harness.id };
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
  prepared: PreparedHarnessOperation,
  harnessId: string,
  signal?: AbortSignal,
) => {
  const conversation = await deps.sessionService.store.get(id)?.conversationReady;
  let result: HarnessOperationResult;
  try {
    result = await prepared.invoke({ events: conversation ?? { getMessages: () => [], push: () => {} }, signal });
  } catch (error) {
    throw new HarnessOperationError(error instanceof Error ? error.message : String(error), 400);
  }
  if (result.kind !== "completed") throw new Error("A harness control cannot start exclusive work.");
  await saveParams(deps, id, result.params, harnessId);
  return { status: "completed" as const, message: result.message };
};
export const invokeSessionHarnessOperation = async (
  deps: SessionsRouteDeps,
  id: string,
  operation: HarnessOperation,
  expectedHarnessId?: string,
  signal?: AbortSignal,
) => {
  const context = await withSchedulingLock(async () => {
    const { session, harness, input, options } = await resolve(deps, id);
    if (expectedHarnessId && harness.id !== expectedHarnessId)
      throw new HarnessOperationError("The harness changed. Reload its commands before trying again.", 409);
    let prepared: PreparedHarnessOperation;
    try {
      prepared = await harness.prepareOperation(input, operation, options);
    } catch (error) {
      throw new HarnessOperationError(error instanceof Error ? error.message : String(error), 400);
    }
    if (prepared.execution === "control") return { harnessId: harness.id, prepared, entry: null };
    if (session.status === "in_progress" || session.status === "awaiting_input" || session.status === "queued")
      throw new HarnessOperationError("Finish or stop the current work before running this command.", 409);
    if (!(await hasCreateCapacity(deps)))
      throw new HarnessOperationError("All execution slots are in use. Try again when one is free.", 409);
    const resumed = await deps.sessionService.resume(id, {
      expectedStatus: session.status as "completed" | "failed" | "cancelled" | "disconnected",
    });
    if (!resumed) throw new HarnessOperationError("Session changed before the command started.", 409);
    const entry = initializeConversation(id, deps, async () => {}, signal);
    return { harnessId: harness.id, prepared, entry };
  });
  const { harnessId, prepared, entry } = context;
  if (!entry) return invokeControl(deps, id, prepared, harnessId, signal);

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
    const result = await prepared.invoke({ events: conversation, signal: invocationSignal });
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
    if (result.kind === "completed") {
      startup.resolve({ status: "completed" });
      await saveParams(deps, id, result.params, harnessId);
      const run = { done: Promise.resolve({ status: "completed" as const }), stop: () => {} };
      deps.sessionService.store.setSession(id, run, entry);
      void trackHarnessSession(id, run, entry.eventStore.subscribe(), deps, undefined, entry);
      return { status: "completed" as const, message: result.message };
    }
    const run = result.session;
    void run.done.then(startup.resolve);
    await saveParams(deps, id, result.params, harnessId);

    await bindSessionCancellation(signal, run, deps, id, entry);
    await rejectPersistedSessionCancellation(run, deps, id, entry);
    if (!deps.sessionService.store.setSession(id, run, entry))
      await rejectStoreSessionCancellation(run, deps, id, entry);
    void trackHarnessSession(id, run, entry.eventStore.subscribe(), deps, undefined, entry);
    return { status: "started" as const };
  } catch (error) {
    if (accepted && invocationSignal.aborted) await accepted.stop();
    const status = invocationSignal.aborted ? ("cancelled" as const) : ("failed" as const);
    startup.resolve({ status });
    const failed = { done: Promise.resolve({ status }), stop: () => {} };
    deps.sessionService.store.setSession(id, failed, entry);
    await trackHarnessSession(id, failed, entry.eventStore.subscribe(), deps, undefined, entry);
    if (error instanceof HarnessOperationError) throw error;
    throw new HarnessOperationError(error instanceof Error ? error.message : String(error), 400);
  }
};
