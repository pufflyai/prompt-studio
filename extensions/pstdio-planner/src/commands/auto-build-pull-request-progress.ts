import type { CommandContext } from "@pstdio/sdk/extensions";
import { attemptEventsCollection } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { autoBuildPullRequestNotifications } from "../data/auto-build-dispatches";
import { statusesCollection } from "../data/collections";
import type { Ticket } from "../data/types";
import { parseWorkflowStatuses } from "../data/workflow-statuses";
import { WorkspaceUnavailableError, workspaceHead } from "./change-requests";
import { pullRequestRepairKey, pullRequestRepairReason, readPullRequestEvidence } from "./pull-request-evidence";

export async function readPendingPullRequestRepair(ctx: CommandContext, ticket: Ticket, attempt: AttemptRecord) {
  const revision = attempt.revisions.at(-1);
  if (!revision || !ticket.reviewLinks?.some((link) => link.provider === "github" && link.kind === "pull_request"))
    return;
  const completed = parseWorkflowStatuses((await ctx.settings.all())["workflow.statuses"]).completedStatusIds;
  if (
    ticket.statusId &&
    completed.includes(ticket.statusId) &&
    (await statusesCollection(ctx.storage).get(ticket.statusId))
  )
    return;
  const pr = await readPullRequestEvidence(ctx, ticket, revision.headSha);
  if (!pullRequestRepairReason(pr, revision.headSha)) return;
  const head = await workspaceHead(ctx, attempt.workspaceId).catch((error: unknown) => {
    if (error instanceof WorkspaceUnavailableError) return undefined;
    throw error;
  });
  if (!head) return;
  const evidence = pullRequestRepairKey(attempt.workspaceId, head, pr);
  if (!(await attemptEventsCollection(ctx.storage).get(evidence))) return evidence;
}

// Delivery is acknowledged even when human input or capacity prevents accepting a repair.
export async function acknowledgePullRequestNotifications(
  ctx: CommandContext,
  supervisorId: string,
  progress: ({ workspaceId: string; pendingRepair?: string } | undefined)[],
) {
  const receipts = autoBuildPullRequestNotifications(ctx, supervisorId);
  for (const work of progress) {
    if (work?.pendingRepair) await receipts.put(work.workspaceId, { evidenceKey: work.pendingRepair });
  }
}
