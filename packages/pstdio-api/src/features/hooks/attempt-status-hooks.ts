import type { createPluginService } from "../plugins/plugin-service";
import { withHookSessionClient } from "./hook-client";
import type { createPostHookStore } from "./post-hook-store";

type AttemptStatusHookDeps = {
  pluginService: ReturnType<typeof createPluginService>;
};

type PreHookContext = {
  projectId: string;
  fromStatus: string;
  toStatus: string;
  payload: Record<string, unknown>;
};

type PreHookResult = {
  rejected: boolean;
  stderr: string;
  stdout: string;
};

type PostHookContext = {
  projectId: string;
  toStatus: string;
  payload: Record<string, unknown>;
};

export const firePreAttemptStatusHook = async (
  deps: AttemptStatusHookDeps,
  context: PreHookContext,
): Promise<PreHookResult> => {
  const runtime = await deps.pluginService.getForProject(context.projectId);

  const hookContext = {
    projectId: context.projectId,
    fromStatus: context.fromStatus,
    toStatus: context.toStatus,
    ...context.payload,
  };

  const ctx = {
    ...hookContext,
    client: withHookSessionClient(runtime.client, hookContext),
  };

  const result = await runtime.hooks.firePre("preAttemptStatusChange", ctx as never);

  if (result.rejected) {
    return { rejected: true, stderr: result.reason ?? "", stdout: "" };
  }

  return { rejected: false, stderr: "", stdout: "" };
};

export const deliverPostAttemptStatusHook = async (
  deps: AttemptStatusHookDeps,
  store: ReturnType<typeof createPostHookStore>,
  sessionId: string,
) => {
  const entry = store.consume(sessionId);
  if (!entry) return null;

  const runtime = await deps.pluginService.getForProject(entry.projectId);

  const hookContext = {
    projectId: entry.projectId,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    ...entry.payload,
  };

  const ctx = {
    ...hookContext,
    client: withHookSessionClient(runtime.client, hookContext),
  };

  await runtime.hooks.firePost("postAttemptStatusChange", ctx as never);
};

export const firePostAttemptStatusHook = async (deps: AttemptStatusHookDeps, context: PostHookContext) => {
  const runtime = await deps.pluginService.getForProject(context.projectId);

  const hookContext = {
    projectId: context.projectId,
    toStatus: context.toStatus,
    ...context.payload,
  };

  const ctx = {
    ...hookContext,
    client: withHookSessionClient(runtime.client, hookContext),
  };

  await runtime.hooks.firePost("postAttemptStatusChange", ctx as never);
};
