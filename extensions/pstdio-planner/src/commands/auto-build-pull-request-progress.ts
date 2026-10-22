import type { CommandContext } from "@pstdio/sdk/extensions";
import { attemptEventsCollection } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { statusesCollection } from "../data/collections";
import type { StoredTicket } from "../data/types";
import { parseWorkflowStatuses } from "../data/workflow-statuses";
import { WorkspaceUnavailableError, workspaceHead } from "./change-requests";
import { pullRequestRepairKey, pullRequestRepairReason, readPullRequestEvidence } from "./pull-request-evidence";

export async function hasPendingPullRequestRepair(ctx: CommandContext, ticket: StoredTicket, attempt: AttemptRecord) {
  const revision = attempt.revisions.at(-1);
  if (!revision || !ticket.reviewLinks?.some((link) => link.provider === "github" && link.kind === "pull_request"))
    return false;
  const completed = parseWorkflowStatuses((await ctx.settings.all())["workflow.statuses"]).completedStatusIds;
  if (
    ticket.statusId &&
    completed.includes(ticket.statusId) &&
    (await statusesCollection(ctx.storage).get(ticket.statusId))
  )
    return false;
  const pr = await readPullRequestEvidence(ctx, ticket, revision.headSha);
  if (!pullRequestRepairReason(pr, revision.headSha)) return false;
  const head = await workspaceHead(ctx, attempt.workspaceId).catch((error: unknown) => {
    if (error instanceof WorkspaceUnavailableError) return undefined;
    throw error;
  });
  if (!head) return false;
  // The existing repair event is also the receipt for this exact external evidence.
  return !(await attemptEventsCollection(ctx.storage).get(pullRequestRepairKey(attempt.workspaceId, head, pr)));
}
