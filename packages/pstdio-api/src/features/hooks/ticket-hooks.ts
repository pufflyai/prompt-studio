import type { TicketHookName } from "pstdio-hooks";
import { isBlockingHook, parsePayloadOverride } from "pstdio-hooks";
import { fireHook } from "./fire-hook";

type TicketPayload = Record<string, unknown>;

export type FireTicketHookDeps = {
  repoService: { listByProject: (projectId: string) => Promise<{ path: string }[]> };
};

export type FireTicketHookResult = {
  rejected: boolean;
  stderr: string;
  modifiedPayload: TicketPayload | null;
};

// Synchronous hook — awaits result and supports blocking/rejection
export const fireTicketHook = async (
  deps: FireTicketHookDeps,
  hookName: TicketHookName,
  projectId: string,
  payload: TicketPayload,
): Promise<FireTicketHookResult> => {
  const result = await fireHook(deps, { hookName, projectId, payload });

  if (!result || result.skipped) {
    return { rejected: false, stderr: "", modifiedPayload: null };
  }

  if (isBlockingHook(hookName) && result.exitCode !== 0) {
    return { rejected: true, stderr: result.stderr, modifiedPayload: null };
  }

  const modified = parsePayloadOverride(result.stdout);
  if (modified) {
    return { rejected: false, stderr: "", modifiedPayload: modified };
  }

  return { rejected: false, stderr: result.stderr, modifiedPayload: null };
};

// Async hook — fire-and-forget
export const fireTicketHookAsync = (
  deps: FireTicketHookDeps,
  hookName: TicketHookName,
  projectId: string,
  payload: TicketPayload,
) => {
  void fireHook(deps, { hookName, projectId, payload }).catch(() => {});
};
