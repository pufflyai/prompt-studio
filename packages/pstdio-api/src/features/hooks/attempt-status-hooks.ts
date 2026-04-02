import type { AttemptStatusHookName, HookPayload, HookResult } from "pstdio-wt";
import { fireHook } from "./fire-hook";
import type { createPostHookStore } from "./post-hook-store";

type AttemptStatusHookDeps = {
  repoService: { listByProject: (projectId: string) => Promise<{ path: string }[]> };
};

type PreHookContext = {
  projectId: string;
  fromStatus: string;
  toStatus: string;
  payload: HookPayload;
};

type PreHookResult = {
  rejected: boolean;
  stderr: string;
  stdout: string;
};

export const firePreAttemptStatusHook = async (
  deps: AttemptStatusHookDeps,
  context: PreHookContext,
): Promise<PreHookResult> => {
  const hookName: AttemptStatusHookName = `pre-attempt-status-${context.toStatus}`;

  const result = await fireHook(deps, {
    hookName,
    projectId: context.projectId,
    payload: context.payload,
  });

  if (!result || result.skipped) {
    return { rejected: false, stderr: "", stdout: "" };
  }

  if (result.exitCode !== 0) {
    return { rejected: true, stderr: result.stderr, stdout: result.stdout };
  }

  return { rejected: false, stderr: result.stderr, stdout: result.stdout };
};

export const deliverPostAttemptStatusHook = async (
  deps: AttemptStatusHookDeps,
  store: ReturnType<typeof createPostHookStore>,
  sessionId: string,
): Promise<HookResult | null> => {
  const entry = store.consume(sessionId);
  if (!entry) return null;

  const result = await fireHook(deps, {
    hookName: entry.hookName,
    projectId: entry.projectId,
    payload: entry.payload,
  });

  return result;
};
