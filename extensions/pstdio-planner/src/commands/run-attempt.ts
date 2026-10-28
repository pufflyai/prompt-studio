import {
  type CommandContext,
  defineCommand,
  l10n,
  type ParamsOf,
  params,
  type ResourceAnchor,
} from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { legacyAttemptOutput } from "../data/attempt-compatibility";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { appendAttemptEvent, attemptSelectionsCollection, listAttempts, putAttempt } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { attemptWaitMessage } from "../data/attempt-wait-message";
import { findTicket } from "../data/resolve";
import { createReviewRequest, handoffRequest } from "../data/review-request-create";
import type { HumanRequestReason } from "../data/review-request-types";
import { renderOwnedTemplate } from "../data/template-store";
import { withWriteGuard } from "../data/write-guard";
import { ticketMenuSlots } from "../resource-kinds";
import { loadAttemptReadiness, readImplementationCapacity } from "./attempt-readiness";
import { adoptDraftWorkspace } from "./attempt-workspace";
import { workspaceHead } from "./change-requests";
import { prepareDependencyBase } from "./dependency-base";
import { repairAttempt } from "./repair-attempt";
import {
  createAnchoredWorkspace,
  harnessInput,
  resolveTicket,
  resolveTicketIdentity,
  ticketActionParams,
} from "./ticket-actions";
import {
  finishWorkspaceRecovery,
  recoveryPrompt,
  recoverySessionInput,
  type WorkspaceRecovery,
} from "./workspace-recovery";

const humanReadinessReasons = new Set<HumanRequestReason>([
  "ambiguous-dependency-attempt",
  "dependency-cycle",
  "dependency-missing",
]);

const runAttemptParams = {
  ...ticketActionParams,
  newVariant: params.boolean({
    label: "Explore another implementation variant",
    description:
      "Start a separate workspace and conversation to try a different solution for this ticket. Leave this off to resume the existing variant when one is available.",
  }),
  // Attempts review and merge Git commits, so only a Git worktree can run one.
  workspace: params.workspace({ label: "Workspace", providers: ["pstdio.worktree"] }),
};

const reuseAttempt = async (
  ctx: CommandContext,
  ticketIdentity: { id: string; shorthand: string },
  beforeDispatch: (() => Promise<void>) | undefined,
) => {
  const [attempts, selections, retired] = await Promise.all([
    listAttempts(ctx.storage),
    attemptSelectionsCollection(ctx.storage).list(),
    readRetiredWorkspaceIds(ctx.storage),
  ]);
  const variants = attempts.filter(
    (attempt) => attempt.ticketId === ticketIdentity.id && !retired.has(attempt.workspaceId),
  );
  const selection = selections.find((candidate) => candidate.ticketId === ticketIdentity.id);
  const chosen = selection ? variants.filter((attempt) => attempt.workspaceId === selection.workspaceId) : variants;
  if (variants.length && chosen.length !== 1)
    throw new Error("Select the implementation variant to resume, or explicitly request a new variant.");
  const existing = chosen[0];
  if (existing) {
    await beforeDispatch?.();
    const session = await ctx.sessions.get(existing.implementationSessionId);
    const capacity = await readImplementationCapacity(ctx);
    if (
      !session ||
      (!["queued", "in_progress", "awaiting_input"].includes(session.status ?? "") &&
        capacity.running >= capacity.limit)
    )
      throw new Error("No implementation capacity is available to resume this owner.");
    await repairAttempt(ctx, {
      workspaceId: existing.workspaceId,
      expectedHeadSha: await workspaceHead(ctx, existing.workspaceId),
      reason: `Continue implementation of ${existing.ticketShorthand} as requested. Reuse this workspace and conversation.`,
    });
    const workspace = (await ctx.workspaces.get(existing.workspaceId))!;
    return {
      decision: "started" as const,
      mode: "existing",
      ticket: ticketIdentity,
      workspace,
      attempt: await legacyAttemptOutput(ctx.storage, existing),
      variant: existing,
      session: { ...session, workspace_id: workspace.id },
    };
  }
  return null;
};
interface StartAttemptOptions {
  beforeDispatch?: (baseHeadSha?: string) => Promise<void>;
  requireMergedDependencies?: boolean;
  workspaceId?: string;
  recovery?: WorkspaceRecovery;
}

export async function startAttempt(
  ctx: CommandContext,
  commandParams: ParamsOf<typeof runAttemptParams>,
  options: StartAttemptOptions = {},
) {
  // Corrections continue in the owned workspace and conversation. Recovery and draft adoption bring their own workspace.
  const startsFresh = commandParams.newVariant || options.workspaceId || options.recovery;
  const ticketIdentity = await resolveTicketIdentity(ctx, resolveTicket(ctx, commandParams));
  const reused = startsFresh ? null : await reuseAttempt(ctx, ticketIdentity, options.beforeDispatch);
  return reused ?? launchAttempt(ctx, commandParams, options);
}

