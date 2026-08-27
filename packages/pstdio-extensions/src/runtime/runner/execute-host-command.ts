import type {
  CommandInvocation,
  CommandNotice,
  CommandOutcome,
  CommandSource,
  JsonObject,
  RepoContext,
} from "@pstdio/sdk/extensions";
import type { RuntimeMiddlewareRecord } from "../../types/runtime";
import type { RunnerState } from "./context";
import { lifecycleEventId } from "./dispatch";
import { createEnvironmentCache, environmentFailedOutcome, withNotices } from "./environment";
import { middlewaresFor, serializeError } from "./internals";
import { type MiddlewareChainResult, runMiddlewareChain } from "./middleware";
import type { HostCommandExecuteInput } from "./types";

const buildHostRequestPayload = (
  commandId: string,
  invocation: CommandInvocation,
  invocationId: string,
  projectId: string,
  source: CommandSource | undefined,
  repo: RepoContext | undefined,
) => ({
  commandId,
  invocationId,
  source,
  params: invocation.params,
  resource: invocation.resource,
  repo,
  projectId,
});

export const executeHostCommand = async <TResult>(
  state: RunnerState,
  input: HostCommandExecuteInput<TResult>,
): Promise<CommandOutcome<TResult>> => {
  if (input.signal?.aborted) throw input.signal.reason;
  const notices: CommandNotice[] = [];
  const envFor = createEnvironmentCache(state.deps, input.projectId, input.repo, notices, {
    workspaceDir: input.workspaceDir,
    workspaceId: input.workspaceId,
  });
  const invocationId = state.generateId();
  const initialInvocation: CommandInvocation = {
    params: (input.params ?? {}) as JsonObject,
    resource: input.resource,
    repoId: input.repo?.repoId,
    repoPath: input.repo?.path,
    attachment: input.attachment,
    slot: input.slot,
    metadata: input.metadata,
  };

  const requestedPayload = buildHostRequestPayload(
    input.commandId,
    initialInvocation,
    invocationId,
    input.projectId,
    input.source,
    input.repo,
  );
  await state.dispatcher.dispatch(lifecycleEventId("requested", input.commandId), requestedPayload);

  const buildMiddlewareCtx = async (invocation: CommandInvocation, middleware: RuntimeMiddlewareRecord) =>
    state.factory.buildCommandContext(
      await envFor(middleware),
      middleware,
      input.commandId,
      invocation,
      invocationId,
      input.projectId,
      input.source,
      input.repo,
      0,
      { workspaceDir: input.workspaceDir, workspaceId: input.workspaceId },
      input.signal,
    );

  let middlewareResult: MiddlewareChainResult;
  try {
    middlewareResult = await runMiddlewareChain(
      middlewaresFor(state.runtime, input.commandId),
      initialInvocation,
      buildMiddlewareCtx,
    );
  } catch (err) {
    return withNotices(environmentFailedOutcome<TResult>(err), notices);
  }

  if (middlewareResult.status === "reject") {
    const rejectedPayload = { ...requestedPayload, ...middlewareResult.rejection };
    await state.dispatcher.dispatch(lifecycleEventId("rejected", input.commandId), rejectedPayload);
    return withNotices(
      {
        ok: false,
        status: "rejected",
        code: middlewareResult.rejection.code,
        reason: middlewareResult.rejection.reason,
        data: middlewareResult.rejection.data,
      },
      notices,
    );
  }

  const finalInvocation = middlewareResult.invocation;
  const startedPayload = {
    ...requestedPayload,
    params: finalInvocation.params,
    resource: finalInvocation.resource,
  };

  await state.dispatcher.dispatch(lifecycleEventId("started", input.commandId), startedPayload);

  const start = Date.now();
  try {
    if (input.signal?.aborted) throw input.signal.reason;
    const value = await input.run(finalInvocation);
    const elapsedMs = Date.now() - start;
    await state.dispatcher.dispatch(lifecycleEventId("completed", input.commandId), {
      ...startedPayload,
      result: value,
      elapsedMs,
    });
    return withNotices({ ok: true, status: "success", value }, notices);
  } catch (err) {
    const elapsedMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    await state.dispatcher.dispatch(lifecycleEventId("failed", input.commandId), {
      ...startedPayload,
      reason: message,
      error: serializeError(err),
      elapsedMs,
    });
    return withNotices(
      { ok: false, status: "error", code: "handler_threw", reason: message, error: serializeError(err) },
      notices,
    );
  }
};
