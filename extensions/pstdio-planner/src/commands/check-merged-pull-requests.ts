import { defineCommand, defineSchedule } from "@pstdio/sdk/extensions";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { attemptSelectionsCollection, listAttempts } from "../data/attempt-storage";
import { ticketsCollection } from "../data/collections";
import { githubReviewLinks, readGithubMerge } from "../data/github-merges";
import { markTicketsDone } from "../data/mark-tickets-done";
import { readMergeDestination } from "../data/workflow-statuses";
import { isLiveSession } from "./auto-build-sessions";
import { workspaceHead } from "./change-requests";

export const checkMergedPullRequestsCommand = defineCommand({
  id: "check-merged-pull-requests",
  title: "Check merged pull requests",
  mutating: true,
  async run(ctx) {
    if ((await ctx.settings.get("tickets.markDoneOnMerge")) === false) return;
    const { status: done, reason } = await readMergeDestination(ctx);
    if (!done) return { reason };
    const tickets = (await ticketsCollection(ctx.storage).list()).filter(
      (ticket) => !ticket.archived && ticket.statusId !== done.id,
    );
    if (!tickets.length) return;
    const root = await ctx.workspaces.getDefault();
    const cwd = root?.root_path ?? undefined;
    const mergedIds = new Set<string>();
    const [attempts, selections, retired] = await Promise.all([
      listAttempts(ctx.storage),
      attemptSelectionsCollection(ctx.storage).list(),
      readRetiredWorkspaceIds(ctx.storage),
    ]);
    const expectedHeads = new Map<string, string | null>();
    for (const ticket of tickets) {
      const selection = selections.find((s) => s.ticketId === ticket.id);
      const variants = attempts.filter(
        (a) =>
          a.ticketId === ticket.id &&
          !retired.has(a.workspaceId) &&
          (!selection || a.workspaceId === selection.workspaceId),
      );
      if (!variants.length) continue;
      const variant = variants[0]!;
      const head = variant.revisions.at(-1)?.headSha;
      const live =
        isLiveSession(await ctx.sessions.get(variant.implementationSessionId)) ||
        (await ctx.sessions.listByWorkspace(variant.workspaceId)).some(isLiveSession);
      if (variants.length !== 1 || !head || live || (await workspaceHead(ctx, variant.workspaceId)) !== head)
        expectedHeads.set(ticket.id, null);
      else expectedHeads.set(ticket.id, head);
    }
    const checks: Array<{ ids: string[]; command: string[]; isMerged: (output: string, id: string) => boolean }> = [];
    // URLs include the repository, so linked PRs can belong to another repository.
    for (const [url, ids] of githubReviewLinks(tickets)) {
      checks.push({
        ids,
        command: ["gh", "pr", "view", url, "--json", "state,headRefOid,mergeCommit"],
        isMerged: (output, id) => {
          const pr = JSON.parse(output);
          return pr.state === "MERGED" && (!expectedHeads.has(id) || expectedHeads.get(id) === pr.headRefOid);
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
          "number,headRefOid,mergeCommit",
        ],
        isMerged: (output, id) =>
          JSON.parse(output).some(
            (pr: { headRefOid: string }) => !expectedHeads.has(id) || expectedHeads.get(id) === pr.headRefOid,
          ),
      });
    }
    // Bound parallel GitHub processes so larger projects do not wait on every network round trip in sequence.
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(8, checks.length) }, async () => {
        while (next < checks.length) {
          const check = checks[next++]!;
          let output = "";
          if (
            await readGithubMerge(ctx, check.command, cwd, (text) => {
              output = text;
              return true;
            })
          )
            for (const id of check.ids) if (check.isMerged(output, id)) mergedIds.add(id);
        }
      }),
    );
    await markTicketsDone(ctx, [...mergedIds]);
  },
});

export const mergedPullRequestsSchedule = defineSchedule({
  id: "check-merged-pull-requests",
  title: "Check merged pull requests",
  schedule: "*/5 * * * *",
  command: checkMergedPullRequestsCommand.ref,
});
