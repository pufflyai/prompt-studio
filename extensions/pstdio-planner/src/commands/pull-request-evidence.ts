import type { CommandContext } from "@pstdio/sdk/extensions";
import type { StoredTicket } from "../data/types";

const readLinkedPullRequest = async (ctx: Pick<CommandContext, "process">, url: string) => {
  const result = await ctx.process.run({
    command: ["gh", "pr", "view", url, "--json", "headRefOid,mergeable,statusCheckRollup,state,mergeCommit"],
  });
  if (result.exitCode !== 0) return { error: result.stderr.trim() || "Pull request evidence is unavailable." };
  try {
    const value = JSON.parse(result.stdout) as {
      headRefOid: string;
      mergeable: string;
      state: string;
      mergeCommit?: { oid: string } | null;
      statusCheckRollup?: { status?: string; conclusion?: string; state?: string }[];
    };
    if (!value.headRefOid || !value.state) throw new Error("Missing pull request identity");
    return value;
  } catch {
    return { error: "Pull request evidence is unreadable." };
  }
};

export const readPullRequestEvidence = async (
  ctx: Pick<CommandContext, "process">,
  ticket: StoredTicket,
  expectedHead?: string,
) => {
  const links = ticket.reviewLinks?.filter((link) => link.provider === "github" && link.kind === "pull_request") ?? [];
  if (!links.length) return null;
  const evidence = await Promise.all(links.map((link) => readLinkedPullRequest(ctx, link.url)));
  const matched = evidence.filter((pr) => !("error" in pr) && pr.headRefOid === expectedHead);
  if (matched.length === 1) return matched[0]!;
  if (evidence.length === 1) return evidence[0]!;
  if (matched.length > 1) {
    const current = matched.filter((pr): pr is Exclude<typeof pr, { error: string }> => !("error" in pr));
    const first = current[0]!;
    const sameMerge = current.every((pr) => pr.state === "MERGED" && pr.mergeCommit?.oid === first.mergeCommit?.oid);
    return {
      ...first,
      state: sameMerge ? "MERGED" : "OPEN",
      mergeCommit: sameMerge ? first.mergeCommit : null,
      mergeable: current.some((pr) => pr.mergeable === "CONFLICTING") ? "CONFLICTING" : first.mergeable,
      statusCheckRollup: current.flatMap((pr) => pr.statusCheckRollup ?? []),
    };
  }
  const failure = evidence.find((pr) => "error" in pr);
  return failure ?? { error: "No linked PR matches the current submitted revision." };
};

export const pullRequestRepairReason = (
  pr: Awaited<ReturnType<typeof readPullRequestEvidence>>,
  submittedHead: string,
) => {
  if (!pr || "error" in pr) return "";
  if (pr.headRefOid !== submittedHead)
    return "PR and submitted revision heads differ. Reconcile and validate the resulting head.";
  if (pr.mergeable === "CONFLICTING")
    return "The PR has a merge conflict. Repair it in this workspace and rerun required validation and latest-head CI.";
  const failed = pr.statusCheckRollup?.some((check) =>
    ["FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"].includes(check.conclusion ?? check.state ?? ""),
  );
  return failed ? "CI failed on the submitted PR head. Fix the cause and satisfy the task's latest-head checks." : "";
};

export const pullRequestRepairKey = (
  workspaceId: string,
  head: string,
  evidence: Awaited<ReturnType<typeof readPullRequestEvidence>>,
) => `repair:${workspaceId}:${head}:${JSON.stringify(evidence)}`;
