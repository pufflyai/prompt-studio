import { defineCommand, defineSchedule } from "@pstdio/sdk/extensions";

// The Merge queue removals workflow (.github/workflows/merge-queue-removals.yml) owns this label.
const REMOVED_LABEL = "removed-from-queue";

interface RemovedPull {
  number: number;
  headRefName: string;
  url: string;
  isCrossRepository: boolean;
  timelineItems: { nodes: Array<{ createdAt: string }> };
}

// A repair's own push must not start another repair for the same queue removal.
const sessionTitle = (pull: RemovedPull, removedAt: string) =>
  `Repair merge queue removal: #${pull.number} at ${removedAt}`;

const removedPullsQuery = `query($owner: String!, $name: String!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 100, after: $endCursor, states: OPEN, labels: ["${REMOVED_LABEL}"]) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number headRefName url isCrossRepository
        timelineItems(last: 1, itemTypes: [REMOVED_FROM_MERGE_QUEUE_EVENT]) {
          nodes { ... on RemovedFromMergeQueueEvent { createdAt } }
        }
      }
    }
  }
}`;

const repairPrompt = (pull: RemovedPull) =>
  [
    `GitHub removed pull request #${pull.number} (${pull.url}) from the merge queue. This workspace starts at its branch \`${pull.headRefName}\`.`,
    "Read the newest merge queue removal comment on the pull request. It names the reason and, for failed checks, the failed merge group run and jobs.",
    "Follow CLAUDE.md. Reproduce each failure before changing code, fix its cause, and run the affected tests and checks locally.",
    `Push the fix to the pull request with \`git push origin HEAD:${pull.headRefName}\`, then wait for its CI and fix any new failure.`,
    "If a failure is not caused by this pull request, do not change the pull request to hide it: find or create the ticket for that check and report it.",
    "For a merge conflict, rebase the branch onto the latest main and resolve the conflicts.",
    "Never raise a timeout or budget, skip a test, or add retries. Report what you changed and whether the pull request is ready to queue again.",
  ].join("\n");

export const repairRemovedCommand = defineCommand({
  id: "merge-queue.repair-removed",
  title: "Repair pull requests removed from the merge queue",
  async run(ctx) {
    const root = (await ctx.workspaces.getDefault())?.root_path;
    if (!root) throw new Error("The default workspace has no repository folder.");
    const { stdout } = await ctx.process.runOrThrow({
      command: [
        "gh",
        "api",
        "graphql",
        "--paginate",
        "--slurp",
        "-F",
        "owner={owner}",
        "-F",
        "name={repo}",
        "-f",
        `query=${removedPullsQuery}`,
      ],
      cwd: root,
    });
    const pages = JSON.parse(stdout) as Array<{
      data: { repository: { pullRequests: { nodes: RemovedPull[] } } };
    }>;
    const pulls = pages.flatMap((page) => page.data.repository.pullRequests.nodes);
    if (!pulls.some((pull) => !pull.isCrossRepository)) return { sessionIds: [] };
    const started = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await ctx.sessions.query({ includeArchived: true, cursor });
      for (const session of page.items) started.add(session.title);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    const sessionIds: string[] = [];
    const failures: string[] = [];
    for (const pull of pulls) {
      // A fork's branch cannot be pushed from here.
      if (pull.isCrossRepository) continue;
      try {
        const removedAt = pull.timelineItems.nodes[0]?.createdAt;
        if (!removedAt) throw new Error("The pull request has no merge queue removal event.");
        const title = sessionTitle(pull, removedAt);
        if (started.has(title)) continue;
        await ctx.process.runOrThrow({ command: ["git", "fetch", "origin", pull.headRefName], cwd: root });
        const workspace = await ctx.workspaces.create({
          shorthand_base: `PR-${pull.number}`,
          provider_id: "pstdio.worktree",
          params: { base: `origin/${pull.headRefName}` },
        });
        const session = await ctx.sessions.create({
          title,
          prompt: repairPrompt(pull),
          workspaceId: workspace.id,
        });
        sessionIds.push(session.id);
      } catch (error) {
        failures.push(`#${pull.number}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (failures.length) throw new Error(`Could not start merge queue repairs:\n${failures.join("\n")}`);
    return { sessionIds };
  },
});

export const repairRemovedSchedule = defineSchedule({
  id: "merge-queue-repair",
  title: "Repair pull requests removed from the merge queue",
  schedule: "*/5 * * * *",
  command: repairRemovedCommand.ref,
});
