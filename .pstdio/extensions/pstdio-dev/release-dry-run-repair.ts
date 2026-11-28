import { defineCommand, defineSchedule } from "@pstdio/sdk/extensions";

// Release Packages names verify runs `Release Packages · verify <candidate sha>`. The twice-daily
// Release Dry Run workflow (.github/workflows/release-dry-run.yml) dispatches them.
const VERIFY_TITLE = "Release Packages · verify ";
const REPAIR_TITLE = "Repair release dry run: ";
const ESCALATE_TITLE = "Escalate release dry run: ";
// A check that failed this many dry runs in a row, with a repair after each, goes to a person.
const PERSISTENT_RUNS = 3;
const ACTIVE = ["in_progress", "awaiting_input", "queued"] as const;
// Summary jobs only repeat the failures of the jobs they gate.
const SUMMARY_JOB = /(^|\/ )(validation_results|production_ci_passed|ci_passed|certify)$/;

interface VerifyRun {
  databaseId: number;
  displayTitle: string;
  status: string;
  conclusion: string;
  url: string;
}

interface RunJob {
  name: string;
  conclusion: string;
}

const repairPrompt = (run: VerifyRun, failed: string[], escalated: string[]) =>
  [
    `The release dry run ${run.url} failed. It verified the Changesets version candidate ${run.displayTitle.slice(VERIFY_TITLE.length)} with every release-only check and published nothing. This workspace starts at origin/main.`,
    `Failed, cancelled or timed-out jobs:\n${failed.map((job) => `- ${job}`).join("\n")}`,
    escalated.length
      ? `A person already owns these persistent failures; leave them alone:\n${escalated.map((job) => `- ${job}`).join("\n")}`
      : "",
    "Use the fix-release-pipeline skill in loop mode. Read the run's validation_results output too, because it can list failures no job is marked failed for.",
    "Fix every failure in this one pull request. Reproduce each failure before changing code and fix its cause. Run the failed checks locally through their owning runners, sending native desktop tests to CI as 005.9.8 describes.",
    "Before fixing a failed test, compare it with the previous dry runs of Release Packages. If it passed in another dry run and neither the test nor the code it covers changed between the two candidates, it is a flake: quarantine it under ADR 0101 with both run links, an owner and removal criteria, or delete it when it has no clear owner. Do not change product code for a flake.",
    "Follow CLAUDE.md and the timeout policy in documentation/guidance/0004-ci.md, rules 0004.3.3 and 0004.3.4. Do not skip a test, add retries, or change a benchmark budget or benchmark execution allowance.",
    "Open the pull request, drive its CI green, get an independent review, and merge it. Never merge or queue a pull request labeled `benchmark`; leave it for a person.",
    "After the merge, wait until the head of changeset-release/main is a Version Packages commit built on your merge commit or a later main commit, then start exactly one confirmation run with `gh workflow run release-dry-run.yml --ref main`. Never dispatch a stable release.",
    "Report what you fixed, what you quarantined or deleted, and the confirmation run.",
  ]
    .filter(Boolean)
    .join("\n\n");

const escalationPrompt = (runs: VerifyRun[], checks: string[]) =>
  [
    `These release dry run checks failed ${runs.length} times in a row, with a repair attempt after each failure:`,
    checks.map((job) => `- ${job}`).join("\n"),
    `Runs:\n${runs.map((run) => `- ${run.url}`).join("\n")}`,
    "Do not change code. Read the runs and the repair sessions titled with these run IDs. Find or create one planner bug ticket for these checks with the evidence: failing tests, error excerpts, what each repair changed and why it did not hold.",
    "Then ask the maintainer for a decision with `pst pstdio.planner request-review` on that ticket: fix with a named approach, quarantine, or delete the test. Keep the request under 80 words with links to the runs.",
  ].join("\n\n");

const failedJobs = async (run: (args: string[]) => Promise<string>, id: number) => {
  const { jobs } = JSON.parse(await run(["gh", "run", "view", String(id), "--json", "jobs"])) as { jobs: RunJob[] };
  return jobs
    .filter((job) => ["failure", "cancelled", "timed_out"].includes(job.conclusion) && !SUMMARY_JOB.test(job.name))
    .map((job) => job.name)
    .sort();
};

