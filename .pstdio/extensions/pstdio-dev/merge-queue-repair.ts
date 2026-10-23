import { defineCommand, defineSchedule } from "@pstdio/sdk/extensions";

// The Merge queue removals workflow (.github/workflows/merge-queue-removals.yml) owns this label.
const REMOVED_LABEL = "removed-from-queue";

interface RemovedPull {
  number: number;
  headRefName: string;
  headRefOid: string;
  url: string;
  isCrossRepository: boolean;
}

// The title names the head commit, so the existing session list records which removals already
// have a repair. A failed repair stays handled until someone pushes a new commit.
const sessionTitle = (pull: RemovedPull) =>
  `Repair merge queue removal: #${pull.number} at ${pull.headRefOid.slice(0, 9)}`;

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
        "pr",
        "list",
        "--state",
        "open",
        "--label",
        REMOVED_LABEL,
        "--json",
        "number,headRefName,headRefOid,url,isCrossRepository",
      ],
      cwd: root,
    });
    const started = new Set((await ctx.sessions.list()).map((session) => session.title));
    const sessionIds: string[] = [];
    for (const pull of JSON.parse(stdout) as RemovedPull[]) {
      // A fork's branch cannot be pushed from here.
      if (pull.isCrossRepository || started.has(sessionTitle(pull))) continue;
      await ctx.process.runOrThrow({ command: ["git", "fetch", "origin", pull.headRefName], cwd: root });
      const workspace = await ctx.workspaces.create({
        shorthand_base: `PR-${pull.number}`,
        provider_id: "pstdio.worktree",
        params: { base: `origin/${pull.headRefName}` },
      });
      const session = await ctx.sessions.create({
        title: sessionTitle(pull),
        prompt: repairPrompt(pull),
        workspaceId: workspace.id,
      });
      sessionIds.push(session.id);
    }
    return { sessionIds };
  },
});

export const repairRemovedSchedule = defineSchedule({
  id: "merge-queue-repair",
  title: "Repair pull requests removed from the merge queue",
  schedule: "*/5 * * * *",
  command: repairRemovedCommand.ref,
});
