import type { CommandContext } from "@pstdio/sdk/extensions";
import { findPendingPrerequisites } from "../data/attempt-readiness";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { attemptSelectionsCollection, listAttempts } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { ticketsCollection } from "../data/collections";
import { hasPendingImplementationInput } from "../data/implementation-input";
import { prerequisiteClosure } from "../data/prerequisite-closure";
import { listTicketReviewRequests, readTicketReviewRequests } from "../data/review-request-storage";
import type { StoredTicket } from "../data/types";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../data/workflow-statuses";
import { isLiveSession } from "./auto-build-sessions";
import { readPullRequestEvidence } from "./pull-request-evidence";

export const readDependencyHeads = async (ctx: CommandContext, ticketId: string) => {
  const [tickets, attempts, selections, retired, workflow] = await Promise.all([
    ticketsCollection(ctx.storage).list(),
    listAttempts(ctx.storage),
    attemptSelectionsCollection(ctx.storage).list(),
    readRetiredWorkspaceIds(ctx.storage),
    readWorkflowStatuses(ctx),
  ]);
  const ticket = tickets.find((ticket) => ticket.id === ticketId);
  const completed = usableWorkflowStatuses(workflow).completedStatusIds;
  const heads: { workspaceId: string; headSha: string }[] = [];
  if (!ticket) throw new Error("Ticket is missing.");
  const byRef = new Map(
    tickets.flatMap((t) => [
      [t.id, t],
      [t.shorthand, t],
    ]),
  );
  const completedFrontier: StoredTicket[] = [];
  const closure = prerequisiteClosure(ticket, byRef, (dependency) => {
    const done = completed.includes(dependency.statusId ?? "");
    if (done) completedFrontier.push(dependency);
    return done;
  });
  if (closure.missing) throw new Error(`Dependency ${closure.missing} is missing.`);
  if (closure.cycle) throw new Error(`Dependency cycle includes ${closure.cycle}.`);
  if (findPendingPrerequisites(ticket, byRef, await readTicketReviewRequests(ctx.storage)).length)
    throw new Error("Dependency needs implementation input.");
  for (const dependency of completedFrontier) {
    const selected = selections.find((s) => s.ticketId === dependency.id);
    const variants = attempts.filter(
      (a) =>
        a.ticketId === dependency.id &&
        !retired.has(a.workspaceId) &&
        a.revisions.length &&
        (!selected || a.workspaceId === selected.workspaceId),
    );
    if (variants.length !== 1) continue;
    const variant = variants[0]!;
    const head = variant.revisions.at(-1)!.headSha;
    const pr = await readPullRequestEvidence(ctx, dependency, head);
    if (pr && !("error" in pr) && pr.state === "MERGED" && pr.headRefOid === head && pr.mergeCommit?.oid)
      heads.push({ workspaceId: variant.workspaceId, headSha: pr.mergeCommit.oid });
  }
  for (const dependency of closure.tickets) {
    const selection = selections.find((candidate) => candidate.ticketId === dependency.id);
    const variants = attempts.filter(
      (candidate) =>
        candidate.ticketId === dependency.id &&
        candidate.revisions.length &&
        !retired.has(candidate.workspaceId) &&
        (!selection || selection.workspaceId === candidate.workspaceId),
    );
    if (variants.length !== 1)
      throw new Error(`Dependency ${dependency.shorthand} needs one selected submitted variant.`);
    const variant = variants[0]!;
    if (
      isLiveSession(await ctx.sessions.get(variant.implementationSessionId)) ||
      (await ctx.sessions.listByWorkspace(variant.workspaceId)).some(isLiveSession)
    )
      throw new Error(`Dependency ${dependency.shorthand} is still changing.`);
    let headSha = variant.revisions.at(-1)!.headSha;
    const pr = await readPullRequestEvidence(ctx, dependency, headSha);
    if (pr && !("error" in pr) && pr.state === "MERGED" && pr.headRefOid === headSha && pr.mergeCommit?.oid)
      headSha = pr.mergeCommit.oid;
    heads.push({ workspaceId: variant.workspaceId, headSha });
  }
  return heads;
};

export const validateSubmittedStack = async (
  ctx: CommandContext,
  attempt: AttemptRecord,
  path: string,
  headSha: string,
) => {
  const ancestry = await ctx.process.run({
    command: ["git", "-C", path, "merge-base", "--is-ancestor", attempt.base.headSha, headSha],
  });
  if (ancestry.exitCode !== 0) throw new Error("Workspace HEAD must contain the recorded stack base.");
  if (hasPendingImplementationInput(await listTicketReviewRequests(ctx.storage, attempt.ticketId)))
    throw new Error("Resolve implementation input before submitting a handoff.");
  for (const dependency of await readDependencyHeads(ctx, attempt.ticketId)) {
    const result = await ctx.process.run({
      command: ["git", "-C", path, "merge-base", "--is-ancestor", dependency.headSha, attempt.base.headSha],
    });
    if (result.exitCode !== 0)
      throw new Error(
        `Stack base must contain current dependency commit ${dependency.headSha}. Integrate, validate, and record it with update-stack.`,
      );
  }
};