export const repairDryRunCommand = defineCommand({
  id: "release-dry-run.repair",
  title: "Repair the latest failed release dry run",
  async run(ctx) {
    const root = (await ctx.workspaces.getDefault())?.root_path;
    if (!root) throw new Error("The default workspace has no repository folder.");
    const run = async (command: string[]) => (await ctx.process.runOrThrow({ command, cwd: root })).stdout;
    // Search matches substrings, so an exact title needs a second check.
    const sessionExists = async (title: string, active = false) =>
      (
        await ctx.sessions.query({
          search: title,
          includeArchived: !active,
          status: active ? [...ACTIVE] : undefined,
          limit: 200,
        })
      ).items.some((session) => (active ? session.title.startsWith(title) : session.title === title));

    const listed = JSON.parse(
      await run([
        "gh",
        "run",
        "list",
        "--workflow",
        "release-packages.yml",
        "--event",
        "workflow_dispatch",
        "--limit",
        "100",
        "--json",
        "databaseId,displayTitle,status,conclusion,url",
      ]),
    ) as VerifyRun[];
    // Newest first. Cancelled runs say nothing about the candidate. A newest run that is still going,
    // including a rerun of a failed one, supersedes every older failure.
    const verifyRuns = listed.filter(
      (item) => item.displayTitle.startsWith(VERIFY_TITLE) && item.conclusion !== "cancelled",
    );
    const latest = verifyRuns[0];
    if (!latest || latest.status !== "completed" || latest.conclusion === "success") return { sessionIds: [] };
    const runs = verifyRuns.filter((item) => item.status === "completed");
    // One repair at a time: a newer failure waits until the current repair ends, then supersedes older runs.
    if ((await sessionExists(REPAIR_TITLE, true)) || (await sessionExists(ESCALATE_TITLE, true)))
      return { sessionIds: [] };
    const repairTitle = `${REPAIR_TITLE}${latest.databaseId}`;
    if (await sessionExists(repairTitle)) return { sessionIds: [] };

    const failed = await failedJobs(run, latest.databaseId);
    const firstGreen = runs.findIndex((item) => item.conclusion === "success");
    const red = firstGreen === -1 ? runs : runs.slice(0, firstGreen);
    const streak = red.slice(0, PERSISTENT_RUNS);
    let persistent: string[] = [];
    // Escalate only after a repair followed each earlier failure in the streak.
    const repaired = await Promise.all(
      streak.slice(1).map((item) => sessionExists(`${REPAIR_TITLE}${item.databaseId}`)),
    );
    if (streak.length === PERSISTENT_RUNS && repaired.every(Boolean)) {
      persistent = failed;
      for (const earlier of streak.slice(1)) {
        const earlierFailed = new Set(await failedJobs(run, earlier.databaseId));
        persistent = persistent.filter((job) => earlierFailed.has(job));
      }
    }

    await run(["git", "fetch", "origin", "main"]);
    const workspace = async () =>
      ctx.workspaces.create({
        shorthand_base: "RELEASE",
        provider_id: "pstdio.worktree",
        params: { base: "origin/main" },
      });
    if (persistent.length) {
      // One escalation per red streak: a later streak of the same failures escalates again.
      const title = `${ESCALATE_TITLE}${persistent.join(", ")} (red since run ${red.at(-1)?.databaseId})`;
      if (!(await sessionExists(title))) {
        const session = await ctx.sessions.create({
          title,
          prompt: escalationPrompt(streak, persistent),
          workspaceId: (await workspace()).id,
        });
        return { sessionIds: [session.id] };
      }
    }
    const remaining = failed.filter((job) => !persistent.includes(job));
    // Every failure is already with a person.
    if (!remaining.length && persistent.length) return { sessionIds: [] };
    const session = await ctx.sessions.create({
      title: repairTitle,
      prompt: repairPrompt(
        latest,
        remaining.length ? remaining : ["(no job failed; read validation_results)"],
        persistent,
      ),
      workspaceId: (await workspace()).id,
    });
    return { sessionIds: [session.id] };
  },
});

// Ships disabled like merge-queue-repair, so other clones of this repository never start agents.
export const repairDryRunSchedule = defineSchedule({
  id: "release-dry-run-repair",
  title: "Repair failed release dry runs",
  schedule: "*/10 * * * *",
  command: repairDryRunCommand.ref,
  disabled: true,
});
