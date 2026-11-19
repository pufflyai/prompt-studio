import type { CommandContext } from "@pstdio/sdk/extensions";
import { type GithubReads, linkedPullRequests, readGithubResources } from "../data/pull-request-resources";
import type { Ticket } from "../data/types";

export const readPullRequestEvidence = async (
  ctx: CommandContext,
  ticket: Ticket,
  expectedHead?: string,
  reads?: GithubReads,
) => {
  const links = await linkedPullRequests(ctx, ticket);
  if (!links)
    return { error: "Saved pull request links could not be migrated. Restore GitHub and resource linking access." };
  if (!links.length) return null;
  const evidence = await readGithubResources(
    ctx,
    links.map((link) => link.id),
    reads,
  );
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
  return evidence.find((pr) => "error" in pr) ?? { error: "No linked PR matches the current submitted revision." };
};

export const pullRequestRepairReason = (
  pr:
    | { headRefOid: string; mergeable: string; statusCheckRollup?: { conclusion?: string; state?: string }[] }
    | { error: string }
    | null,
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

export const pullRequestRepairKey = (workspaceId: string, head: string, evidence: unknown) =>
  `repair:${workspaceId}:${head}:${JSON.stringify(evidence)}`;
