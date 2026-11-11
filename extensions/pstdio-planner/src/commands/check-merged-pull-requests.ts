import { type CommandContext, defineCommand, defineSchedule } from "@pstdio/sdk/extensions";
import { recordSubmittedMerge } from "../data/attempt-merges";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { listAttempts } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { ticketsCollection } from "../data/collections";
import { markTicketsDone } from "../data/mark-tickets-done";
import { findMergedGithubPrs, linkedPullRequests, readGithubResources } from "../data/pull-request-resources";
import { pullRequestTarget } from "../data/pull-request-target";
import { readMergeDestination } from "../data/workflow-statuses";

const addWorkspacePullRequests = async (
  ctx: CommandContext,
  attempts: AttemptRecord[],
  links: Map<string, Set<string>>,
) => {
  // Preserve discovery from submitted workspace branches; GitHub owns the remote lookup.
  const workspaces = (await ctx.workspaces.list()).filter(
    (workspace) =>
      workspace.branch && attempts.some((attempt) => attempt.workspaceId === workspace.id && attempt.revisions.length),
  );
  for (let offset = 0; offset < workspaces.length; offset += 100) {
    const batch = workspaces.slice(offset, offset + 100);
    try {
      const found = await ctx.commands.execute(findMergedGithubPrs, {
        params: { branches: batch.map((workspace) => workspace.branch!) },
      });
      if (!found.ok) continue;
      for (const pr of found.value) {
        const ids = links.get(pr.id) ?? new Set<string>();
        for (const workspace of batch.filter((workspace) => workspace.branch === pr.branch)) {
          for (const attempt of attempts.filter((attempt) => attempt.workspaceId === workspace.id))
            ids.add(attempt.ticketId);
        }
        links.set(pr.id, ids);
      }
    } catch {
      /* Keep local work usable when GitHub is disabled. */
    }
  }
};

export const checkMergedPullRequestsCommand = defineCommand({
  id: "check-merged-pull-requests",
  title: "Check merged pull requests",
  mutating: true,
  async run(ctx) {
    if ((await ctx.settings.get("tickets.markDoneOnMerge")) === false) return;
    const destination = await readMergeDestination(ctx);
    const [tickets, attempts, retired] = await Promise.all([
      ticketsCollection(ctx).list(),
      listAttempts(ctx.storage),
      readRetiredWorkspaceIds(ctx.storage),
    ]);
    const links = new Map<string, Set<string>>();
    for (const ticket of tickets.filter((ticket) => !ticket.archived)) {
      const resources = await linkedPullRequests(ctx, ticket);
      if (!resources) continue;
      for (const link of resources) {
        const ids = links.get(link.id) ?? new Set<string>();
        ids.add(ticket.id);
        links.set(link.id, ids);
      }
    }
    await addWorkspacePullRequests(ctx, attempts, links);
    const mergedIds = new Set<string>();
    const target = await pullRequestTarget(ctx);
    if (!target) return { reason: "The Git delivery target is unavailable." };
    for (const pr of await readGithubResources(ctx, [...links.keys()])) {
      if (
        "error" in pr ||
        pr.state !== "MERGED" ||
        !pr.mergeCommit?.oid ||
        pr.baseRefName !== target.branch ||
        !pr.id.startsWith(`${target.repository}/pull/`)
      )
        continue;
      for (const attempt of attempts) {
        if (
          retired.has(attempt.workspaceId) ||
          !links.get(pr.id)?.has(attempt.ticketId) ||
          attempt.revisions.at(-1)?.headSha !== pr.headRefOid
        )
          continue;
        await recordSubmittedMerge(ctx, attempt, pr.mergeCommit.oid);
        mergedIds.add(attempt.ticketId);
      }
    }
    await markTicketsDone(ctx, [...mergedIds]);
    return destination.status ? undefined : { reason: destination.reason };
  },
});
export const mergedPullRequestsSchedule = defineSchedule({
  id: "check-merged-pull-requests",
  title: "Check merged pull requests",
  schedule: "*/5 * * * *",
  command: checkMergedPullRequestsCommand.ref,
});
