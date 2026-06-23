import type {
  CommandInvocation,
  CommandNotice,
  CommandOutcome,
  CommandSource,
  JsonObject,
  RepoContext,
} from "@pstdio/sdk/extensions";
import type { RuntimeCommandRecord, RuntimeMiddlewareRecord } from "../../types/runtime";
import type { RunnerState } from "./context";
import { lifecycleEventId } from "./dispatch";
import { createEnvironmentCache, environmentFailedOutcome, withNotices } from "./environment";
import { findCommand, middlewaresFor, serializeError } from "./internals";
import { type MiddlewareChainResult, runMiddlewareChain } from "./middleware";
import type { CommandRunnerEnvironment, InternalExecuteInput } from "./types";
import { validateCommandParams } from "./validate-params";

const buildRequestPayload = (
  record: RuntimeCommandRecord,
  invocation: CommandInvocation,
  invocationId: string,
  projectId: string,
  source: CommandSource | undefined,
  repo: RepoContext | undefined,
) => ({
  commandId: record.id,
  invocationId,
  source,
  params: invocation.params,
  resource: invocation.resource,
  repo,
  projectId,
});

export const executeExtensionCommand = async (
  state: RunnerState,
  input: InternalExecuteInput,
): Promise<CommandOutcome> => {
  if (input.depth > state.maxDepth) {
    return {
      ok: false,
      status: "rejected",
      code: "nested_depth_exceeded",
      reason: `Nested command depth exceeded (${state.maxDepth}) while invoking ${input.commandId}`,
    };
  }

  const record = findCommand(state.runtime, input.commandId);
  if (!record) {
    return {
      ok: false,
      status: "error",
      code: "command_not_found",
      reason: `Command "${input.commandId}" is not registered`,
    };
  }

  const notices: CommandNotice[] = [];
  const envFor = createEnvironmentCache(state.deps, input.projectId, input.repo, notices);
  let commandEnv: CommandRunnerEnvironment;
  try {
    commandEnv = await envFor(record);
  } catch (err) {
    return environmentFailedOutcome(err);
  }

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

  const buildCommandCtx = (invocation: CommandInvocation) =>
    state.factory.buildCommandContext(
      commandEnv,
      record,
      record.id,
      invocation,
      invocationId,
      input.projectId,
      input.source,
      input.repo,
      input.depth,
    );
  const buildMiddlewareCtx = async (invocation: CommandInvocation, middleware: RuntimeMiddlewareRecord) =>
    state.factory.buildCommandContext(
      await envFor(middleware),
      middleware,
      record.id,
      invocation,
      invocationId,
      input.projectId,
      input.source,
      input.repo,
      input.depth,
    );

  const requestedPayload = buildRequestPayload(
    record,
    initialInvocation,
    invocationId,
    input.projectId,
    input.source,
    input.repo,
  );
  await state.dispatcher.dispatch(lifecycleEventId("requested", record.id), requestedPayload);

  let middlewareResult: MiddlewareChainResult;
  try {
    middlewareResult = await runMiddlewareChain(
      middlewaresFor(state.runtime, record.id),
      initialInvocation,
      buildMiddlewareCtx,
    );
  } catch (err) {
    return withNotices(environmentFailedOutcome(err), notices);
  }

  if (middlewareResult.status === "reject") {
    const rejectedPayload = { ...requestedPayload, ...middlewareResult.rejection };
    await state.dispatcher.dispatch(lifecycleEventId("rejected", record.id), rejectedPayload);
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

  const validation = validateCommandParams(record.params, finalInvocation.params);
  if (!validation.ok) {
    const rejectedPayload = {
      ...requestedPayload,
      params: finalInvocation.params,
      code: "invalid_params",
      reason: validation.reason,
    };
    await state.dispatcher.dispatch(lifecycleEventId("rejected", record.id), rejectedPayload);
    return withNotices({ ok: false, status: "rejected", code: "invalid_params", reason: validation.reason }, notices);
  }

  const startedPayload = {
    ...requestedPayload,
    params: finalInvocation.params,
    resource: finalInvocation.resource,
  };

  await state.dispatcher.dispatch(lifecycleEventId("started", record.id), startedPayload);

  const start = Date.now();
  try {
    const value = await record.run(buildCommandCtx(finalInvocation));
    const elapsedMs = Date.now() - start;
    await state.dispatcher.dispatch(lifecycleEventId("completed", record.id), {
      ...startedPayload,
      result: value,
      elapsedMs,
    });
    return withNotices({ ok: true, status: "success", value }, notices);
  } catch (err) {
    const elapsedMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    await state.dispatcher.dispatch(lifecycleEventId("failed", record.id), {
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
