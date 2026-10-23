import { type CommandContext, defineCommand, defineSchedule } from "@pstdio/sdk/extensions";
import { recordSubmittedMerge } from "../data/attempt-merges";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { attemptEventsCollection, listAttempts } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { ticketsCollection } from "../data/collections";
import { githubReviewLinks, readGithubMerge } from "../data/github-merges";
import { markTicketsDone } from "../data/mark-tickets-done";
import { readMergeDestination } from "../data/workflow-statuses";

const mergeDetails = (value: { headRefOid?: string; mergeCommit?: { oid: string } | null }) => ({
  headSha: value.headRefOid ?? null,
  commitSha: value.mergeCommit?.oid ?? null,
});

const recordMerge = async (
  ctx: CommandContext,
  ids: string[],
  attempts: AttemptRecord[],
  merged: ReturnType<typeof mergeDetails>,
) => {
  const matched = ids.filter((id) => {
    const submitted = attempts.filter((attempt) => attempt.ticketId === id && attempt.revisions.length);
    return (
      !merged.headSha ||
      !submitted.length ||
      submitted.some((attempt) => attempt.revisions.at(-1)?.headSha === merged.headSha)
    );
  });
  if (merged.commitSha && merged.headSha) {
    for (const attempt of attempts.filter(
      (attempt) => matched.includes(attempt.ticketId) && attempt.revisions.at(-1)?.headSha === merged.headSha,
    ))
      await recordSubmittedMerge(ctx, attempt, merged.commitSha);
  }
  return matched;
};

export const checkMergedPullRequestsCommand = defineCommand({
  id: "check-merged-pull-requests",
  title: "Check merged pull requests",
  mutating: true,
  async run(ctx) {
    if ((await ctx.settings.get("tickets.markDoneOnMerge")) === false) return;
    // Merge evidence also proves dependency integration, so it is recorded without a merge destination.
    const destination = await readMergeDestination(ctx);
    const [allTickets, current, events, retired] = await Promise.all([
      ticketsCollection(ctx.storage).list(),
      listAttempts(ctx.storage),
      attemptEventsCollection(ctx.storage).list(),
      readRetiredWorkspaceIds(ctx.storage),
    ]);
    const attempts = current.filter(({ workspaceId }) => !retired.has(workspaceId));
    const recordedHeads = new Set(
      events.filter((event) => event.type === "attempt_merged").map((event) => event.metadata.headSha),
    );
    const unrecorded = new Set(
      attempts
        .filter((attempt) => {
          const head = attempt.revisions.at(-1)?.headSha;
          return head && !recordedHeads.has(head);
        })
        .map((attempt) => attempt.ticketId),
    );
    const tickets = allTickets.filter(
      (ticket) => !ticket.archived && (ticket.statusId !== destination.status?.id || unrecorded.has(ticket.id)),
    );
    if (!tickets.length) return destination.status ? undefined : { reason: destination.reason };
    const root = await ctx.workspaces.getDefault();
    const cwd = root?.root_path ?? undefined;
    const mergedIds = new Set<string>();
    const checks: Array<{
      ids: string[];
      command: string[];
      parse: (output: string) => ReturnType<typeof mergeDetails> | null;
    }> = [];
    // URLs include the repository, so linked PRs can belong to another repository.
    for (const [url, ids] of githubReviewLinks(tickets)) {
      checks.push({
        ids,
        command: ["gh", "pr", "view", url, "--json", "state,mergeCommit,headRefOid"],
        parse: (output) => {
          const value = JSON.parse(output);
          return value.state === "MERGED" ? mergeDetails(value) : null;
        },
      });
    }
    const activeIds = new Set(tickets.map((ticket) => ticket.id));
    for (const workspace of await ctx.workspaces.list()) {
      const ids = (workspace.anchors_json ?? [])
        .filter((anchor) => anchor.type === "ticket" && activeIds.has(anchor.id))
        .map((anchor) => anchor.id);
      if (!cwd || !workspace.branch || !ids.length) continue;
      checks.push({
        ids,
        command: [
          "gh",
          "pr",
          "list",
          "--head",
          workspace.branch,
          "--state",
          "merged",
          "--json",
          "mergeCommit,headRefOid",
        ],
        parse: (output) => {
          const [value] = JSON.parse(output);
          return value ? mergeDetails(value) : null;
        },
      });
    }
    // Bound parallel GitHub processes so larger projects do not wait on every network round trip in sequence.
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(8, checks.length) }, async () => {
        while (next < checks.length) {
          const check = checks[next++]!;
          const merged = await readGithubMerge(ctx, check.command, cwd, check.parse);
          if (merged) {
            for (const id of await recordMerge(ctx, check.ids, attempts, merged)) mergedIds.add(id);
          }
        }
      }),
    );
    return markTicketsDone(ctx, [...mergedIds]);
  },
});

export const mergedPullRequestsSchedule = defineSchedule({
  id: "check-merged-pull-requests",
  title: "Check merged pull requests",
  schedule: "*/5 * * * *",
  command: checkMergedPullRequestsCommand.ref,
});
