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
import { workspaceHead } from "./change-requests";
import { repairAttempt } from "./repair-attempt";
import {
  createAnchoredWorkspace,
  harnessInput,
  resolveTicket,
  resolveTicketIdentity,
  ticketActionParams,
} from "./ticket-actions";
import { readWorkspaceStartBase } from "./workspace-start-base";

const humanReadinessReasons = new Set<HumanRequestReason>([
  "ambiguous-dependency-attempt",
  "dependency-cycle",
  "dependency-missing",
]);

const runAttemptParams = {
  ...ticketActionParams,
  newVariant: params.boolean({ label: "Explore another implementation variant" }),
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
export async function startAttempt(
  ctx: CommandContext,
  commandParams: ParamsOf<typeof runAttemptParams>,
  options: {
    beforeDispatch?: (baseHeadSha?: string) => Promise<void>;
    requireMergedDependencies?: boolean;
    dependencyReview?: "approved" | "submitted";
  } = {},
) {
  const { agent } = commandParams;
  const chosenBase = commandParams.workspace?.params?.base;
  const ticketRef = resolveTicket(ctx, commandParams);
  const ticketIdentity = await resolveTicketIdentity(ctx, ticketRef);
  if (!commandParams.newVariant) {
    const reused = await reuseAttempt(ctx, ticketIdentity, options.beforeDispatch);
    if (reused) return reused;
  }
  const ownerRunId = ctx.invocationId ?? crypto.randomUUID();
  const loaded = await loadAttemptReadiness(ctx, ticketRef, {
    base: typeof chosenBase === "string" ? chosenBase : undefined,
    dependencyReview: options.dependencyReview,
    requireMergedDependencies: options.requireMergedDependencies,
  });
  const { capacity } = loaded;
  const integration =
    loaded.readiness.decision === "wait" && loaded.readiness.reason === "divergent-dependency-attempts"
      ? loaded.readiness
      : null;
  const readiness = integration
    ? {
        decision: "ready" as const,
        mode: "stacked" as const,
        baseWorkspaceId: null,
        baseHeadSha: integration.baseHeadSha!,
        dependencyAttemptIds: integration.integrationHeads!.map(({ workspaceId }) => workspaceId),
      }
    : loaded.readiness;
  if (readiness.decision === "wait") {
    const message = attemptWaitMessage(ticketIdentity.shorthand, readiness, capacity);
    const storedTicket = await findTicket(ctx.storage, ticketRef);
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
  const { anchor, mode, ticket, workspace } = await createAnchoredWorkspace(
    ctx,
    commandParams,
    readiness.baseHeadSha,
    async () => {
      await options.beforeDispatch?.(readiness.baseHeadSha);
    },
  );
  const actualBase = await readWorkspaceStartBase(ctx, workspace.id, readiness.baseHeadSha);
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
      ...(integration
        ? [
            `First integrate these independent prerequisite commits into this workspace: ${JSON.stringify(integration.integrationHeads)}. Run their required integration validation, then record the integration commit with update-stack before implementing or submitting the ticket. Missing ancestry must not be replaced by patch similarity.`,
          ]
        : []),
      ...(readiness.mode === "stacked"
        ? [
            `This workspace starts at dependency commit ${readiness.baseHeadSha}. Stack your changes on this work; do not reset to the project base or discard dependency changes. Dependency workspaces: ${readiness.dependencyAttemptIds.join(", ")}.`,
          ]
        : []),
    ].join("\n\n"),
  });
  const timestamp = new Date().toISOString();
  const attempt: AttemptRecord = {
    schemaVersion: 2,
    workspaceId: workspace.id,
    workspaceShorthand: workspace.workspace_shorthand ?? workspace.id,
    ticketId: ticket.id,
    ticketShorthand: anchor.label ?? ticketIdentity.shorthand,
    implementationSessionId: session.id,
    base: { workspaceId: readiness.baseWorkspaceId, headSha: actualBase },
    revisions: [],
    implementationDisconnectRetries: 0,
    reviewDisconnectRetries: 0,
    blocker: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await putAttempt(ctx.storage, attempt);
  await appendAttemptEvent(ctx.storage, {
    workspaceId: workspace.id,
    revision: null,
    type: "attempt_started",
    actor: actorFromSource(ctx.source, ownerRunId),
    sessionId: session.id,
    reportId: null,
    reviewId: null,
    threadId: null,
    commitSha: actualBase,
    metadata: {
      mode: readiness.mode,
      dependencyAttemptIds: readiness.dependencyAttemptIds,
      integrationHeads: integration?.integrationHeads ?? [],
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
