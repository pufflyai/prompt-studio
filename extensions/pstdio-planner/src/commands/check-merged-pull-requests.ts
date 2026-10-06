import { defineCommand, defineSchedule } from "@pstdio/sdk/extensions";
import { statusesCollection, ticketsCollection } from "../data/collections";
import { githubReviewLinks, readGithubMerge } from "../data/github-merges";
import { markTicketsDone } from "../data/mark-tickets-done";

export const checkMergedPullRequestsCommand = defineCommand({
  id: "check-merged-pull-requests",
  title: "Check merged pull requests",
  mutating: true,
  async run(ctx) {
    if ((await ctx.settings.get("tickets.markDoneOnMerge")) === false) return;
    const done = (await statusesCollection(ctx.storage).list()).find(
      (status) => status.name.trim().toLowerCase() === "done",
    );
    if (!done) return;
    const tickets = (await ticketsCollection(ctx.storage).list()).filter(
      (ticket) => !ticket.archived && ticket.statusId !== done.id,
    );
    if (!tickets.length) return;
    const root = await ctx.workspaces.getDefault();
    const cwd = root?.root_path ?? undefined;
    const mergedIds = new Set<string>();
    const checks: Array<{ ids: string[]; command: string[]; isMerged: (output: string) => boolean }> = [];
    // URLs include the repository, so linked PRs can belong to another repository.
    for (const [url, ids] of githubReviewLinks(tickets)) {
      checks.push({
        ids,
        command: ["gh", "pr", "view", url, "--json", "state"],
        isMerged: (output) => JSON.parse(output).state === "MERGED",
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
        command: ["gh", "pr", "list", "--head", workspace.branch, "--state", "merged", "--json", "number"],
        isMerged: (output) => JSON.parse(output).length > 0,
      });
    }
    // Bound parallel GitHub processes so larger projects do not wait on every network round trip in sequence.
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(8, checks.length) }, async () => {
        while (next < checks.length) {
          const check = checks[next++]!;
          if (await readGithubMerge(ctx, check.command, cwd, check.isMerged)) {
            for (const id of check.ids) mergedIds.add(id);
          }
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
