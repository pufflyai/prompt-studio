import { type CommandContext, defineCommand, defineSchedule } from "@pstdio/sdk/extensions";
import { recordSubmittedMerge } from "../data/attempt-merges";
import { readTicketAttempts, readWorkspaceEvents } from "../data/attempt-queries";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import type { AttemptRecord } from "../data/attempt-types";
import { ticketsCollection } from "../data/collections";
import { githubReviewLinks, readGithubMerge } from "../data/github-merges";
import { linkedWorkspacePages, workspaceTicketLinks } from "../data/linked-workspaces";
import { markTicketsDone } from "../data/mark-tickets-done";
import { mergeTicketPages } from "../data/merge-ticket-query";
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
    const root = await ctx.workspaces.getDefault();
    const cwd = root?.root_path ?? undefined;
    for await (const metadata of mergeTicketPages(ctx.storage)) {
      const current = await readTicketAttempts(
        ctx.storage,
        metadata.map(({ id }) => id),
      );
      const workspaceIds = current.map(({ workspaceId }) => workspaceId);
      const [events, retired] = await Promise.all([
        readWorkspaceEvents(ctx.storage, workspaceIds, "attempt_merged"),
        readRetiredWorkspaceIds(ctx.storage, workspaceIds),
      ]);
      const attempts = current.filter(({ workspaceId }) => !retired.has(workspaceId));
      const recordedHeads = new Set(events.map((event) => event.metadata.headSha));
      const unrecorded = new Set(
        attempts
          .filter((attempt) => {
            const head = attempt.revisions.at(-1)?.headSha;
            return head && !recordedHeads.has(head);
          })
          .map(({ ticketId }) => ticketId),
      );
      const eligible = metadata.filter(
        (ticket) => ticket.statusId !== destination.status?.id || unrecorded.has(ticket.id),
      );
      if (!eligible.length) continue;
      // Bodies are needed only for the selected page's linked PRs; other tickets remain projections.
      const tickets = (
        await Promise.all(
          eligible.filter(({ hasReviewLinks }) => hasReviewLinks).map(({ id }) => ticketsCollection(ctx).get(id)),
        )
      ).filter((ticket) => ticket !== undefined);
      const mergedIds = new Set<string>();
      const checks: MergeCheck[] = [];
      for (const [url, ids] of githubReviewLinks(tickets))
        checks.push({
          ids,
          command: ["gh", "pr", "view", url, "--json", "state,mergeCommit,headRefOid"],
          parse: (output) => {
            const value = JSON.parse(output);
            return value.state === "MERGED" ? mergeDetails(value) : null;
          },
        });
      checks.push(...(await workspaceMergeChecks(ctx, eligible, cwd)));
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
      await markTicketsDone(ctx, [...mergedIds]);
    }
    return destination.status ? undefined : { reason: destination.reason };
  },
});

export const mergedPullRequestsSchedule = defineSchedule({
  id: "check-merged-pull-requests",
  title: "Check merged pull requests",
  schedule: "*/5 * * * *",
  command: checkMergedPullRequestsCommand.ref,
});

interface MergeCheck {
  ids: string[];
  command: string[];
  parse: (output: string) => ReturnType<typeof mergeDetails> | null;
}
const workspaceMergeChecks = async (
  ctx: CommandContext,
  eligible: Parameters<typeof linkedWorkspacePages>[1],
  cwd?: string,
) => {
  const checks: MergeCheck[] = [];
  const activeIds = new Set(eligible.map(({ id }) => id));
  for await (const workspaces of linkedWorkspacePages(ctx, eligible))
    for (const workspace of workspaces) {
      if (!cwd || !workspace.branch) continue;
      const ids: string[] = [];
      for await (const anchor of workspaceTicketLinks(ctx, workspace.id))
        if (activeIds.has(anchor.id) && (!anchor.extensionId || anchor.extensionId === ctx.extensionId))
          ids.push(anchor.id);
      if (!ids.length) continue;
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

  return checks;
};