async function launchAttempt(
  ctx: CommandContext,
  commandParams: ParamsOf<typeof runAttemptParams>,
  options: StartAttemptOptions,
) {
  const { agent } = commandParams;
  const chosenBase = commandParams.workspace?.params?.base;
  const ticketRef = resolveTicket(ctx, commandParams);
  const ticketIdentity = await resolveTicketIdentity(ctx, ticketRef);
  const ownerRunId = ctx.invocationId ?? crypto.randomUUID();
  const { readiness, capacity } = await loadAttemptReadiness(ctx, ticketRef, {
    base: typeof chosenBase === "string" ? chosenBase : undefined,
    requireMergedDependencies: options.requireMergedDependencies,
  });
  if (readiness.decision === "wait") {
    const message = attemptWaitMessage(ticketIdentity.shorthand, readiness, capacity);
    const storedTicket = await findTicket(ctx, ticketRef);
    if (storedTicket?.statusId && humanReadinessReasons.has(readiness.reason as HumanRequestReason)) {
      // The readiness reason is what the person who started the attempt needs, so a
      // failed handoff must not replace it.
      await createReviewRequest(ctx, {
        ticket: storedTicket.id,
        reason: readiness.reason as HumanRequestReason,
        title: message,
        request: handoffRequest,
        instructions:
          "Repair the dependency graph or select the intended dependency attempt, then answer this request.",
        expectedTicketStatusId: storedTicket.statusId,
      }).catch((error: unknown) =>
        ctx.logger.warn("Could not request human input for a ticket that cannot start", {
          ticket: storedTicket.shorthand,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    throw new Error(message);
  }
  const dependencyBase = await prepareDependencyBase(ctx, readiness);
  const startingHead = options.recovery?.headSha ?? dependencyBase.headSha;
  const beforeDispatch = async () => options.beforeDispatch?.(readiness.baseHeadSha);
  const { anchor, mode, ticket, workspace, headSha } = options.workspaceId
    ? await adoptDraftWorkspace(ctx, ticketRef, options.workspaceId, beforeDispatch)
    : {
        ...(await createAnchoredWorkspace(ctx, commandParams, startingHead, beforeDispatch)),
        headSha: startingHead,
      };
  const attemptAnchor: ResourceAnchor = {
    type: "planner-attempt",
    id: workspace.id,
    label: workspace.workspace_shorthand ?? anchor.label,
    metadata: {
      ticketId: ticket.id,
      workspaceId: workspace.id,
      phase: "implementation",
      revision: null,
      headSha: null,
    },
  };
  const session = await ctx.sessions.create({
    title: `Implement ticket: ${anchor.label}`,
    workspaceId: workspace.id,
    anchors: [anchor, attemptAnchor],
    ...harnessInput(agent),
    prompt: [
      await renderOwnedTemplate(ctx, "implement-ticket", {
        ticket: anchor.label ?? ticketIdentity.shorthand,
        workspaceId: workspace.id,
      }),
      ...(await recoveryPrompt(ctx, options.recovery, dependencyBase.headSha)),
      ...(options.workspaceId
        ? [
            `Continue the existing draft in this workspace on its assigned branch. Its current HEAD is ${headSha}; its required dependency base is ${dependencyBase.headSha}. Preserve all uncommitted work. Commit the draft first, then run update-stack with your implementation session ID and the exact current HEAD before continuing. Validate the integration before submitting. The delivery target for this work is ${typeof chosenBase === "string" ? chosenBase : dependencyBase.headSha}.`,
          ]
        : []),
      ...(!options.workspaceId && !options.recovery && readiness.mode === "stacked"
        ? [
            `This workspace starts at base ${dependencyBase.headSha}. Required dependency workspaces: ${readiness.dependencyAttemptIds.join(", ")}. Keep the assigned branch. Verify the submitted dependency commits are present and use update-stack if needed. If their automatic combination conflicts, reconcile the code in this workspace, commit, and retry update-stack. Do not request human review for Git conflicts; ask only if features, concepts, plans, requirements, or architecture conflict. Do not reset to the target branch, recreate dependency code, approve work, or mark a ticket Done to repair its base.`,
          ]
        : []),
    ].join("\n\n"),
    ...(await recoverySessionInput(ctx, options.recovery, beforeDispatch)),
  });
  const timestamp = new Date().toISOString();
  const attempt: AttemptRecord = {
    schemaVersion: 2,
    workspaceId: workspace.id,
    workspaceShorthand: workspace.workspace_shorthand ?? workspace.id,
    ticketId: ticket.id,
    ticketShorthand: anchor.label ?? ticketIdentity.shorthand,
    implementationSessionId: session.id,
    base: dependencyBase,
    revisions: [],
    implementationDisconnectRetries: 0,
    reviewDisconnectRetries: 0,
    blocker: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await putAttempt(ctx.storage, attempt);
  if (options.recovery) await finishWorkspaceRecovery(ctx, options.recovery.previous, attempt);
  await appendAttemptEvent(ctx.storage, {
    workspaceId: workspace.id,
    revision: null,
    type: "attempt_started",
    actor: actorFromSource(ctx.source, ownerRunId),
    sessionId: session.id,
    reportId: null,
    reviewId: null,
    threadId: null,
    commitSha: headSha,
    metadata: {
      mode: readiness.mode,
      dependencyAttemptIds: readiness.dependencyAttemptIds,
      ...(options.recovery ? { recoveredFromWorkspaceId: options.recovery.previous.workspaceId } : {}),
    },
  });
  return {
    decision: "started" as const,
    mode,
    ticket,
    workspace,
    attempt: await legacyAttemptOutput(ctx.storage, attempt),
    variant: attempt,
    session: { ...session, workspace_id: workspace.id },
  };
}

export const runAttemptCommand = defineCommand({
  id: "run-attempt",
  title: "Run attempt",
  cli: { examples: ["pst pstdio-planner run-attempt --ticket PS-1"] },
  menus: [
    {
      slot: ticketMenuSlots.headerOverflow,
      label: l10n("kanbanRenderers.tickets.rowActions.runAttempt", "Run attempt"),
      icon: "play",
    },
  ],
  params: runAttemptParams,
  async run(ctx, commandParams) {
    return withWriteGuard(ctx, "attempt-launch", () => startAttempt(ctx, commandParams));
  },
});
