import type { CommandContext } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import {
  appendAttemptEvent,
  attemptEventsCollection,
  attemptSelectionsCollection,
  readAttempt,
} from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { resolveImplementationBase } from "../data/implementation-targets";
import { findTicket } from "../data/resolve";
import { isLiveSession } from "./auto-build-sessions";

export interface WorkspaceRecovery {
  previous: AttemptRecord;
  headSha: string;
  detail: string;
}

export async function readRecoveryBase(ctx: CommandContext, attempt: AttemptRecord, base?: string) {
  const home = await ctx.workspaces.getDefault();
  if (!home?.root_path) throw new Error("Attach a Git project folder before recovering work.");
  const previous = await ctx.process.run({
    command: [
      "git",
      "-C",
      home.root_path,
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${base ?? attempt.base.headSha}^{commit}`,
    ],
  });
  if (previous.exitCode === 0) return previous.stdout.trim();
  if (base) throw new Error(previous.stderr.trim() || "The requested recovery base is unavailable.");
  const target = await resolveImplementationBase(ctx, await ctx.settings.all());
  const resolved = await ctx.process.run({
    command: ["git", "-C", home.root_path, "rev-parse", "--verify", "--end-of-options", `${target}^{commit}`],
  });
  if (resolved.exitCode !== 0) throw new Error(resolved.stderr.trim() || "The project target is unavailable.");
  return resolved.stdout.trim();
}

export async function readRecoverySeed(ctx: CommandContext, attempt: AttemptRecord, requiredBase: string) {
  const [workspace, home] = await Promise.all([ctx.workspaces.get(attempt.workspaceId), ctx.workspaces.getDefault()]);
  if (!home?.root_path) throw new Error("Attach a Git project folder before recovering work.");
  const events = (await attemptEventsCollection(ctx.storage).list())
    .filter(({ workspaceId }) => workspaceId === attempt.workspaceId)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  // The surviving branch may contain work newer than the last submitted revision.
  for (const ref of [
    workspace?.branch,
    attempt.revisions.at(-1)?.headSha,
    ...events.map(({ commitSha }) => commitSha),
    requiredBase,
  ]) {
    if (!ref) continue;
    const result = await ctx.process.run({
      command: ["git", "-C", home.root_path, "rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`],
    });
    if (result.exitCode === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("The required base is unavailable in the project Git repository. Fetch its code before dispatch.");
}

export async function recoveryPrompt(
  ctx: CommandContext,
  recovery: WorkspaceRecovery | undefined,
  requiredBase: string,
) {
  if (!recovery) return [];
  const old = recovery.previous;
  const ticket = await findTicket(ctx.storage, old.ticketId);
  return [
    [
      `Recover ${old.ticketShorthand}. The old workspace ${old.workspaceShorthand} (${old.workspaceId}) is unavailable: ${recovery.detail}. This is a recovery assignment, not a reason to block the ticket or ask for human permission.`,
      `This fresh managed workspace starts at available commit ${recovery.headSha}; required dependency base: ${requiredBase}. This starting point does not prove the previous work was recovered. Keep this workspace's assigned branch. Read the ticket, old attempt history, reports and review findings. Old implementation session: ${old.implementationSessionId}. Old recorded base: ${old.base.headSha}.`,
      `Old revisions: ${old.revisions.map((revision) => `R${revision.revision}: ${revision.headSha}, base ${revision.baseSha}, report ${revision.changeRequestReportId}`).join("; ") || "No submitted revisions"}. Linked PRs: ${(ticket?.reviewLinks ?? []).map(({ url }) => url).join(", ") || "None"}.`,
      "Find the previous code in the surviving Git branch, saved commits, PR branches and reports. Fetch the PR code when needed and restore it here. If no code survives, restart implementation from the ticket requirements. State what was recovered and what had to be redone; do not claim missing uncommitted files were restored. The old workspace and its review history remain available as evidence.",
      `Commit recovered changes, run update-stack with this workspace's current HEAD and your owner session, and verify the required code before continuing. Run affected checks and configured review, save a fresh change request report and submit the exact new HEAD. Old approvals stay on old commits; recovery does not approve work or merge the target. Preserve the ticket's PR target. Request human input only for a real unresolved requirements decision or missing access you cannot repair.`,
    ].join("\n\n"),
  ];
}

export async function finishWorkspaceRecovery(ctx: CommandContext, old: AttemptRecord, replacement: AttemptRecord) {
  // Publish the replacement selection before retiring the old record. If a later write fails,
  // the successful new owner remains discoverable and no historical review needs rewriting.
  const actor = actorFromSource(ctx.source, ctx.invocationId);
  await attemptSelectionsCollection(ctx.storage).put(old.ticketId, {
    ticketId: old.ticketId,
    workspaceId: replacement.workspaceId,
    selectedBy: actor,
    humanRequestId: null,
    selectedAt: new Date().toISOString(),
  });
  await appendAttemptEvent(ctx.storage, {
    workspaceId: replacement.workspaceId,
    revision: null,
    type: "attempt_selected",
    actor,
    sessionId: replacement.implementationSessionId,
    reportId: null,
    reviewId: null,
    threadId: null,
    commitSha: null,
    metadata: { previousWorkspaceId: old.workspaceId, reason: "workspace-recovery" },
  });
  await appendAttemptEvent(ctx.storage, {
    workspaceId: old.workspaceId,
    revision: old.revisions.at(-1)?.revision ?? null,
    type: "attempt_abandoned",
    actor,
    sessionId: old.implementationSessionId,
    reportId: null,
    reviewId: null,
    threadId: null,
    commitSha: old.revisions.at(-1)?.headSha ?? null,
    metadata: {
      reason: "Workspace unavailable; continuation created",
      replacementWorkspaceId: replacement.workspaceId,
      replacementSessionId: replacement.implementationSessionId,
    },
  });
}

export async function recoverySessionInput(
  ctx: CommandContext,
  recovery?: WorkspaceRecovery,
  beforeDispatch?: () => Promise<void>,
) {
  if (!recovery) return {};
  await beforeDispatch?.();
  const [current, owner] = await Promise.all([
    readAttempt(ctx.storage, recovery.previous.workspaceId),
    ctx.sessions.get(recovery.previous.implementationSessionId),
  ]);
  if (JSON.stringify(current) !== JSON.stringify(recovery.previous))
    throw new Error("The recovery attempt changed before launch.");
  if (isLiveSession(owner))
    throw new Error("The previous implementation session is running. Continue its existing owner.");
  if (owner?.last_exit?.cause === "user_stop")
    throw new Error("The previous implementation session was stopped. Keep its work paused.");
  return owner ? { originalSessionId: owner.id } : {};
}
