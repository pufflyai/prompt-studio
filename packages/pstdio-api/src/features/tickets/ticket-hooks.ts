import type { TicketHookName } from "pstdio-wt";
import { isBlockingHook } from "pstdio-wt";
import type { RouteDeps } from "../deps";
import { fireHook } from "../hooks/fire-hook";

type TicketPayload = Record<string, unknown>;

type FireTicketHookResult = {
  rejected: boolean;
  stderr: string;
  modifiedPayload: TicketPayload | null;
};

export const fireTicketHook = async (
  deps: Pick<RouteDeps, "reposService">,
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

  if (result.stdout.trim()) {
    try {
      const modified = JSON.parse(result.stdout) as TicketPayload;
      return { rejected: false, stderr: "", modifiedPayload: modified };
    } catch {
      // stdout wasn't valid JSON — treat as no modification
    }
  }

  return { rejected: false, stderr: result.stderr, modifiedPayload: null };
};

export const fireTicketHookAsync = (
  deps: Pick<RouteDeps, "reposService">,
  hookName: TicketHookName,
  projectId: string,
  payload: TicketPayload,
) => {
  void fireHook(deps, { hookName, projectId, payload }).catch(() => {});
};
