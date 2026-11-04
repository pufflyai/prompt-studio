import type { CommandContext } from "@pstdio/sdk/extensions";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import type { AttemptRecord } from "../data/attempt-types";
import { readSessionHistory } from "../data/session-history";
import { loadAttemptReadiness } from "./attempt-readiness";
import { isLiveSession } from "./auto-build-sessions";
import { WorkspaceUnavailableError, workspaceHead } from "./change-requests";
import { readRecoveryBase, readRecoverySeed, recoveryOwnerRun } from "./workspace-recovery";

export async function prepareManualRecovery(
  ctx: CommandContext,
  previous: AttemptRecord,
  chosenBase?: string,
  beforeDispatch?: (head?: string) => Promise<void>,
) {
  const owner = await ctx.sessions.get(previous.implementationSessionId);
  if (isLiveSession(owner))
    throw new Error("The previous implementation session is running. Continue its existing owner.");
  const base = await readRecoveryBase(ctx, previous, chosenBase);
  const { readiness } = await loadAttemptReadiness(ctx, previous.ticketId, { base });
  if (readiness.decision === "wait")
    throw new Error(`Cannot recover ${previous.ticketShorthand}: ${readiness.reason}.`);
  const headSha = await readRecoverySeed(ctx, previous, readiness.baseHeadSha);
  const check = async () => {
    await beforeDispatch?.(readiness.baseHeadSha);
    if ((await readRetiredWorkspaceIds(ctx.storage)).has(previous.workspaceId))
      throw new Error("The recovery attempt changed before launch.");
    if ((await readSessionHistory(ctx.sessions, { workspaceId: previous.workspaceId })).some(isLiveSession))
      throw new Error("Another session is using the previous workspace. Wait for its handoff.");
    try {
      await workspaceHead(ctx, previous.workspaceId);
    } catch (error) {
      if (!(error instanceof WorkspaceUnavailableError)) throw error;
      const latest = await loadAttemptReadiness(ctx, previous.ticketId, { base });
      if (JSON.stringify(latest.readiness) !== JSON.stringify(readiness))
        throw new Error("Recovery is no longer ready. Check capacity and dependencies before resuming.");
      return;
    }
    throw new Error("The previous workspace is available again. Resume its existing owner.");
  };
  return {
    base,
    options: {
      beforeDispatch: check,
      recovery: {
        previous,
        headSha,
        detail: "Workspace unavailable during explicit manual resume",
        ...(owner?.last_exit?.cause === "user_stop" ? { resumedStoppedRun: recoveryOwnerRun(owner) } : {}),
      },
    },
  };
}
